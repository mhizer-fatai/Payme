import { QrCode, ScanLine, Send } from 'lucide-react'
import type { Profile } from '../../lib/api'

type QuickActionsProps = {
  profile: Profile | null
  disabled: boolean
  onSend: () => void
  onReceive: () => void
  onScanQr: () => void
}

export default function QuickActions({
  profile,
  disabled,
  onSend,
  onReceive,
  onScanQr,
}: QuickActionsProps) {
  return (
    <div className="card glass quick-actions-card">
      <div className="quick-actions-heading">
        <h3>Actions</h3>
        <p>Send, receive, or scan a Cavopay QR on mobile.</p>
      </div>
      <div className="quick-actions-content">
        <div className="quick-actions-row">
          <button className="quick-action-tile primary" onClick={onSend} disabled={disabled}>
            <Send size={20} />
            <span>Send</span>
          </button>
          <button className="quick-action-tile" onClick={onReceive} disabled={disabled}>
            <QrCode size={20} />
            <span>Receive</span>
          </button>
          {profile && (
            <button className="quick-action-tile scan-qr-action" onClick={onScanQr} disabled={disabled}>
              <ScanLine size={20} />
              <span>Scan QR</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
