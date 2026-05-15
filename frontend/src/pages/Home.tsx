import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import Navbar from '../components/Navbar'
import WalletButton from '../components/WalletButton'
import { Link2, Share, CircleDollarSign, ShieldCheck, Zap, Globe, Smartphone, ArrowRight } from 'lucide-react'

const FEATURES = [
  { icon: <Globe size={24} />, title: 'Unified Balance', desc: 'Pay from any chain. We use Circle’s CCTP to bridge funds instantly from Base, Arb, or Solana.' },
  { icon: <ShieldCheck size={24} />, title: 'Non-Custodial', desc: 'Funds go directly wallet-to-wallet. PayMe never holds your money.' },
  { icon: <CircleDollarSign size={24} />, title: 'USDC & EURC', desc: "Accept USD Coin or Euro Coin — Circle's two premier stablecoins." },
  { icon: <Smartphone size={24} />, title: 'Scan to Pay', desc: 'Generated QR codes for every link make mobile checkout effortless.' },
  { icon: <Zap size={24} />, title: 'Instant Settlement', desc: 'Get paid in seconds with the lightning-fast finality of the Arc Network.' },
  { icon: <Link2 size={24} />, title: 'Permanent Profile', desc: 'Claim a custom @username for a permanent, easily shareable payment page.' },
]

const HOW_IT_WORKS = [
  { icon: <Link2 size={32} />, title: '1. Create a Link or Claim Username', desc: 'Connect your wallet and claim your unique username or generate a custom payment link.' },
  { icon: <Share size={32} />, title: '2. Share with Anyone', desc: 'Send your link via text, email, or social media. Or let them scan your QR code.' },
  { icon: <CircleDollarSign size={32} />, title: '3. Get Paid Instantly', desc: 'The payer connects their wallet and pays. Funds arrive in your wallet within seconds.' },
]

export default function HomePage() {
  const { isConnected } = useAccount()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />

      {/* ─── Hero ─── */}
      <section className="hero">
        <div className="orb orb1" />
        <div className="orb orb2" />
        <div className="orb orb3" />

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
          Create a shareable payment link or claim a permanent username. Accept USDC or EURC directly to your
          wallet — no middlemen, no waiting.
        </p>

        <div className="hero-btns">
          {!isConnected ? (
            <WalletButton className="btn-lg" />
          ) : (
            <Link to="/dashboard" className="btn btn-primary btn-lg">Go to Dashboard <ArrowRight size={18} /></Link>
          )}
        </div>

      </section>


      {/* ─── How it Works ─── */}
      <section className="how-it-works">
        <div className="container">
          <h2 className="sec-title">How It <span className="gradient-text">Works</span></h2>
          <div className="hiw-grid">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.title} className="hiw-card glass">
                <div className="hiw-icon">{step.icon}</div>
                <h3 className="hiw-title">{step.title}</h3>
                <p className="hiw-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="features">
        <div className="container">
          <h2 className="sec-title">Why <span className="gradient-text">PayMe</span>?</h2>
          <div className="feat-grid">
            {FEATURES.map(f => (
              <div key={f.title} className="feat-card">
                <div className="feat-icon-wrap">{f.icon}</div>
                <div className="feat-title">{f.title}</div>
                <div className="feat-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-card glass">
            <h2 className="cta-title">Ready to start accepting crypto?</h2>
            <p className="cta-desc">Join thousands of users getting paid instantly across multiple chains.</p>
            {!isConnected ? (
              <WalletButton className="btn-lg" />
            ) : (
              <Link to="/dashboard" className="btn btn-primary btn-lg">Open Dashboard</Link>
            )}
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="footer">
        <div className="container footer-inner">
          <div className="footer-left">
            <img src="/logo.png" alt="PayMe" style={{ width: 24, height: 24, borderRadius: 6, display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }} />
            <span style={{ fontWeight: 600, color: '#fff' }}>PayMe</span>
          </div>
          <div className="footer-right">
            Built on{' '}
            <a href="https://arc.network" target="_blank" rel="noopener noreferrer">Arc Network</a>
            {' · '}
            <a href="https://testnet.arcscan.app" target="_blank" rel="noopener noreferrer">Explorer ↗</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
