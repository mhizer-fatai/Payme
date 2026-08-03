import { Link } from 'react-router-dom'
import { ArrowRight, CircleDollarSign, Globe, Link2, Share, ShieldCheck, Smartphone, Zap } from 'lucide-react'
import Navbar from '../components/Navbar'
import WalletButton from '../components/WalletButton'
import { usePayMeAuth } from '../context/AuthContext'

const FEATURES = [
  { icon: <Globe size={24} />, title: 'Cavopay Wallet', desc: 'A simple app balance powered by your Cavopay wallet, built for sending and receiving without crypto jargon.' },
  { icon: <ShieldCheck size={24} />, title: 'Secured Sending', desc: 'Every in-app send is protected by your 4-digit Cavopay payment PIN.' },
  { icon: <CircleDollarSign size={24} />, title: 'USDC & EURC', desc: 'Accept stablecoin payments directly into your Cavopay wallet on Arc.' },
  { icon: <Smartphone size={24} />, title: 'Scan to Pay', desc: 'Generated QR codes for payment links make mobile checkout simple.' },
  { icon: <Zap size={24} />, title: 'Fast Settlement', desc: 'Payments settle quickly on Arc so balances and history stay easy to follow.' },
  { icon: <Link2 size={24} />, title: 'Permanent Profile', desc: 'Claim a custom @username for a permanent, shareable payment page.' },
]

const HOW_IT_WORKS = [
  { icon: <Link2 size={32} />, title: 'Create a Link or Username', desc: 'Login, create your Cavopay wallet, and claim a username or generate a payment link.' },
  { icon: <Share size={32} />, title: 'Share with Anyone', desc: 'Send your link by text, email, or social media, or show your QR code.' },
  { icon: <CircleDollarSign size={32} />, title: 'Get Paid', desc: 'The payer connects their wallet and pays. Funds arrive in your Cavopay wallet.' },
]

export default function HomePage() {
  const { user } = usePayMeAuth()
  const isLoggedIn = !!user?.paymeSessionToken

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />

      <section className="hero">
        <div className="live-chip">
          <span className="live-dot" />
          Live on Arc Testnet
        </div>

        <h1 className="hero-title">
          Get paid in <span className="gradient-text">stablecoins.</span>
          <br />
          In seconds.
        </h1>
        <p className="hero-sub">
          Create a shareable payment link or claim a permanent username. Accept USDC or EURC directly to your Cavopay wallet.
        </p>

        <div className="hero-btns">
          {!isLoggedIn ? (
            <WalletButton className="btn-lg" />
          ) : (
            <Link to="/dashboard" className="btn btn-primary btn-lg">
              Go to Dashboard <ArrowRight size={18} />
            </Link>
          )}
        </div>
      </section>

      <section className="how-it-works">
        <div className="container">
          <h2 className="sec-title">How It <span className="gradient-text">Works</span></h2>
          <div className="hiw-grid">
            {HOW_IT_WORKS.map(step => (
              <div key={step.title} className="hiw-card glass">
                <div className="hiw-icon">{step.icon}</div>
                <h3 className="hiw-title">{step.title}</h3>
                <p className="hiw-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <h2 className="sec-title">Why <span className="gradient-text">Cavopay</span>?</h2>
          <div className="feat-grid">
            {FEATURES.map(feature => (
              <div key={feature.title} className="feat-card">
                <div className="feat-icon-wrap">{feature.icon}</div>
                <div className="feat-title">{feature.title}</div>
                <div className="feat-desc">{feature.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="container">
          <div className="cta-card glass">
            <h2 className="cta-title">Ready to get paid?</h2>
            <p className="cta-desc">Create your Cavopay wallet and start receiving USDC or EURC payments.</p>
            {!isLoggedIn ? (
              <WalletButton className="btn-lg" />
            ) : (
              <Link to="/dashboard" className="btn btn-primary btn-lg">Open Dashboard</Link>
            )}
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-inner">
          <div className="footer-left">
            <img src="/cavopay-logo.png" alt="Cavopay" style={{ width: 24, height: 24, borderRadius: 6, display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }} />
            <span style={{ fontWeight: 600, color: '#fff' }}>Cavopay</span>
          </div>
          <div className="footer-right">
            Built on <a href="https://arc.network" target="_blank" rel="noopener noreferrer">Arc Network</a>
            {' - '}
            <a href="https://testnet.arcscan.app" target="_blank" rel="noopener noreferrer">Explorer</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
