import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAccount, useWriteContract, useReadContract, useSwitchChain } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { getPaymentLink, logPayment, PaymentLink } from '../lib/api'
import { QRCodeSVG } from 'qrcode.react'
import { PAYME_CONTRACT_ADDRESS, TOKENS, arcTestnet } from '../lib/config'
import { PAYME_ABI, ERC20_ABI } from '../lib/contracts'
import WalletButton from '../components/WalletButton'
import { getUnifiedBalanceKit, getViemAdapter, getSolanaAdapter } from '../lib/unifiedBalance'

function shorten(a: string) { return a.slice(0, 8) + '…' + a.slice(-6) }

/** Convert a UUID string → bytes32 hex */
function uuidToBytes32(uuid: string): `0x${string}` {
  const hex = uuid.replace(/-/g, '')
  return `0x${hex.padEnd(64, '0')}` as `0x${string}`
}

type Step = 'idle' | 'approving' | 'paying' | 'done' | 'unified-paying'

const DEMO_LINK: PaymentLink = {
  id: 'demo',
  creator_address: '0x1234567890abcdef1234567890abcdef12345678',
  amount: 25,
  token: 'USDC',
  note: 'Demo payment — Coffee & lunch',
  created_at: new Date().toISOString(),
}

export default function PayPage() {
  const { linkId } = useParams<{ linkId: string }>()
  const { address, isConnected, chainId } = useAccount()

  const [link, setLink] = useState<PaymentLink | null>(null)
  const [fetchErr, setFetchErr] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [payErr, setPayErr] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  
  // Unified Balance State
  const [unifiedBalance, setUnifiedBalance] = useState<string>('0.00')
  const [selectedSourceChain, setSelectedSourceChain] = useState<string>('Arc_Testnet')
  const [isUnifiedFlow, setIsUnifiedFlow] = useState(false)

  const { switchChain } = useSwitchChain()
  useEffect(() => {
    if (!linkId) return
    if (linkId === 'demo') { setLink(DEMO_LINK); return }
    getPaymentLink(linkId).then(l => {
      setLink(l)
      if (l.is_paid && l.tx_hash) {
        setTxHash(l.tx_hash)
        setStep('done')
      }
    }).catch(() => setFetchErr('Payment link not found'))
  }, [linkId])

  // ─── Timer Logic ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!link || !link.expires_at || step === 'done' || isDemo) return

    const tick = () => {
      const expiry = new Date(link.expires_at!).getTime()
      const now = new Date().getTime()
      const diff = Math.floor((expiry - now) / 1000)

      if (diff <= 0) {
        setTimeLeft(0)
        setPayErr('This payment link has expired.')
      } else {
        setTimeLeft(diff)
      }
    }

    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [link, step])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // ─── Unified Balance Fetch ──────────────────────────────────────────
  useEffect(() => {
    if (!address || !isConnected) return
    
    const fetchBalances = async () => {
      try {
        const kit = await getUnifiedBalanceKit()
        
        // 1. Fetch Unified (all chains supported by Circle)
        const bal = await kit.unifiedBalance.getBalances({
          token: 'USDC',
          sources: { address: address! },
          networkType: 'testnet',
          includePending: true
        })
        let total = parseFloat(bal.totalConfirmedBalance) + parseFloat(bal.totalPendingBalance || '0')
        
        // 2. Fetch Solana (Optional - if separate address used)
        if (typeof window !== 'undefined' && (window as any).solana) {
          try {
            const solAdapter = await getSolanaAdapter();
            const solBal = await kit.unifiedBalance.getBalances({
              token: 'USDC',
              sources: [{ adapter: solAdapter }],
              networkType: 'testnet'
            });
            total += parseFloat(solBal.totalConfirmedBalance) + parseFloat(solBal.totalPendingBalance || '0');
          } catch (e) {}
        }

        setUnifiedBalance(total.toFixed(2))
      } catch (e) {
        console.error('Failed to fetch unified balances', e)
      }
    }
    
    fetchBalances()
    const interval = setInterval(fetchBalances, 15000)
    return () => clearInterval(interval)
  }, [address, isConnected, arcUSDC])

  // ─── Derived ──────────────────────────────────────────────────────────
  const token = link?.token === 'EURC' ? TOKENS.EURC : TOKENS.USDC
  const amountRaw = link?.amount ? parseUnits(link.amount.toString(), token.decimals) : 0n

  const { data: arcUSDC } = useReadContract({
    address: TOKENS.USDC.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10000 },
  })

  // ─── Allowance ────────────────────────────────────────────────────────
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: token.address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, PAYME_CONTRACT_ADDRESS] : undefined,
    query: { enabled: !!address && amountRaw > 0n },
  })

  const hasAllowance = allowance !== undefined && allowance >= amountRaw && amountRaw > 0n

  // ─── Write hooks ──────────────────────────────────────────────────────
  const { writeContractAsync } = useWriteContract()

  const isWrongChain = isConnected && chainId !== arcTestnet.id
  const isDemo = link?.id === 'demo'

  // ─── Approve ──────────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!address || !link || isDemo) return
    setPayErr(null)
    setStep('approving')
    try {
      await writeContractAsync({
        address: token.address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [PAYME_CONTRACT_ADDRESS, amountRaw],
      })
      await new Promise(r => setTimeout(r, 3500))
      await refetchAllowance()
      setStep('idle')
    } catch (e: unknown) {
      setPayErr(e instanceof Error ? e.message : 'Approval rejected')
      setStep('idle')
    }
  }

  // ─── Pay ─────────────────────────────────────────────────────────────
  const handlePay = async () => {
    if (!address || !link || isDemo) return
    setPayErr(null)
    setStep('paying')
    try {
      const hash = await writeContractAsync({
        address: PAYME_CONTRACT_ADDRESS,
        abi: PAYME_ABI,
        functionName: 'pay',
        args: [
          uuidToBytes32(link.id),
          link.creator_address as `0x${string}`,
          token.address,
          amountRaw,
          link.note ?? '',
        ],
      })
      setTxHash(hash)
      setStep('done')
      // log to backend (fire-and-forget)
      logPayment({
        linkId: link.id,
        payerAddress: address,
        txHash: hash,
        amount: link.amount?.toString() ?? '0',
        token: link.token,
      }).catch(() => {})
    } catch (e: unknown) {
      setPayErr(e instanceof Error ? e.message : 'Transaction rejected')
      setStep('idle')
    }
  }

  // ─── Unified Pay ─────────────────────────────────────────────────────
  const handleUnifiedPay = async () => {
    if (!address || !link || isDemo) return
    setPayErr(null)
    setStep('unified-paying')
    try {
      const kit = await getUnifiedBalanceKit()
      const viemAdapter = await getViemAdapter()
      
      const destinationChain = 'Arc_Testnet' // PayMe settles on Arc
      
      const result = await kit.unifiedBalance.spend({
        amount: link.amount?.toString() || '0',
        from: { 
          adapter: selectedSourceChain.includes('Solana') ? await getSolanaAdapter() : viemAdapter, 
          allocations: [{ amount: link.amount?.toString() || '0', chain: selectedSourceChain as any }]
        },
        to: { 
          adapter: viemAdapter, 
          chain: 'Arc_Testnet', 
          recipientAddress: link.creator_address 
        },
      })

      // Note: Unified balance spend returns a result which we can use to log
      setTxHash(result.transactionHash)
      setStep('done')
      
      logPayment({
        linkId: link.id,
        payerAddress: address,
        txHash: result.transactionHash,
        amount: link.amount?.toString() ?? '0',
        token: link.token,
      }).catch(() => {})
      
    } catch (e: unknown) {
      setPayErr(e instanceof Error ? e.message : 'Unified payment failed')
      setStep('idle')
    }
  }

  // ─── Error state ──────────────────────────────────────────────────────
  if (fetchErr) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card err-card">
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Link Not Found</h2>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 24 }}>
          This payment link doesn't exist or has been removed.
        </p>
        <Link to="/" className="btn btn-primary">Create Your Own Link</Link>
      </div>
    </div>
  )

  if (!link) return (
    <div className="load-wrap">
      <div className="loader" />
      <span>Loading payment…</span>
    </div>
  )

  // ─── Success overlay ──────────────────────────────────────────────────
  if (step === 'done' && txHash) return (
    <div className="overlay">
      <div className="card confirm-card">
        <div className="check-circle">✓</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Payment Sent!</h2>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 22 }}>
          {link.amount ? `${link.amount} ${token.symbol} sent successfully` : 'Payment was successful'}
        </p>
        <div className="tx-box">
          <div className="tx-label">Transaction Hash</div>
          <div className="tx-hash">{txHash}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            id="view-tx-btn"
            href={`https://testnet.arcscan.app/tx/${txHash}`}
            target="_blank" rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
          >
            View on Explorer ↗
          </a>
          <Link to="/" className="btn btn-ghost btn-sm">Create Your Own Link</Link>
        </div>
      </div>
    </div>
  )

  // ─── Main Pay UI ──────────────────────────────────────────────────────
  return (
    <div className="pay-page">
      <div className="pay-card">
        <div className="card card-glow">
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
            <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <img src="/icon.png" alt="PayMe" style={{ width: 30, height: 30, borderRadius: 7 }} />
              <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-.02em' }}>PayMe</span>
            </Link>
            <WalletButton />
          </div>

          {/* Timer Badge (Centered below) */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            {timeLeft !== null && !isDemo && step !== 'done' && (
              <div style={{ 
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: timeLeft < 300 ? 'rgba(239,68,68,.1)' : 'rgba(245,158,11,.1)',
                color: timeLeft < 300 ? 'var(--red)' : 'var(--yellow)',
                border: `1px solid ${timeLeft < 300 ? 'rgba(239,68,68,.2)' : 'rgba(245,158,11,.2)'}`
              }}>
                <span className="live-dot" style={{ background: 'currentColor' }} />
                EXPIRES IN {formatTime(timeLeft)}
              </div>
            )}
          </div>

          {/* Amount */}
          <div className="pay-header">
            {link.amount ? (
              <>
                <div className="pay-amount display-font">{link.amount}</div>
                <div className="pay-token">
                  <span className={`badge-${token.symbol.toLowerCase()}`}>{token.symbol}</span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 18, color: 'var(--text2)' }}>Open amount</div>
            )}
            {link.note && <p className="pay-note">"{link.note}"</p>}
          </div>

          <div className="divider" />

          {/* Details */}
          <div style={{ marginBottom: 24 }}>
            {[
              ['To', shorten(link.creator_address)],
              ['Network', 'Arc Testnet'],
              ['Token', token.symbol],
              ...(link.amount ? [['Platform fee', `0.5% (≈ ${(link.amount * 0.005).toFixed(4)} ${token.symbol})`]] : []),
            ].map(([lbl, val]) => (
              <div key={lbl} className="info-row">
                <span className="info-label">{lbl}</span>
                <span className="info-val">{val}</span>
              </div>
            ))}
          </div>

          {/* Unified Balance & Chain Selector */}
          {!isDemo && step !== 'done' && (
            <div className="unified-section">
              <div className="unified-header">
                <span className="unified-label">Pay from Any Chain</span>
                <span className="unified-total">Balance: ${unifiedBalance} USDC</span>
              </div>
              <div className="chain-selector">
                {[
                  { id: 'Arc_Testnet', name: 'Arc', icon: '/icon.png' },
                  { id: 'Base_Sepolia', name: 'Base', icon: 'https://avatars.githubusercontent.com/u/108554348?s=200&v=4' },
                  { id: 'Arbitrum_Sepolia', name: 'Arb', icon: 'https://avatars.githubusercontent.com/u/55228625?s=200&v=4' },
                  { id: 'Solana_Devnet', name: 'Solana', icon: 'https://avatars.githubusercontent.com/u/35608259?s=200&v=4' }
                ].map(c => (
                  <button 
                    key={c.id}
                    className={`chain-chip ${selectedSourceChain === c.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedSourceChain(c.id)
                      setIsUnifiedFlow(c.id !== 'Arc_Testnet')
                    }}
                  >
                    <img src={c.icon} alt={c.name} />
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
              {isUnifiedFlow && (
                <p className="unified-hint">
                  Using Unified Balance Kit to bridge from {selectedSourceChain.split('_')[0]} instantly.
                </p>
              )}
            </div>
          )}

          {/* Scan to Pay QR */}
          {!isDemo && step !== 'done' && (
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
              <div style={{ 
                background: 'white', padding: 10, borderRadius: 12, 
                display: 'inline-block', animation: 'scaleIn 0.3s ease',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
              }}>
                <QRCodeSVG value={window.location.href} size={120} />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>Scan to pay with mobile wallet</p>
            </div>
          )}

          {/* Demo warning */}
          {isDemo && (
            <div className="alert alert-warn" style={{ marginBottom: 14 }}>
              This is a demo link. Connect a wallet and deploy the contract to make real payments.
            </div>
          )}

          {isWrongChain && (
            <div className="alert alert-warn">Please switch to Arc Testnet in your wallet.</div>
          )}
          {payErr && <div className="alert alert-err">{payErr}</div>}

          {/* Steps (only if amount set) */}
          {isConnected && link.amount && !isDemo && (
            <div style={{ marginBottom: 18 }}>
              {[
                { label: 'Approve token spending', done: hasAllowance || step === 'paying' || step === 'done', active: !hasAllowance && step === 'approving' },
                { label: 'Send payment on-chain', done: step === 'done', active: step === 'paying' },
              ].map((s, i) => (
                <div className="step-row2" key={i}>
                  <div className={`step-num ${s.done ? 's-done' : s.active ? 's-active' : 's-idle'}`}>
                    {s.done ? 'OK' : i + 1}
                  </div>
                  <span className="step-text">{s.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* CTA */}
          {!isConnected ? (
            <WalletButton className="btn-full" />
          ) : isWrongChain ? (
            <button
              className="btn btn-primary btn-full"
              onClick={() => switchChain({ chainId: arcTestnet.id })}
            >
              Switch to Arc Testnet
            </button>
          ) : isDemo ? (
            <Link to="/" className="btn btn-primary btn-full">
              Create Your Own Payment Link
            </Link>
          ) : !link.amount ? (
            <p style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 13, padding: '12px 0' }}>
              This link has no fixed amount. Contact the creator for details.
            </p>
          ) : (timeLeft !== null && timeLeft <= 0) ? (
            <button className="btn btn-ghost btn-full" disabled>
              Link Expired
            </button>
          ) : (hasAllowance && !isUnifiedFlow) ? (
            <button
              id="pay-now-btn"
              className="btn btn-success btn-full"
              disabled={step === 'paying'}
              onClick={handlePay}
            >
              {step === 'paying' ? 'Sending…' : `Pay ${link.amount} ${token.symbol}`}
            </button>
          ) : isUnifiedFlow ? (
            <button
              className="btn btn-primary btn-full btn-glow"
              disabled={step === 'unified-paying'}
              onClick={handleUnifiedPay}
            >
              {step === 'unified-paying' ? 'Processing Unified Pay…' : `Unified Pay ${link.amount} USDC`}
            </button>
          ) : (
            <button
              id="approve-btn"
              className="btn btn-primary btn-full"
              disabled={step === 'approving'}
              onClick={handleApprove}
            >
              {step === 'approving' ? 'Approving…' : `Approve ${token.symbol}`}
            </button>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: 'var(--text3)' }}>
          Payments settle on-chain via the Arc network.{' '}
          <a href="https://testnet.arcscan.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-light)' }}>
            View explorer ↗
          </a>
        </p>
      </div>
    </div>
  )
}
