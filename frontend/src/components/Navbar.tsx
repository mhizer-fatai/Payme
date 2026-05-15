import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import WalletButton from './WalletButton'

export default function Navbar() {
  const { isConnected } = useAccount()
  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="nav-logo" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/logo.png" alt="PayMe" style={{ width: 40, height: 40, borderRadius: 10, display: 'block' }} />
          <img src="/payme-text.png" alt="PayMe" style={{ height: 36, display: 'block', marginLeft: 12 }} />
        </Link>
        <div className="nav-right">
          {isConnected && (
            <Link to="/dashboard" className="btn btn-ghost btn-sm">
              Dashboard
            </Link>
          )}
          <WalletButton />
        </div>
      </div>
    </nav>
  )
}
