import { BACKEND_URL } from './config'

async function apiFetch(path: string, init?: RequestInit, timeoutMs = 12000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${BACKEND_URL}${path}`, { ...init, signal: controller.signal })
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('payme:session-expired'))
    }
    return response
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new Error('Request timed out. Please try again.')
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function getStoredPayMeSessionToken() {
  try {
    const raw = localStorage.getItem('payme.authUser')
    if (!raw) return null
    const user = JSON.parse(raw)
    return typeof user?.paymeSessionToken === 'string' ? user.paymeSessionToken : null
  } catch {
    return null
  }
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getStoredPayMeSessionToken()
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// Shared API response types.

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
  recipient_address?: string | null
  source_chain?: string
  destination_chain?: string
  tx_hash: string
  amount: number | null
  token: string
  created_at: string
  payment_links?: {
    creator_address?: string
    note?: string | null
    token?: string
  }
}

export interface Profile {
  username: string
  wallet_address: string
  owner_address?: string
  avatar_url?: string | null
  created_at: string
}

// Payment link endpoints.

export async function createPaymentLink(payload: {
  creatorAddress: string
  amount?: string
  token: string
  note?: string
}): Promise<PaymentLink & { linkUrl: string }> {
  const res = await apiFetch('/links', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || 'Failed to create payment link')
  }
  return res.json()
}

export async function getPaymentLink(id: string): Promise<PaymentLink> {
  const res = await apiFetch(`/links/${id}`)
  if (!res.ok) throw new Error('Payment link not found')
  return res.json()
}

export async function getCreatorLinks(address: string): Promise<PaymentLink[]> {
  const res = await apiFetch(`/links/creator/${address.toLowerCase()}`)
  if (!res.ok) return []
  return res.json()
}

// Payment ledger endpoints.

export async function logPayment(payload: {
  linkId?: string
  payerAddress: string
  recipientAddress?: string
  sourceChain?: string
  destinationChain?: string
  txHash: string
  amount: string
  token: string
}): Promise<Payment> {
  const res = await apiFetch('/payments', {
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
  const res = await apiFetch(`/payments/creator/${address.toLowerCase()}`)
  if (!res.ok) return []
  return res.json()
}

export async function getPayerPayments(address: string): Promise<Payment[]> {
  const res = await apiFetch(`/payments/payer/${address.toLowerCase()}`)
  if (!res.ok) return []
  return res.json()
}

export async function getTokenBalance(address: string, contractAddress: string): Promise<bigint> {
  const params = new URLSearchParams({
    address: address.toLowerCase(),
    contractaddress: contractAddress.toLowerCase(),
  })
  const res = await apiFetch(`/arcscan/token-balance?${params.toString()}`)
  if (!res.ok) throw new Error('Failed to fetch token balance')
  const data = await res.json()
  return BigInt(data?.result || 0)
}

export async function getNativeBalance(address: string): Promise<bigint> {
  const params = new URLSearchParams({
    address: address.toLowerCase(),
  })
  const res = await apiFetch(`/arcscan/native-balance?${params.toString()}`)
  if (!res.ok) throw new Error('Failed to fetch native balance')
  const data = await res.json()
  return BigInt(data?.result || 0)
}

export async function getTokenTransfers(address: string, contractAddress: string): Promise<any[]> {
  const params = new URLSearchParams({
    address: address.toLowerCase(),
    contractaddress: contractAddress.toLowerCase(),
  })
  const res = await apiFetch(`/arcscan/token-transfers?${params.toString()}`)
  if (!res.ok) throw new Error('Failed to fetch token transfer history')
  const data = await res.json()
  return Array.isArray(data?.result) ? data.result : []
}

// Cavopay profile endpoints.

export async function claimProfile(payload: { username: string; walletAddress: string }): Promise<Profile> {
  const res = await apiFetch('/profiles', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || 'Failed to claim username')
  }
  return res.json()
}

export async function getProfile(username: string): Promise<Profile> {
  const res = await apiFetch(`/profiles/${username}`)
  if (!res.ok) throw new Error('Profile not found')
  return res.json()
}

export async function getProfileByWallet(walletAddress: string): Promise<Profile | null> {
  const res = await apiFetch(`/profiles/wallet/${walletAddress.toLowerCase()}`)
  if (res.status === 404) return null
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || 'Failed to fetch profile')
  }
  return res.json()
}

export async function updateProfileAvatar(username: string, avatarUrl: string | null): Promise<Profile> {
  const res = await apiFetch(`/profiles/${username}/avatar`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ avatarUrl }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || 'Failed to update profile picture')
  }
  return res.json()
}

// Circle developer-controlled wallet endpoints.


export interface CircleWallet {
  walletAddress: string
  walletId: string
  exists: boolean
  circleUserId?: string
  ownerUserKey?: string
  walletType?: string
  balance?: any[]
}

export async function getDeveloperControlledWallet(userKey: string): Promise<CircleWallet> {
  const res = await apiFetch(`/wallets/me?userKey=${encodeURIComponent(userKey.toLowerCase())}`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || 'Failed to fetch developer-controlled wallet')
  }
  const data = await res.json()
  if (!data.exists) return { walletAddress: '', walletId: '', exists: false }
  return data
}

export async function createDeveloperControlledWallet(userKey: string): Promise<CircleWallet> {
  const res = await apiFetch('/wallets/create', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userKey }),
  }, 45000)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const detail = (err as any).details?.message || (err as any).details?.error || (err as any).details
    throw new Error(detail || (err as any).error || 'Failed to create developer-controlled wallet')
  }
  return res.json()
}

export interface WalletTransactionStatus {
  trackingId: string
  status: string
  txHash?: string | null
  destinationChain?: string
  destinationAddress?: string
  amount?: string
  token?: string
  transaction?: any
  error?: string
}

export async function sendDeveloperControlledTransfer(payload: {
  userKey: string
  walletAddress: string
  walletId: string
  destinationAddress: string
  destinationChain?: string
  amount: string
  token?: string
  approvalId: string
}): Promise<{ trackingId?: string; status: string; txHash?: string; transaction?: any }> {
  const res = await apiFetch('/wallets/send', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  }, 45000)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = (data as any).details?.message || (data as any).details?.error || (data as any).details
    throw new Error(detail || (data as any).error || 'Failed to send payment')
  }
  return data
}

export async function bridgeDeveloperControlledTransfer(payload: {
  userKey: string
  walletAddress: string
  walletId: string
  destinationAddress: string
  destinationChain: string
  amount: string
  approvalId: string
}): Promise<{ trackingId?: string; status: string; txHash?: string; destinationChain?: string; transaction?: any }> {
  const res = await apiFetch('/wallets/bridge', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  }, 120000)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = (data as any).details?.message || (data as any).details?.error || (data as any).details
    throw new Error(detail || (data as any).error || 'Failed to bridge payment')
  }
  return data
}

export async function getWalletTransactionStatus(trackingId: string): Promise<WalletTransactionStatus> {
  const res = await apiFetch(`/wallets/transactions/${encodeURIComponent(trackingId)}`, {
    headers: authHeaders(),
  }, 20000)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = (data as any).details?.message || (data as any).details?.error || (data as any).details
    throw new Error(detail || (data as any).error || 'Failed to refresh transaction status')
  }
  return data
}

export async function createSocialLoginDeviceToken(deviceId: string): Promise<{
  deviceToken: string
  deviceEncryptionKey: string
}> {
  const res = await apiFetch('/auth/social/device-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || 'Failed to create Google login device token')
  }
  return res.json()
}

export async function requestPayMeEmailCode(email: string): Promise<{
  ok: boolean
  email: string
  expiresAt: string
  cooldownSeconds: number
}> {
  const res = await apiFetch('/auth/email/request-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || 'Failed to send email code')
  }
  return res.json()
}

export async function verifyPayMeEmailCode(payload: { email: string; code: string }): Promise<{
  authProvider: 'email'
  providerUserId: string
  email: string
  userKey: string
  session: { token: string; expiresAt: string; userKey: string }
}> {
  const res = await apiFetch('/auth/email/verify-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || 'Failed to verify email code')
  }
  return res.json()
}

export async function createPayMeSession(payload: {
  authProvider: 'google' | 'email'
  providerUserId: string
  email?: string
  displayName?: string
  userKey: string
  userToken?: string
}): Promise<{ token: string; expiresAt: string; userKey: string }> {
  const res = await apiFetch('/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || 'Failed to create Cavopay session')
  }
  return res.json()
}

export async function getPayMePinStatus(userKey: string): Promise<{ hasPin: boolean; hasRecoveryQuestion?: boolean; recoveryQuestion?: string | null; recoveryQuestions?: string[] }> {
  const res = await apiFetch(`/payme-pin/status?userKey=${encodeURIComponent(userKey.toLowerCase())}`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || 'Failed to fetch Cavopay PIN status')
  }
  return res.json()
}

export async function setupPayMePin(payload: {
  userKey: string
  pin: string
  recoveryAnswers: string[]
}): Promise<{ hasPin: boolean }> {
  const res = await apiFetch('/payme-pin/setup', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || 'Failed to set Cavopay PIN')
  }
  return res.json()
}

export async function changePayMePin(payload: {
  userKey: string
  currentPin: string
  newPin: string
}): Promise<{ ok: boolean }> {
  const res = await apiFetch('/payme-pin/change', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || 'Failed to change Cavopay PIN')
  }
  return res.json()
}

export async function setPayMePinRecoveryQuestion(payload: {
  userKey: string
  pin: string
  recoveryAnswers: string[]
}): Promise<{ ok: boolean; hasRecoveryQuestion: boolean; recoveryQuestion: string; recoveryQuestions?: string[] }> {
  const res = await apiFetch('/payme-pin/recovery-question', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || 'Failed to save security question')
  }
  return res.json()
}

export async function recoverPayMePin(payload: {
  userKey: string
  recoveryAnswers: string[]
  newPin: string
}): Promise<{ ok: boolean }> {
  const res = await apiFetch('/payme-pin/recover', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || 'Failed to recover Cavopay PIN')
  }
  return res.json()
}

export async function approvePayMePinTransaction(payload: {
  userKey: string
  pin: string
  walletAddress: string
  walletId: string
  destinationAddress: string
  destinationChain?: string
  amount: string
  token?: 'USDC' | 'EURC'
  tokenOut?: 'USDC' | 'EURC'
  transactionType?: 'send' | 'swap'
}): Promise<{ approvalId: string; expiresAt: string }> {
  const res = await apiFetch('/payme-pin/approve', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || 'Failed to approve transaction')
  }
  return res.json()
}
