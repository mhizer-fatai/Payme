import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, useReadContract, useSwitchChain, useConnectorClient, useBalance } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { TOKENS, BACKEND_URL, MULTICHAIN_TOKENS } from '../lib/config'
import { ERC20_ABI } from '../lib/contracts'
import Navbar from '../components/Navbar'
import WalletButton from '../components/WalletButton'
import { createPaymentLink, getCreatorPayments, getPayerPayments, Payment, claimProfile, getProfileByWallet, getProfile, Profile } from '../lib/api'
import { QRCodeSVG } from 'qrcode.react'
import { getUnifiedBalanceKit, getViemAdapter, getSolanaAdapter, fetchTotalUnifiedBalance } from '../lib/unifiedBalance'
import { ArcTestnet, BaseSepolia, ArbitrumSepolia } from '@circle-fin/app-kit/chains'
import { sepolia } from 'viem/chains'
import {
  ArrowUpRight,
  Wallet,
  RefreshCw,
  History,
  ChevronRight,
  Plus,
  ArrowRightLeft,
  X,
  Send,
  QrCode
} from 'lucide-react'

const shorten = (a: string) => a.slice(0, 6) + '…' + a.slice(-4)
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      className="btn btn-ghost btn-sm"
      title="Copy link"
      onClick={async () => { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500) }}
    >
      {ok ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function DashboardPage() {
  const { address, isConnected, chainId, connector } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const [receivedPayments, setReceivedPayments] = useState<Payment[]>([])
  const [sentPayments, setSentPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(false)
  const [unifiedConfirmed, setUnifiedConfirmed] = useState<string>('0.00')
  const [unifiedPending, setUnifiedPending] = useState<string>('0.00')
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositChain, setDepositChain] = useState<'Arc_Testnet' | 'Base_Sepolia' | 'Arbitrum_Sepolia' | 'Ethereum_Sepolia'>('Arc_Testnet')
  const [isDepositing, setIsDepositing] = useState(false)
  const [unifiedError, setUnifiedError] = useState<string | null>(null)

  // ─── Create Link State ────────────────────────────────────────────────
  const [form, setForm] = useState({ amount: '', token: 'USDC', note: '', recipient: '' })
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  // ─── Profile State ────────────────────────────────────────────────────
  const [profile, setProfile] = useState<Profile | null>(null)
  const [claimName, setClaimName] = useState('')
  const [claimLoading, setClaimLoading] = useState(false)
  const [claimErr, setClaimErr] = useState<string | null>(null)
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false)

  // ─── Notification State ──────────────────────────────────────────────
  const lastReceivedCount = useRef<number | null>(null)
  const lastSentCount = useRef<number | null>(null)

  // ─── Send State ──────────────────────────────────────────────────────
  const [isSendModalOpen, setIsSendModalOpen] = useState(false)
  const [sendDest, setSendDest] = useState('')
  const [sendAmount, setSendAmount] = useState('')
  const [sendChain, setSendChain] = useState<'Arc_Testnet' | 'Base_Sepolia' | 'Arbitrum_Sepolia' | 'Ethereum_Sepolia'>('Arc_Testnet')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  // ─── Fetch Balances ───────────────────────────────────────────────────
  const { data: usdcBalance } = useReadContract({
    address: TOKENS.USDC.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10000 },
  })

  const { data: eurcBalance } = useReadContract({
    address: TOKENS.EURC.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10000 },
  })

  const { data: baseUSDC } = useReadContract({
    address: MULTICHAIN_TOKENS.Base_Sepolia.USDC,
    abi: [
      { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }
    ],
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 84532,
    query: { enabled: !!address },
  })

  const { data: arbUSDC } = useReadContract({
    address: MULTICHAIN_TOKENS.Arbitrum_Sepolia.USDC,
    abi: [
      { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }
    ],
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 421614,
    query: { enabled: !!address },
  })

  const { data: ethUSDC } = useReadContract({
    address: MULTICHAIN_TOKENS.Ethereum_Sepolia.USDC,
    abi: [
      { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }
    ],
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 11155111,
    query: { enabled: !!address },
  })

  const fetchUnified = async () => {
    if (!address || !isConnected) return;
    try {
      const bal = await fetchTotalUnifiedBalance(address)
      setUnifiedConfirmed(bal.confirmed)
      setUnifiedPending(bal.pending)
    } catch (e: any) {
      console.error('Dashboard unified balance error:', e)
      if (!e.message?.includes('initialized')) {
        setUnifiedError(e.message || 'Failed to fetch Unified Balance');
      }
    }
  }

  // Auto-refresh balances every 10 seconds for real-time feel
  useEffect(() => {
    if (isConnected && address) {
      fetchUnified();
      const interval = setInterval(fetchUnified, 10000);
      
      // Fetch Profile
      getProfileByWallet(address).then(p => {
        setProfile(p)
        if (!p) setShowClaimModal(true)
      }).catch(() => {
        setProfile(null)
        setShowClaimModal(true)
      })
      
      return () => clearInterval(interval);
    }
  }, [isConnected, address]);

  const { data: arcNativeBalance } = useBalance({
    address: address,
    chainId: 5042002, // Arc Testnet (Official)
    query: { refetchInterval: 10000 }
  })

  const stats = [
    {
      lbl: 'Arc Wallet USDC',
      val: arcNativeBalance ? arcNativeBalance.formatted : '0.00',
      chain: 'Arc_Testnet',
      color: '#60a5fa'
    },
    {
      lbl: 'Base Wallet USDC',
      val: `${baseUSDC !== undefined ? formatUnits(baseUSDC as bigint, 6) : '0.00'}`,
      chain: 'Base_Sepolia',
      color: '#3b82f6'
    },
    {
      lbl: 'Arb Wallet USDC',
      val: `${arbUSDC !== undefined ? formatUnits(arbUSDC as bigint, 6) : '0.00'}`,
      chain: 'Arbitrum_Sepolia',
      color: '#2563eb'
    },
    {
      lbl: 'Eth Wallet USDC',
      val: `${ethUSDC !== undefined ? formatUnits(ethUSDC as bigint, 6) : '0.00'}`,
      chain: 'Ethereum_Sepolia',
      color: '#627eea'
    },
  ];

  const handleDeposit = async () => {
    if (!depositAmount || isDepositing) return;
    setIsDepositing(true);
    try {
      const realProvider = await connector?.getProvider();
      const kit = await getUnifiedBalanceKit();
      const viemAdapter = await getViemAdapter(realProvider);

      const ArcTestnetCustom = {
        ...ArcTestnet,
        chainId: 5042002,
        rpcEndpoints: ['https://rpc.testnet.arc.network/'],
        explorerUrl: 'https://testnet.arcscan.app/tx/{hash}'
      };

      const chainDef = depositChain === 'Arc_Testnet' ? ArcTestnetCustom :
        depositChain === 'Base_Sepolia' ? BaseSepolia :
        depositChain === 'Arbitrum_Sepolia' ? ArbitrumSepolia : sepolia;

      const result = await kit.unifiedBalance.deposit({
        from: { adapter: viemAdapter, chain: chainDef },
        amount: depositAmount,
        token: 'USDC',
        allowanceStrategy: depositChain === 'Arc_Testnet' ? 'approve' : 'authorize',
      });

      setIsDepositModalOpen(false);
      setDepositAmount('');
      fetchUnified();
    } catch (e: any) {
      console.error('Deposit failed:', e);
      alert('Deposit failed: ' + (e.message || 'Unknown error'));
    } finally {
      setIsDepositing(false);
    }
  };

  const handleSend = async () => {
    if (!sendDest || !sendAmount || isSending) return;
    setIsSending(true);
    setSendError(null);
    try {
      let recipientAddress = sendDest;
      
      // If it's not a 0x address, treat as username
      if (!sendDest.startsWith('0x')) {
        const p = await getProfile(sendDest.toLowerCase().replace('@', ''));
        if (!p || !p.wallet_address) {
          throw new Error('PayMe user not found');
        }
        recipientAddress = p.wallet_address;
      }

      const realProvider = await connector?.getProvider();
      const kit = await getUnifiedBalanceKit();
      const viemAdapter = await getViemAdapter(realProvider);

      const ArcTestnetCustom = {
        ...ArcTestnet,
        chainId: 5042002,
        rpcEndpoints: ['https://rpc.testnet.arc.network/'],
        explorerUrl: 'https://testnet.arcscan.app/tx/{hash}'
      };

      const chainDef = sendChain === 'Arc_Testnet' ? ArcTestnetCustom :
        sendChain === 'Base_Sepolia' ? BaseSepolia :
        sendChain === 'Arbitrum_Sepolia' ? ArbitrumSepolia : sepolia;

      const result = await kit.unifiedBalance.spend({
        amount: sendAmount,
        token: 'USDC',
        from: [{ adapter: viemAdapter }], // Pulls from any connected chain where funds sit
        to: {
          adapter: viemAdapter,
          chain: chainDef,
          recipientAddress: recipientAddress
        }
      });

      setIsSendModalOpen(false);
      setSendDest('');
      setSendAmount('');
      fetchUnified();
      // Optional: Log it or just alert
    } catch (e: any) {
      console.error('Send failed:', e);
      setSendError('Send failed: ' + (e.message || 'Unknown error'));
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (!address) return
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    const fetchPayments = async () => {
      try {
        const [received, sent] = await Promise.all([
          getCreatorPayments(address),
          getPayerPayments(address)
        ])
        setReceivedPayments(received)
        setSentPayments(sent)
        lastReceivedCount.current = received.length
        lastSentCount.current = sent.length
      } catch (e) {
        console.error('Fetch payments error:', e)
      } finally {
        setLoading(false)
      }
    }
    setLoading(true)
    fetchPayments()
    const interval = setInterval(fetchPayments, 10000)
    return () => clearInterval(interval)
  }, [address])

  const handleCreate = async () => {
    if (!address) return
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setCreateError('Error generating link: Please enter an amount')
      return
    }
    setCreateLoading(true)
    setCreateError(null)
    try {
      const targetAddress = form.recipient.trim() || address;
      const res = await createPaymentLink({
        creatorAddress: targetAddress,
        amount: form.amount || undefined,
        token: form.token,
        note: form.note || undefined,
      })
      const origin = window.location.origin
      setGeneratedLink(`${origin}/pay/${res.id}`)
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create link')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleClaim = async () => {
    if (!address || !claimName) return
    setClaimLoading(true)
    setClaimErr(null)
    try {
      const p = await claimProfile({ username: claimName, walletAddress: address })
      setProfile(p)
      setShowClaimModal(false)
    } catch (e: any) {
      setClaimErr(e.message)
    } finally {
      setClaimLoading(false)
    }
  }

  if (!isConnected) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card" style={{ maxWidth: 380, textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 40, fontWeight: 700, marginBottom: 16 }}>Secure</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Connect Your Wallet</h2>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 24 }}>
          Connect your wallet to view your payment links and history.
        </p>
        <WalletButton />
      </div>
    </div>
  )

  return (
    <div className="dash">
      <Navbar />
      <div className="container dash-body">
        <div className="dash-hdr">
          <div>
            <div className="addr-pill" style={{ marginTop: 0 }}>
              {profile ? `@${profile.username}` : shorten(address!)}
            </div>
          </div>
          <button
            className={`btn ${showCreate ? 'btn-ghost' : 'btn-primary'} btn-sm`}
            onClick={() => { setShowCreate(!showCreate); setGeneratedLink(null) }}
          >
            {showCreate ? 'Close' : '+ New Payment Link'}
          </button>
        </div>

        {showCreate && (
          <div className="create-modal-wrap">
            {!generatedLink ? (
              <div className="card create-card glass" style={{ position: 'relative' }}>
                <button 
                  onClick={() => setShowCreate(false)} 
                  style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
                <div className="net-banner" style={{ background: 'rgba(94, 106, 210, 0.1)', color: 'var(--accent-light)', borderColor: 'rgba(94, 106, 210, 0.2)', padding: '6px 12px', borderRadius: '99px', fontSize: 12, fontWeight: 600, display: 'inline-flex', marginBottom: 16 }}>Arc Testnet · {shorten(address!)}</div>
                <h2 className="display-font" style={{ fontSize: 24, marginBottom: 24 }}>Create Payment Link</h2>
                <div className="form-stack">
                  <div className="form-group">
                    <label className="form-label">Recipient Address (Optional)</label>
                    <input 
                      className="form-input" 
                      type="text" 
                      placeholder={`Default: ${address}`} 
                      value={form.recipient} 
                      onChange={(e) => setForm(f => ({ ...f, recipient: e.target.value }))} 
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Token</label>
                      <select className="form-input form-select" value={form.token} onChange={(e) => setForm(f => ({ ...f, token: e.target.value }))}>
                        <option value="USDC">USDC</option>
                        <option value="EURC">EURC</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Amount</label>
                      <input className="form-input" type="number" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} />
                    </div>
                  </div>
                  <button className="btn btn-primary btn-full" onClick={handleCreate} disabled={createLoading} style={{ marginTop: 8 }}>
                    {createLoading ? 'Generating...' : 'Generate Link'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="card create-card glass" style={{ textAlign: 'center', position: 'relative' }}>
                <button 
                  onClick={() => setShowCreate(false)} 
                  style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
                <div style={{ background: '#fff', padding: 16, borderRadius: 16, display: 'inline-block', marginBottom: 24 }}>
                  <QRCodeSVG value={generatedLink} size={160} />
                </div>
                <div className="link-box">
                  <span className="link-url">{generatedLink}</span>
                  <CopyBtn text={generatedLink} />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="portfolio-hero">
          <div className="ph-label">Unified Balance</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
            <div className="ph-value">
              ${(parseFloat(unifiedConfirmed) + parseFloat(unifiedPending)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" style={{ minWidth: 120, borderRadius: '999px' }} onClick={() => setIsSendModalOpen(true)}>
                <Send size={16} /> Send
              </button>
              <button className="btn btn-secondary" style={{ minWidth: 120, borderRadius: '999px' }} onClick={() => setIsReceiveModalOpen(true)}>
                <QrCode size={16} /> Receive
              </button>
            </div>
          </div>
          {unifiedError && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 12 }}>{unifiedError}</div>}
        </div>

        <div className="network-breakdown">
          {stats.map((stat) => (
            <div key={stat.lbl} className="net-pill">
              <div className="np-name">{stat.lbl}</div>
              <div className="np-val">${parseFloat(stat.val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <button
                onClick={() => {
                  setDepositChain(stat.chain as any);
                  setIsDepositModalOpen(true);
                }}
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 8, padding: '6px 12px', fontSize: 11, width: '100%', background: 'rgba(255,255,255,0.03)' }}
              >
                Deposit <Plus size={12} style={{ marginLeft: 4 }}/>
              </button>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="load-wrap"><div className="loader" /> Fetching ledger...</div>
        ) : (
          <div className="ledger-grid">
            <div className="ledger-card">
              <div className="ledger-head">
                Received <span className="ledger-count">{receivedPayments.length}</span>
              </div>
              <div className="ledger-list">
                {receivedPayments.length === 0 ? <div className="empty">No receipts yet</div> : receivedPayments.map(p => (
                  <div className="ledger-row glass" key={p.id}>
                    <div className="lr-left">
                      <div className="lr-amt" style={{ color: 'var(--green)' }}>+{p.amount} {p.token}</div>
                      <div className="lr-date">{fmtDate(p.created_at)}</div>
                    </div>
                    <div className="lr-right">
                      <div className="lr-addr">From: {shorten(p.payer_address)}</div>
                      <a href={`https://testnet.arcscan.app/tx/${p.tx_hash}`} target="_blank" rel="noopener noreferrer" className="lr-link">
                        <ArrowUpRight size={16} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="ledger-card">
              <div className="ledger-head">
                Sent <span className="ledger-count">{sentPayments.length}</span>
              </div>
              <div className="ledger-list">
                {sentPayments.length === 0 ? <div className="empty">No payments sent</div> : sentPayments.map(p => (
                  <div className="ledger-row glass" key={p.id}>
                    <div className="lr-left">
                      <div className="lr-amt">-{p.amount} {p.token}</div>
                      <div className="lr-date">{fmtDate(p.created_at)}</div>
                    </div>
                    <div className="lr-right">
                      <div className="lr-addr">To: {shorten((p as any).payment_links?.creator_address || 'Unknown')}</div>
                      <a href={`https://testnet.arcscan.app/tx/${p.tx_hash}`} target="_blank" rel="noopener noreferrer" className="lr-link">
                        <ArrowUpRight size={16} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {isDepositModalOpen && (
        <div className="wc-modal" onClick={() => setIsDepositModalOpen(false)}>
          <div className="card glass wc-card" onClick={e => e.stopPropagation()}>
            <div className="wc-title">Deposit Liquidity</div>
            <div className="wc-sub">Transfer funds from a local network into your cross-chain Unified Balance.</div>

            <div className="form-stack">
              <div className="form-group">
                <label className="form-label">Source Network</label>
                <div className="net-select-grid">
                  {(['Arc_Testnet', 'Base_Sepolia', 'Arbitrum_Sepolia', 'Ethereum_Sepolia'] as const).map(c => (
                    <button
                      key={c}
                      onClick={() => setDepositChain(c)}
                      className={`net-btn ${depositChain === c ? 'active' : ''}`}
                    >
                      {c.replace('_Testnet', '').replace('_Sepolia', '')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Amount (USDC)</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="form-input"
                />
              </div>

              <div className="alert" style={{ fontSize: 11, background: 'rgba(94,106,210,0.1)', color: 'var(--accent-light)', border: '1px solid rgba(94,106,210,0.2)' }}>
                Unified deposits are final and instantly spendable anywhere.
              </div>

              <div className="form-row" style={{ marginTop: 12 }}>
                <button onClick={() => setIsDepositModalOpen(false)} className="btn btn-ghost">Cancel</button>
                <button onClick={handleDeposit} disabled={!depositAmount || isDepositing} className="btn btn-primary" style={{ background: 'var(--accent-gradient)' }}>
                  {isDepositing ? 'Depositing...' : 'Confirm Deposit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Username Claim Modal */}
      {showClaimModal && !profile && (
        <div className="wc-modal">
          <div className="card glass wc-card" style={{ maxWidth: 420 }}>
            <div className="wc-title">Claim Your Username</div>
            <div className="wc-sub" style={{ marginBottom: 16 }}>
              Create a permanent link (e.g., payme.com/u/alice) to receive payments instantly into your Unified Balance.
            </div>
            
            <div className="alert alert-warn" style={{ marginBottom: 16, fontSize: 13, textAlign: 'left' }}>
              <strong>Important:</strong> Your username cannot be changed once claimed. Choose carefully!
            </div>

            <div className="form-stack">
              <input 
                type="text" 
                className="form-input" 
                placeholder="Username (e.g. alice)" 
                value={claimName} 
                onChange={e => setClaimName(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} 
              />
              {claimErr && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 4 }}>{claimErr}</div>}
              
              <div className="form-row" style={{ marginTop: 12 }}>
                <button onClick={() => setShowClaimModal(false)} className="btn btn-ghost">Maybe Later</button>
                <button onClick={handleClaim} disabled={claimLoading || !claimName} className="btn btn-primary">
                  {claimLoading ? 'Claiming...' : 'Claim Username'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Modal */}
      {isSendModalOpen && (
        <div className="wc-modal" onClick={() => setIsSendModalOpen(false)}>
          <div className="card glass wc-card" onClick={e => e.stopPropagation()}>
            <div className="wc-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Send Payment
              <button onClick={() => setIsSendModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div className="wc-sub">Send USDC instantly to any wallet or PayMe user.</div>

            <div className="form-stack">
              <div className="form-group">
                <label className="form-label">To</label>
                <input
                  type="text"
                  value={sendDest}
                  onChange={(e) => setSendDest(e.target.value)}
                  placeholder="0x Address or @username"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Amount (USDC)</label>
                <input
                  type="number"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  placeholder="0.00"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Destination Network</label>
                <div className="net-select-grid">
                  {(['Arc_Testnet', 'Base_Sepolia', 'Arbitrum_Sepolia', 'Ethereum_Sepolia'] as const).map(c => (
                    <button
                      key={c}
                      onClick={() => setSendChain(c)}
                      className={`net-btn ${sendChain === c ? 'active' : ''}`}
                    >
                      {c.replace('_Testnet', '').replace('_Sepolia', '')}
                    </button>
                  ))}
                </div>
              </div>

              {sendError && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 4 }}>{sendError}</div>}

              <button onClick={handleSend} disabled={!sendAmount || !sendDest || isSending} className="btn btn-primary btn-full" style={{ marginTop: 12 }}>
                {isSending ? 'Sending...' : 'Confirm Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {isReceiveModalOpen && (
        <div className="wc-modal" onClick={() => setIsReceiveModalOpen(false)}>
          <div className="card glass wc-card" style={{ textAlign: 'center', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <div className="wc-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}>
              Receive Payment
              <button onClick={() => setIsReceiveModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div className="wc-sub" style={{ marginBottom: 24, textAlign: 'left' }}>Share your address or profile link to get paid instantly into your Unified Balance.</div>

            <div style={{ background: '#fff', padding: 16, borderRadius: 16, display: 'inline-block', marginBottom: 24 }}>
              <QRCodeSVG value={profile ? `${window.location.origin}/u/${profile.username}` : address!} size={160} />
            </div>

            {profile ? (
              <div className="form-stack">
                <div className="form-group" style={{ textAlign: 'left' }}>
                  <label className="form-label">Your Payment Link</label>
                  <div className="link-box" style={{ margin: 0, padding: '10px 16px', background: 'rgba(255,255,255,0.05)' }}>
                    <span className="link-url">{window.location.origin}/u/{profile.username}</span>
                    <CopyBtn text={`${window.location.origin}/u/${profile.username}`} />
                  </div>
                </div>
                <div className="form-group" style={{ textAlign: 'left', marginTop: 12 }}>
                  <label className="form-label">Wallet Address</label>
                  <div className="link-box" style={{ margin: 0, padding: '10px 16px', background: 'rgba(255,255,255,0.05)' }}>
                    <span className="link-url">{address}</span>
                    <CopyBtn text={address!} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="form-stack">
                <div className="form-group" style={{ textAlign: 'left' }}>
                  <label className="form-label">Wallet Address</label>
                  <div className="link-box" style={{ margin: 0, padding: '10px 16px', background: 'rgba(255,255,255,0.05)' }}>
                    <span className="link-url">{address}</span>
                    <CopyBtn text={address!} />
                  </div>
                </div>
                <div style={{ marginTop: 24, textAlign: 'left', borderTop: '1px solid var(--border-dim)', paddingTop: 24 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Claim Your Profile</h3>
                  <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 12 }}>Create a custom link to make getting paid easier.</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Username" 
                      value={claimName} 
                      onChange={e => setClaimName(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} 
                    />
                    <button className="btn btn-primary" onClick={handleClaim} disabled={claimLoading || !claimName}>
                      {claimLoading ? '...' : 'Claim'}
                    </button>
                  </div>
                  {claimErr && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 8 }}>{claimErr}</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
