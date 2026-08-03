import { useState } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { arcTestnet } from '../lib/config'
import { Copy, LogOut } from 'lucide-react'

type PaymentWalletButtonProps = {
  className?: string
}

const shorten = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`

export default function PaymentWalletButton({ className = '' }: PaymentWalletButtonProps) {
  const { address, isConnected } = useAccount()
  const { connectors, connectAsync, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const copyAddress = async () => {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  if (isConnected && address) {
    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button className={`btn btn-secondary btn-sm ${className}`} onClick={() => setOpen(value => !value)}>
          {shorten(address)}
        </button>
        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setOpen(false)} />
            <div className="nav-dropdown" style={{ zIndex: 999 }}>
              <button className="nav-dropdown-item" onClick={copyAddress}>
                <Copy size={14} />
                <span>{copied ? 'Copied!' : 'Copy Address'}</span>
              </button>
              <button className="nav-dropdown-item" onClick={() => { setOpen(false); disconnect() }}>
                <LogOut size={14} />
                <span>Disconnect</span>
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        className={`btn btn-primary btn-sm ${className}`}
        disabled={isPending}
        onClick={async () => {
          setError(null)
          try {
            const connector = connectors[0]
            if (!connector) throw new Error('No wallet connector found')
            await connectAsync({ connector, chainId: arcTestnet.id })
          } catch (err: any) {
            setError(err?.message || 'Wallet connection failed')
          }
        }}
      >
        {isPending ? 'Connecting...' : 'Connect Wallet'}
      </button>
      {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>}
    </div>
  )
}
