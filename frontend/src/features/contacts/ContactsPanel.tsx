import CopyButton from '../../components/CopyButton'

export type ContactTab = 'recent' | 'favorites' | 'received'

export type ContactEntry = {
  address: string
  lastPayment: string
  token: string
  type?: 'received' | 'sent' | 'favorite'
  username?: string
  avatarUrl?: string | null
}

type ContactsPanelProps = {
  activeTab: ContactTab
  favorites: ContactEntry[]
  recentSent: ContactEntry[]
  receivedFrom: ContactEntry[]
  formatDate: (value: string) => string
  isFavorite: (address: string) => boolean
  onSend: (addressOrUsername: string) => void
  onTabChange: (tab: ContactTab) => void
  onToggleFavorite: (address: string) => void
  shortenAddress: (address: string) => string
}

const TABS: Array<{ key: ContactTab; label: string }> = [
  { key: 'recent', label: 'Recently Sent' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'received', label: 'Received From' },
]

export default function ContactsPanel({
  activeTab,
  favorites,
  recentSent,
  receivedFrom,
  formatDate,
  isFavorite,
  onSend,
  onTabChange,
  onToggleFavorite,
  shortenAddress,
}: ContactsPanelProps) {
  const contactsByTab = {
    recent: recentSent,
    favorites,
    received: receivedFrom,
  }
  const contacts = contactsByTab[activeTab]

  const emptyText = activeTab === 'favorites'
    ? 'Favorite addresses you save will appear here.'
    : activeTab === 'received'
      ? 'Addresses that pay you will appear here.'
      : 'Addresses you send to will appear here.'

  return (
    <div className="card glass">
      <div className="ledger-tabs">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label} ({contactsByTab[tab.key].length})
          </button>
        ))}
      </div>

      {contacts.length === 0 ? (
        <div className="empty">
          {emptyText}
        </div>
      ) : (
        <div className="ledger-list">
          {contacts.map(contact => {
            const favorite = isFavorite(contact.address)
            const sendTarget = contact.username ? `@${contact.username}` : contact.address
            return (
              <div
                key={`${activeTab}-${contact.address.toLowerCase()}`}
                className="ledger-row glass contact-row"
              >
                <div className="contact-info-block">
                  <div className="contact-avatar">
                    {contact.avatarUrl ? (
                      <img src={contact.avatarUrl} alt={contact.username ? `${contact.username} profile` : 'Saved contact'} />
                    ) : (
                      contact.username ? contact.username.charAt(0).toUpperCase() : contact.address.slice(2, 4).toUpperCase()
                    )}
                  </div>
                  <div className="lr-left">
                    <div className="lr-amt">
                      {contact.username ? `@${contact.username}` : shortenAddress(contact.address)}
                    </div>
                    <div className="lr-date">
                      {activeTab === 'favorites' ? 'Saved address' : `Last activity ${formatDate(contact.lastPayment)}`}
                      {contact.token ? ` · ${contact.token}` : ''}
                      {contact.username ? ` · ${shortenAddress(contact.address)}` : ''}
                    </div>
                  </div>
                </div>
                <div className="contact-actions-block">
                  <button className="btn btn-secondary btn-sm" onClick={() => onSend(sendTarget)}>Send</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => onToggleFavorite(contact.address)}>
                    {favorite ? 'Saved' : 'Favorite'}
                  </button>
                  <CopyButton text={contact.username ? `@${contact.username}` : contact.address} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
