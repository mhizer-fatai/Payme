import { BACKEND_URL } from './config'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PaymentLink {
  id: string
  creator_address: string
  amount: number | null
  token: string
  note: string | null
  created_at: string
  expires_at?: string
  linkUrl?: string
  is_paid?: boolean
  tx_hash?: string | null
}

export interface Payment {
  id: string
  link_id: string
  payer_address: string
  tx_hash: string
  amount: number | null
  token: string
  created_at: string
}

export interface Profile {
  username: string
  wallet_address: string
  created_at: string
}

// ─── Links API ─────────────────────────────────────────────────────────────────

export async function createPaymentLink(payload: {
  creatorAddress: string
  amount?: string
  token: string
  note?: string
}): Promise<PaymentLink & { linkUrl: string }> {
  const res = await fetch(`${BACKEND_URL}/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || 'Failed to create payment link')
  }
  return res.json()
}

export async function getPaymentLink(id: string): Promise<PaymentLink> {
  const res = await fetch(`${BACKEND_URL}/links/${id}`)
  if (!res.ok) throw new Error('Payment link not found')
  return res.json()
}

export async function getCreatorLinks(address: string): Promise<PaymentLink[]> {
  const res = await fetch(`${BACKEND_URL}/links/creator/${address.toLowerCase()}`)
  if (!res.ok) return []
  return res.json()
}

// ─── Payments API ──────────────────────────────────────────────────────────────

export async function logPayment(payload: {
  linkId: string
  payerAddress: string
  txHash: string
  amount: string
  token: string
}): Promise<Payment> {
  const res = await fetch(`${BACKEND_URL}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || 'Failed to log payment')
  }
  return res.json()
}

export async function getCreatorPayments(address: string): Promise<Payment[]> {
  const res = await fetch(`${BACKEND_URL}/payments/creator/${address.toLowerCase()}`)
  if (!res.ok) return []
  return res.json()
}

export async function getPayerPayments(address: string): Promise<Payment[]> {
  const res = await fetch(`${BACKEND_URL}/payments/payer/${address.toLowerCase()}`)
  if (!res.ok) return []
  return res.json()
}

// ─── Profiles API ──────────────────────────────────────────────────────────────

export async function claimProfile(payload: { username: string; walletAddress: string }): Promise<Profile> {
  const res = await fetch(`${BACKEND_URL}/profiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || 'Failed to claim username')
  }
  return res.json()
}

export async function getProfile(username: string): Promise<Profile> {
  const res = await fetch(`${BACKEND_URL}/profiles/${username}`)
  if (!res.ok) throw new Error('Profile not found')
  return res.json()
}

export async function getProfileByWallet(walletAddress: string): Promise<Profile | null> {
  const res = await fetch(`${BACKEND_URL}/profiles/wallet/${walletAddress.toLowerCase()}`)
  if (!res.ok) return null
  return res.json()
}
