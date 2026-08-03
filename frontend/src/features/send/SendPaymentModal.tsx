import { X } from 'lucide-react'
import PinDotsInput from '../../components/PinDotsInput'
import { PAYME_SECURITY_QUESTIONS } from '../../lib/config'
import type { Profile } from '../../lib/api'

export type SendStep = 'details' | 'pin' | 'processing'
export type SendToken = 'USDC' | 'EURC'
export type PendingSend = {
  recipientAddress: string
  amount: string
  destinationChain: string
  token: SendToken
  isUsername: boolean
}

type DestinationChain = {
  value: string
  label: string
}

type SendPaymentModalProps = {
  arcChain: string
  chains: DestinationChain[]
  confirmPin: string
  destinationChain: string
  hasPayMePin: boolean | null
  isSending: boolean
  paymePin: string
  pendingSend: PendingSend | null
  securityAnswerOne: string
  securityAnswerTwo: string
  sendAmount: string
  sendDest: string
  sendError: string | null
  sendStep: SendStep
  sendToken: SendToken
  scannedRecipient?: Profile | null
  onAmountChange: (value: string) => void
  onBackToDetails: () => void
  onClose: () => void
  onConfirmPinChange: (value: string) => void
  onDestinationChainChange: (value: string) => void
  onPayMePinChange: (value: string) => void
  onRecipientChange: (value: string) => void
  onSecurityAnswerOneChange: (value: string) => void
  onSecurityAnswerTwoChange: (value: string) => void
  onSend: () => void
  onSubmitPin: () => void
  onTokenChange: (value: SendToken) => void
  getChainLabel: (value?: string) => string
  shortenAddress: (address: string) => string
}

export default function SendPaymentModal({
  arcChain,
  chains,
  confirmPin,
  destinationChain,
  hasPayMePin,
  isSending,
  paymePin,
  pendingSend,
  securityAnswerOne,
  securityAnswerTwo,
  sendAmount,
  sendDest,
  sendError,
  sendStep,
  sendToken,
  scannedRecipient,
  onAmountChange,
  onBackToDetails,
  onClose,
  onConfirmPinChange,
  onDestinationChainChange,
  onPayMePinChange,
  onRecipientChange,
  onSecurityAnswerOneChange,
  onSecurityAnswerTwoChange,
  onSend,
  onSubmitPin,
  onTokenChange,
  getChainLabel,
  shortenAddress,
}: SendPaymentModalProps) {
  const isCreatingPin = !hasPayMePin
  const canSubmitPin = paymePin.length === 4 && (
    hasPayMePin || (confirmPin.length === 4 && securityAnswerOne.trim() && securityAnswerTwo.trim())
  )

  return (
    <div className="wc-modal" onClick={onClose}>
      <div className="card glass wc-card send-card" onClick={event => event.stopPropagation()}>
        <div className="wc-title modal-title-row">
          {sendStep === 'details' ? 'Send Payment' : sendStep === 'processing' ? 'Payment Submitted' : hasPayMePin ? 'Enter Payment PIN' : 'Create Payment PIN'}
          <button className="icon-btn" onClick={onClose} aria-label="Close send payment">
            <X size={20} />
          </button>
        </div>
        <div className="wc-sub">
          {sendStep === 'details'
            ? 'Send USDC or EURC instantly to any wallet or Cavopay user.'
            : sendStep === 'processing'
              ? 'Your transfer is on its way. The receipt will appear after network confirmation.'
              : hasPayMePin
                ? 'Approve this exact payment. Your PIN is verified securely by Cavopay.'
                : 'Create a 4-digit Payment PIN. You will use it to approve everyday sends.'}
        </div>

        {sendStep === 'details' ? (
          <div className="form-stack">
            {scannedRecipient && (
              <div className="scanned-recipient-card">
                <div className="scanned-recipient-avatar">
                  {scannedRecipient.username.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <span>Scanned Cavopay user</span>
                  <strong>@{scannedRecipient.username}</strong>
                  <small>{shortenAddress(scannedRecipient.wallet_address)}</small>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">To</label>
              <input
                type="text"
                value={sendDest}
                onChange={(event) => onRecipientChange(event.target.value)}
                placeholder="0x Address or @username"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Token</label>
              <select value={sendToken} onChange={(event) => onTokenChange(event.target.value as SendToken)} className="form-input">
                <option value="USDC">USDC</option>
                <option value="EURC">EURC</option>
              </select>
            </div>

            {sendDest.trim().startsWith('0x') && (
              <div className="form-group">
                <label className="form-label">Destination chain</label>
                <select
                  value={destinationChain}
                  onChange={(event) => onDestinationChainChange(event.target.value)}
                  disabled={sendToken === 'EURC'}
                  className="form-input"
                >
                  {chains.map(chain => (
                    <option key={chain.value} value={chain.value}>{chain.label}</option>
                  ))}
                </select>
                {sendToken === 'EURC' && (
                  <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 8 }}>
                    EURC is Arc-only right now.
                  </p>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Amount ({sendToken})</label>
              <input
                type="number"
                value={sendAmount}
                onChange={(event) => onAmountChange(event.target.value)}
                placeholder="0.00"
                className="form-input"
              />
            </div>

            {sendError && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 4 }}>{sendError}</div>}

            <button onClick={onSend} disabled={!sendAmount || !sendDest || isSending} className="btn btn-primary btn-full send-submit-btn">
              Continue
            </button>
          </div>
        ) : (
          <div className="form-stack">
            {pendingSend && (
              <div className="pin-summary">
                <div className="pin-summary-row">
                  <span>To</span>
                  <strong>{shortenAddress(pendingSend.recipientAddress)}</strong>
                </div>
                <div className="pin-summary-row">
                  <span>Amount</span>
                  <strong>{pendingSend.amount} {pendingSend.token}</strong>
                </div>
                <div className="pin-summary-row">
                  <span>Chain</span>
                  <strong>{getChainLabel(pendingSend.destinationChain)}</strong>
                </div>
              </div>
            )}

            {sendStep === 'processing' ? (
              <div className="pin-progress">
                <div className="pin-progress-ring">
                  <div className="loader" />
                </div>
                <div>
                  <strong>Transaction submitted</strong>
                  <span>Waiting for network confirmation...</span>
                </div>
              </div>
            ) : (
              <>
                <PinDotsInput
                  label={hasPayMePin ? 'Payment PIN' : 'New Payment PIN'}
                  value={paymePin}
                  onChange={onPayMePinChange}
                  disabled={isSending}
                />

                {isCreatingPin && (
                  <>
                    <PinDotsInput
                      label="Confirm PIN"
                      value={confirmPin}
                      onChange={onConfirmPinChange}
                      disabled={isSending}
                    />
                    <div className="form-group">
                      <label className="form-label">{PAYME_SECURITY_QUESTIONS[0]}</label>
                      <input
                        className="form-input"
                        placeholder="Your answer"
                        value={securityAnswerOne}
                        onChange={event => onSecurityAnswerOneChange(event.target.value)}
                        disabled={isSending}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{PAYME_SECURITY_QUESTIONS[1]}</label>
                      <input
                        className="form-input"
                        placeholder="Answer"
                        value={securityAnswerTwo}
                        onChange={event => onSecurityAnswerTwoChange(event.target.value)}
                        disabled={isSending}
                      />
                    </div>
                  </>
                )}

                {sendError && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 4 }}>{sendError}</div>}

                <button
                  onClick={onSubmitPin}
                  disabled={isSending || !canSubmitPin}
                  className="btn btn-primary btn-full send-submit-btn"
                >
                  {isSending ? 'Sending...' : hasPayMePin ? 'Approve and Send' : 'Create PIN and Send'}
                </button>
                <button onClick={onBackToDetails} disabled={isSending} className="btn btn-secondary btn-full">
                  Back
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
