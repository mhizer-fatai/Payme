import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

interface Props {
  /** Extra classes / style to pass to the outermost element */
  className?: string
}

export default function WalletButton({ className = '' }: Props) {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { connectors, connect, isPending } = useConnect()
  const [showModal, setShowModal] = useState(false)

  const shorten = (a: string) => a.slice(0, 6) + '…' + a.slice(-4)

  if (isConnected && address) {
    return (
      <button
        className={`btn btn-secondary btn-sm ${className}`}
        onClick={() => disconnect()}
        title="Click to disconnect"
      >
        {shorten(address)}
      </button>
    )
  }

  return (
    <>
      <button
        id="connect-wallet-btn"
        className={`btn btn-primary btn-sm ${className}`}
        onClick={() => setShowModal(true)}
        disabled={isPending}
      >
        {isPending ? 'Connecting…' : 'Connect Wallet'}
      </button>

      {showModal && createPortal(
        <div className="wc-modal" onClick={() => setShowModal(false)}>
          <div className="card wc-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="wc-title">Connect Wallet</h3>
            <p className="wc-sub">Choose a wallet to connect to Arc Testnet.</p>

            {connectors.map((connector) => {
              const name = connector.name.toLowerCase()
              const iconUrl = connector.icon || 
                (name.includes('metamask') ? 'https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/metamask-fox.svg' :
                 name.includes('coinbase') ? 'https://www.vectorlogo.zone/logos/coinbase/coinbase-icon.svg' :
                 null)

              return (
                <button
                  key={connector.uid}
                  className="connector-btn"
                  onClick={() => {
                    connect({ connector })
                    setShowModal(false)
                  }}
                >
                  <div className="connector-icon">
                    {iconUrl ? (
                      <img src={iconUrl} alt={connector.name} style={{ width: 28, height: 28 }} />
                    ) : (
                      <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.5 }}>W</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div className="connector-name">{connector.name}</div>
                    <div className="connector-desc">
                      {name.includes('metamask') ? 'MetaMask Extension' :
                       name.includes('coinbase') ? 'Coinbase Smart Wallet' : 'Browser Wallet'}
                    </div>
                  </div>
                </button>
              )
            })}

            <button
              className="btn btn-ghost btn-sm btn-full"
              style={{ marginTop: 14 }}
              onClick={() => setShowModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
