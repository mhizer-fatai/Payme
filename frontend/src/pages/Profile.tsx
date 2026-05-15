import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAccount, useSwitchChain } from 'wagmi'
import { getProfile, Profile } from '../lib/api'
import WalletButton from '../components/WalletButton'
import { getUnifiedBalanceKit, getViemAdapter, getSolanaAdapter } from '../lib/unifiedBalance'
import { arcTestnet } from '../lib/config'

type Step = 'idle' | 'paying' | 'done'

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { address, isConnected } = useAccount()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [fetchErr, setFetchErr] = useState<string | null>(null)
  
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [payErr, setPayErr] = useState<string | null>(null)
  
  const [selectedSourceChain, setSelectedSourceChain] = useState<string>('Arc_Testnet')

  useEffect(() => {
    if (!username) return
    getProfile(username).then(p => {
      setProfile(p)
    }).catch(() => setFetchErr('Profile not found'))
  }, [username])

  const handlePay = async () => {
    if (!address || !profile || !amount || parseFloat(amount) <= 0) return
    setPayErr(null)
    setStep('paying')
    try {
      const kit = await getUnifiedBalanceKit()
      const viemAdapter = await getViemAdapter()
      
      const isSolana = selectedSourceChain.includes('Solana')
      const adapter = isSolana ? await getSolanaAdapter() : viemAdapter

      const result = await kit.unifiedBalance.depositFor({
        amount: amount,
        token: 'USDC',
        from: { adapter, chain: selectedSourceChain as any },
        depositAccount: profile.wallet_address,
      })

      setTxHash(result.txHash || result.transactionHash || 'Success')
      setStep('done')
      
    } catch (e: unknown) {
      setPayErr(e instanceof Error ? e.message : 'Payment failed')
      setStep('idle')
    }
  }

  if (fetchErr) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card err-card">
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Profile Not Found</h2>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 24 }}>
          The username @{username} doesn't exist.
        </p>
        <Link to="/" className="btn btn-primary">Go Home</Link>
      </div>
    </div>
  )

  if (!profile) return (
    <div className="load-wrap">
      <div className="loader" />
      <span>Loading profile…</span>
    </div>
  )

  if (step === 'done' && txHash) return (
    <div className="overlay">
      <div className="card confirm-card">
        <div className="check-circle">✓</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Payment Sent!</h2>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 22 }}>
          {amount} USDC sent directly to @{profile.username}'s Unified Balance.
        </p>
        <div className="tx-box">
          <div className="tx-label">Transaction Hash</div>
          <div className="tx-hash">{txHash}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => window.location.reload()} className="btn btn-secondary btn-sm">
            Send Another
          </button>
          <Link to="/" className="btn btn-ghost btn-sm">Create Your Own Link</Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="pay-page">
      <div className="pay-card">
        <div className="card card-glow">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
            <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <img src="/icon.png" alt="PayMe" style={{ width: 30, height: 30, borderRadius: 7 }} />
              <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-.02em' }}>PayMe</span>
            </Link>
            <WalletButton />
          </div>

          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ 
              width: 64, height: 64, borderRadius: 32, background: 'var(--accent-gradient)', 
              margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 24, fontWeight: 800
            }}>
              {profile.username.charAt(0).toUpperCase()}
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800 }}>Pay @{profile.username}</h2>
            <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>
              Funds will go straight to their Unified Balance.
            </p>
          </div>

          <div className="form-group" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 32, fontWeight: 700 }}>
              <span style={{ color: 'var(--text2)' }}>$</span>
              <input 
                type="number" 
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 48,
                  fontWeight: 800,
                  width: '180px',
                  textAlign: 'center',
                  color: 'var(--text)'
                }}
              />
              <span className="badge-usdc" style={{ fontSize: 14 }}>USDC</span>
            </div>
          </div>

          <div className="divider" />

          <div className="unified-section" style={{ marginTop: 24, marginBottom: 24 }}>
            <div className="unified-header">
              <span className="unified-label">Pay from Any Chain</span>
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
                  onClick={() => setSelectedSourceChain(c.id)}
                >
                  <img src={c.icon} alt={c.name} />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {payErr && <div className="alert alert-err" style={{ marginBottom: 16 }}>{payErr}</div>}

          {!isConnected ? (
            <WalletButton className="btn-full" />
          ) : (
            <button
              className="btn btn-primary btn-full btn-glow"
              disabled={step === 'paying' || !amount || parseFloat(amount) <= 0}
              onClick={handlePay}
            >
              {step === 'paying' ? 'Processing...' : `Send ${amount || '0'} USDC to @${profile.username}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
