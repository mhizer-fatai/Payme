import { ArrowUpRight } from 'lucide-react'
import type { Payment } from '../../lib/api'

export type LedgerPayment = Payment & { type?: 'received' | 'sent' }
export type LedgerTab = 'all' | 'received' | 'sent'

type TransactionListProps = {
  activeTab: LedgerTab
  loading: boolean
  payments: LedgerPayment[]
  receivedCount: number
  sentCount: number
  visibleCount?: number
  showViewAll?: boolean
  onTabChange: (tab: LedgerTab) => void
  onSelectPayment: (payment: LedgerPayment) => void
  onViewAll?: () => void
  formatDate: (iso: string) => string
  getCounterpartyLabel: (payment: LedgerPayment) => string
  getExplorerUrl: (payment: Payment) => string
}

export default function TransactionList({
  activeTab,
  loading,
  payments,
  receivedCount,
  sentCount,
  visibleCount,
  showViewAll,
  onTabChange,
  onSelectPayment,
  onViewAll,
  formatDate,
  getCounterpartyLabel,
  getExplorerUrl,
}: TransactionListProps) {
  const displayedPayments = payments.slice(0, visibleCount ?? payments.length)

  return (
    <div className="card glass">
      <div className="ledger-tabs">
        <button className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => onTabChange('all')}>
          All Transactions
        </button>
        <button className={`tab-btn ${activeTab === 'received' ? 'active' : ''}`} onClick={() => onTabChange('received')}>
          Received ({receivedCount})
        </button>
        <button className={`tab-btn ${activeTab === 'sent' ? 'active' : ''}`} onClick={() => onTabChange('sent')}>
          Sent ({sentCount})
        </button>
      </div>

      {loading ? (
        <div className="load-wrap"><div className="loader" /> Fetching ledger...</div>
      ) : payments.length === 0 ? (
        <div className="empty">No transactions found</div>
      ) : (
        <div className="ledger-list">
          {displayedPayments.map(payment => {
            const isReceived = payment.type === 'received'
            const amountColor = isReceived ? 'var(--green)' : 'var(--text)'
            const sign = isReceived ? '+' : '-'
            const explorerUrl = getExplorerUrl(payment)
            const isPending = !payment.tx_hash

            return (
              <div
                className="ledger-row glass"
                key={payment.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectPayment(payment)}
                onKeyDown={(event) => { if (event.key === 'Enter') onSelectPayment(payment) }}
              >
                <div className="lr-left">
                  <div className="lr-amt" style={{ color: amountColor }}>
                    {sign}{payment.amount} {payment.token}
                  </div>
                  <div className="lr-date">
                    {isPending ? 'Pending confirmation' : formatDate(payment.created_at)}
                  </div>
                </div>
                <div className="lr-right">
                  <div className="lr-addr">
                    {getCounterpartyLabel(payment)}
                  </div>
                  {isPending ? (
                    <span className="pending-badge">Pending</span>
                  ) : (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="lr-link"
                    >
                      <ArrowUpRight size={16} />
                    </a>
                  )}
                </div>
              </div>
            )
          })}

          {showViewAll && onViewAll && payments.length > (visibleCount ?? 0) && (
            <button
              onClick={onViewAll}
              className="btn btn-ghost btn-sm btn-full view-all-btn"
            >
              View All History
            </button>
          )}

          {!showViewAll && visibleCount && payments.length > visibleCount && (
            <div className="ledger-loading-more">
              <div className="loader" style={{ width: 14, height: 14 }} /> Loading more history...
            </div>
          )}
        </div>
      )}
    </div>
  )
}
