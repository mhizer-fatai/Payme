const hre = require("hardhat");

async function main() {
  console.log("Deploying PayMePrivate to Inco Gentry Testnet...");

  // Arc Testnet USDC address for reference, but on Inco we might use a bridged version
  // For initial testing, we'll use the fee wallet provided in the constructor
  const feeWallet = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"; // Example (Vitalik's address or your platform wallet)
  const feeBps = 50; // 0.5%
  const withdrawCap = hre.ethers.parseUnits("5000", 6); // 5000 USDC cap per tx

  const PayMePrivate = await hre.ethers.getContractFactory("PayMePrivate");
  const payMe = await PayMePrivate.deploy(feeWallet, feeBps, withdrawCap);

  await payMe.waitForDeployment();

  console.log(`PayMePrivate deployed to: ${await payMe.getAddress()}`);
  console.log("Next steps: Set allowed tokens in the contract via setAllowedToken()");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
