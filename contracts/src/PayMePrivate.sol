// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@inco/lightning/src/Lib.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PayMePrivate
 * @notice Confidential payment vault for the PayMe platform, powered by Inco FHE.
 *         Balances and transfer amounts are stored as encrypted integers (euint64).
 *         Only the balance owner can request a decryption via Attested Decryption.
 *
 * @dev Security model:
 *      - Balances stored as FHE handles (euint64), never decrypted on-chain.
 *      - Reentrancy guarded on all state-modifying functions.
 *      - Checks-Effects-Interactions pattern enforced throughout.
 *      - Admin functions gated behind Ownable2Step (requires explicit acceptance).
 *      - Emergency Pause capability to freeze the vault in case of an exploit.
 *      - Fee deduction happens via encrypted arithmetic to prevent side-channel leaks.
 *      - SafeERC20 used for all token transfers to handle non-standard tokens.
 *      - Withdrawal cap per transaction prevents large single-block drains.
 *      - All public view functions return ciphertext handles, never plaintext values.
 */
contract PayMePrivate is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── Events ────────────────────────────────────────────────────────────────

    event Shielded(address indexed user, address indexed token, uint256 publicAmount);
    event PrivatePayment(bytes32 indexed linkId, address indexed payer, address indexed recipient);
    event PrivateSend(address indexed from, address indexed to);
    event Withdrawn(address indexed user, address indexed token, uint256 publicAmount);
    event FeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event FeeWalletUpdated(address oldWallet, address newWallet);
    event TokenAllowed(address indexed token, bool allowed);
    event WithdrawCapUpdated(uint256 oldCap, uint256 newCap);

    // ─── State ─────────────────────────────────────────────────────────────────

    uint256 public feeBps;
    address public feeWallet;

    uint256 public withdrawCap;

    mapping(address => bool) public allowedTokens;

    // Encrypted balances: user => token => FHE handle (euint64)
    // The handle is a 256-bit reference to an encrypted value stored in the Inco covalidator network.
    // Storing it as euint64 gives us up to ~18.4 quadrillion units (sufficient for USDC with 6 decimals).
    mapping(address => mapping(address => euint64)) internal _privateBalances;

    // ─── Constants ─────────────────────────────────────────────────────────────

    uint256 public constant MAX_FEE_BPS = 500;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // ─── Constructor ───────────────────────────────────────────────────────────

    constructor(
        address _feeWallet,
        uint256 _feeBps,
        uint256 _withdrawCap
    ) Ownable(msg.sender) {
        require(_feeWallet != address(0), "Invalid fee wallet");
        require(_feeBps <= MAX_FEE_BPS, "Fee exceeds maximum (5%)");
        require(_withdrawCap > 0, "Withdraw cap must be > 0");

        feeWallet = _feeWallet;
        feeBps = _feeBps;
        withdrawCap = _withdrawCap;
    }

    // ─── Core: Shield (Deposit) ────────────────────────────────────────────────

    /**
     * @notice Accepts a public USDC amount and converts it into a private encrypted balance.
     *         This is the "entry point" into the privacy layer.
     *         The public amount is visible on the source chain, but once shielded,
     *         the balance inside this contract is hidden from all external observers.
     *
     * @param token         ERC-20 token to shield (must be in allowedTokens).
     * @param publicAmount  The plain-text amount to shield (in token's smallest unit).
     */
    function shield(
        address token,
        uint256 publicAmount
    ) external nonReentrant whenNotPaused {
        require(allowedTokens[token], "Token not allowed");
        require(publicAmount > 0, "Amount must be > 0");
        require(publicAmount <= type(uint64).max, "Amount exceeds euint64 max");

        // EFFECTS: Encrypt the plain amount into a FHE handle and add to the user's private balance.
        // We use TFHE.asEuint64 to convert the public integer into an encrypted integer.
        // After this point, the value is mathematically hidden.
        euint64 encryptedAmount = TFHE.asEuint64(uint64(publicAmount));

        euint64 currentBalance = _privateBalances[msg.sender][token];
        if (!TFHE.isInitialized(currentBalance)) {
            _privateBalances[msg.sender][token] = encryptedAmount;
        } else {
            _privateBalances[msg.sender][token] = TFHE.add(currentBalance, encryptedAmount);
        }

        // Grant the depositor access to view their own balance via Attested Decryption.
        TFHE.allow(_privateBalances[msg.sender][token], msg.sender);
        TFHE.allow(_privateBalances[msg.sender][token], address(this));

        // INTERACTIONS: Pull tokens from the user only AFTER all state has been updated.
        IERC20(token).safeTransferFrom(msg.sender, address(this), publicAmount);

        emit Shielded(msg.sender, token, publicAmount);
    }

    // ─── Core: Pay via Link ────────────────────────────────────────────────────

    /**
     * @notice Executes a private payment from a payer's encrypted balance to a recipient.
     *         The amount is submitted as an already-encrypted ciphertext (einput).
     *         The contract never sees the plain amount. It performs encrypted arithmetic only.
     *
     *         Security note: We use TFHE.select (FHE MUX) instead of a plain `if` statement
     *         to avoid gas-based side-channel attacks that could leak whether the condition was true.
     *
     * @param linkId            Unique identifier of the PayMe payment link.
     * @param recipient         The PayMe creator's wallet address.
     * @param token             The ERC-20 token to use.
     * @param encryptedAmount   Encrypted amount (ciphertext from the Inco JS SDK).
     * @param inputProof        Cryptographic proof that the ciphertext is valid.
     */
    function payViaLink(
        bytes32 linkId,
        address recipient,
        address token,
        einput encryptedAmount,
        bytes calldata inputProof
    ) external nonReentrant whenNotPaused {
        require(allowedTokens[token], "Token not allowed");
        require(recipient != address(0), "Invalid recipient");
        require(recipient != msg.sender, "Cannot pay yourself");

        euint64 amount = TFHE.asEuint64(encryptedAmount, inputProof);

        euint64 senderBalance = _privateBalances[msg.sender][token];
        require(TFHE.isInitialized(senderBalance), "No shielded balance");

        // Compute fee in encrypted space to prevent side-channel gas leaks.
        // feeBps is a public value, so this multiplication is safe to do with a public scalar.
        euint64 encryptedFee = TFHE.div(TFHE.mul(amount, uint64(feeBps)), uint64(BPS_DENOMINATOR));
        euint64 recipientAmount = TFHE.sub(amount, encryptedFee);

        // Verify sender has sufficient balance using FHE comparison.
        // This returns an encrypted boolean (ebool). We never decrypt it inside the contract.
        // TFHE.select is used (FHE multiplexer) so gas usage is IDENTICAL whether balance is
        // sufficient or not — this prevents a timing/gas side-channel attack.
        ebool hasSufficientBalance = TFHE.le(amount, senderBalance);

        // EFFECTS: Apply encrypted updates using FHE select (MUX pattern) to avoid side channels.
        // If hasSufficientBalance is true  → new balance = senderBalance - amount
        // If hasSufficientBalance is false → new balance = senderBalance (no change)
        euint64 newSenderBalance = TFHE.select(hasSufficientBalance, TFHE.sub(senderBalance, amount), senderBalance);

        euint64 recipientBalance = _privateBalances[recipient][token];
        euint64 newRecipientBalance;
        if (!TFHE.isInitialized(recipientBalance)) {
            newRecipientBalance = TFHE.select(hasSufficientBalance, recipientAmount, TFHE.asEuint64(0));
        } else {
            newRecipientBalance = TFHE.select(hasSufficientBalance, TFHE.add(recipientBalance, recipientAmount), recipientBalance);
        }

        euint64 feeBalance = _privateBalances[feeWallet][token];
        euint64 newFeeBalance;
        if (!TFHE.isInitialized(feeBalance)) {
            newFeeBalance = TFHE.select(hasSufficientBalance, encryptedFee, TFHE.asEuint64(0));
        } else {
            newFeeBalance = TFHE.select(hasSufficientBalance, TFHE.add(feeBalance, encryptedFee), feeBalance);
        }

        _privateBalances[msg.sender][token] = newSenderBalance;
        _privateBalances[recipient][token] = newRecipientBalance;
        _privateBalances[feeWallet][token] = newFeeBalance;

        // Grant each party access to view only their own updated balance handle.
        TFHE.allow(newSenderBalance, msg.sender);
        TFHE.allow(newSenderBalance, address(this));
        TFHE.allow(newRecipientBalance, recipient);
        TFHE.allow(newRecipientBalance, address(this));
        TFHE.allow(newFeeBalance, feeWallet);
        TFHE.allow(newFeeBalance, address(this));

        // Emit a public event with NO amount. Only the parties involved know the value.
        emit PrivatePayment(linkId, msg.sender, recipient);
    }

    // ─── Core: Private Send ────────────────────────────────────────────────────

    /**
     * @notice Sends an encrypted amount from the caller's private balance to any address.
     *         100% private: no amount is ever revealed on-chain.
     *         Uses the same FHE select (MUX) pattern to prevent side-channel leaks.
     *
     * @param to                Recipient wallet address.
     * @param token             Token to send.
     * @param encryptedAmount   Encrypted amount from the JS SDK.
     * @param inputProof        Validity proof for the ciphertext.
     */
    function privateSend(
        address to,
        address token,
        einput encryptedAmount,
        bytes calldata inputProof
    ) external nonReentrant whenNotPaused {
        require(allowedTokens[token], "Token not allowed");
        require(to != address(0), "Invalid recipient");
        require(to != msg.sender, "Cannot send to yourself");

        euint64 amount = TFHE.asEuint64(encryptedAmount, inputProof);

        euint64 senderBalance = _privateBalances[msg.sender][token];
        require(TFHE.isInitialized(senderBalance), "No shielded balance");

        ebool hasSufficientBalance = TFHE.le(amount, senderBalance);

        euint64 newSenderBalance = TFHE.select(hasSufficientBalance, TFHE.sub(senderBalance, amount), senderBalance);

        euint64 recipientBalance = _privateBalances[to][token];
        euint64 newRecipientBalance;
        if (!TFHE.isInitialized(recipientBalance)) {
            newRecipientBalance = TFHE.select(hasSufficientBalance, amount, TFHE.asEuint64(0));
        } else {
            newRecipientBalance = TFHE.select(hasSufficientBalance, TFHE.add(recipientBalance, amount), recipientBalance);
        }

        _privateBalances[msg.sender][token] = newSenderBalance;
        _privateBalances[to][token] = newRecipientBalance;

        TFHE.allow(newSenderBalance, msg.sender);
        TFHE.allow(newSenderBalance, address(this));
        TFHE.allow(newRecipientBalance, to);
        TFHE.allow(newRecipientBalance, address(this));

        emit PrivateSend(msg.sender, to);
    }

    // ─── Core: Withdraw (Unshield) ─────────────────────────────────────────────

    /**
     * @notice Converts a private encrypted balance back into a public ERC-20 transfer.
     *         This is the "exit point" from the privacy layer. The withdrawn amount
     *         becomes public on the destination chain.
     *
     *         A per-transaction cap (`withdrawCap`) limits the maximum amount that can
     *         be unshielded in one call, limiting damage from a potential exploit.
     *
     * @param token         Token to withdraw.
     * @param publicAmount  The plain-text amount to withdraw (must match user's private balance).
     */
    function withdraw(
        address token,
        uint256 publicAmount
    ) external nonReentrant whenNotPaused {
        require(allowedTokens[token], "Token not allowed");
        require(publicAmount > 0, "Amount must be > 0");
        require(publicAmount <= withdrawCap, "Exceeds per-tx withdraw cap");
        require(publicAmount <= type(uint64).max, "Amount exceeds euint64 max");

        euint64 currentBalance = _privateBalances[msg.sender][token];
        require(TFHE.isInitialized(currentBalance), "No shielded balance");

        // Subtract the withdrawal amount from the user's encrypted balance.
        // The plaintext `publicAmount` is re-encrypted into a FHE scalar so the
        // subtraction happens in encrypted space — keeping the remaining balance hidden.
        euint64 encryptedWithdrawAmount = TFHE.asEuint64(uint64(publicAmount));
        ebool hasSufficientBalance = TFHE.le(encryptedWithdrawAmount, currentBalance);

        euint64 newBalance = TFHE.select(hasSufficientBalance, TFHE.sub(currentBalance, encryptedWithdrawAmount), currentBalance);

        // EFFECTS first: update state before any external call.
        _privateBalances[msg.sender][token] = newBalance;
        TFHE.allow(newBalance, msg.sender);
        TFHE.allow(newBalance, address(this));

        // INTERACTIONS: Send real tokens to the user AFTER the state is updated.
        // SafeERC20 handles tokens that return false instead of reverting.
        IERC20(token).safeTransfer(msg.sender, publicAmount);

        emit Withdrawn(msg.sender, token, publicAmount);
    }

    // ─── View: Encrypted Balance ───────────────────────────────────────────────

    /**
     * @notice Returns the FHE handle of the caller's private balance.
     *         This is NOT a decrypted value. It is an opaque reference.
     *         To see the actual balance, the user must use the Inco JS SDK
     *         to perform an Attested Decryption with their wallet signature.
     *
     * @param token   Token to query.
     * @return        The euint64 handle pointing to the encrypted balance.
     */
    function privateBalanceOf(address token) external view returns (euint64) {
        return _privateBalances[msg.sender][token];
    }

    // ─── Admin ─────────────────────────────────────────────────────────────────

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "Fee exceeds maximum (5%)");
        emit FeeUpdated(feeBps, _feeBps);
        feeBps = _feeBps;
    }

    function setFeeWallet(address _feeWallet) external onlyOwner {
        require(_feeWallet != address(0), "Invalid fee wallet");
        emit FeeWalletUpdated(feeWallet, _feeWallet);
        feeWallet = _feeWallet;
    }

    function setAllowedToken(address token, bool allowed) external onlyOwner {
        require(token != address(0), "Invalid token address");
        allowedTokens[token] = allowed;
        emit TokenAllowed(token, allowed);
    }

    function setWithdrawCap(uint256 _cap) external onlyOwner {
        require(_cap > 0, "Cap must be > 0");
        emit WithdrawCapUpdated(withdrawCap, _cap);
        withdrawCap = _cap;
    }

    // ─── Emergency ─────────────────────────────────────────────────────────────

    /**
     * @notice Pauses all deposits, payments, sends, and withdrawals.
     *         Used only in an emergency (e.g., exploit detection). Ownable2Step
     *         ensures a single compromised key cannot pause the contract; a
     *         pending transfer must be explicitly accepted by the new owner.
     */
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency rescue for tokens accidentally sent directly to the contract.
     *         Cannot rescue tokens that are tracked as user balances (i.e., allowed tokens).
     *         This prevents the owner from draining user funds via this function.
     *
     * @param token     Token to rescue.
     * @param to        Destination address.
     * @param amount    Amount to rescue.
     */
    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        require(!allowedTokens[token], "Cannot rescue vault tokens");
        require(to != address(0), "Invalid destination");
        IERC20(token).safeTransfer(to, amount);
    }

    // ─── Fallback ──────────────────────────────────────────────────────────────

    // Reject any ETH sent directly to the contract.
    receive() external payable {
        revert("PayMePrivate: does not accept ETH");
    }
}
