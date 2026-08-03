import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatUnits, parseUnits } from 'viem'
import { Link as LinkIcon, RefreshCw, Shield, Users, X } from 'lucide-react'
import Navbar from '../components/Navbar'
import WalletButton from '../components/WalletButton'
import CopyButton from '../components/CopyButton'
import PinDotsInput from '../components/PinDotsInput'
import PaymentSuccessCelebration from '../components/PaymentSuccessCelebration'
import ScanQrModal from '../components/ScanQrModal'
import BalanceCard from '../features/dashboard/BalanceCard'
import QuickActions from '../features/dashboard/QuickActions'
import TransactionList, { type LedgerPayment, type LedgerTab } from '../features/dashboard/TransactionList'
import ContactsPanel, { type ContactEntry, type ContactTab } from '../features/contacts/ContactsPanel'
import SendPaymentModal, { type PendingSend, type SendStep, type SendToken } from '../features/send/SendPaymentModal'
import ReceiveModal from '../features/receive/ReceiveModal'
import type { BridgeStage } from '../components/BridgeStatusTimeline'
import { ARC_TESTNET_CHAIN, PAYMENT_SOURCE_CHAINS, PAYME_SECURITY_QUESTIONS, TOKENS, getPaymentSourceChain } from '../lib/config'
import {
  approvePayMePinTransaction,
  bridgeDeveloperControlledTransfer,
  claimProfile,
  createDeveloperControlledWallet,
  createPaymentLink,
  getCreatorPayments,
  getDeveloperControlledWallet,
  getPayerPayments,
  getPayMePinStatus,
  getProfile,
  getProfileByWallet,
  getTokenBalance,
  getTokenTransfers,
  getWalletTransactionStatus,
  logPayment,
  sendDeveloperControlledTransfer,
  setupPayMePin,
  updateProfileAvatar,
  type CircleWallet,
  type Payment,
  type Profile,
} from '../lib/api'
import { usePayMeAuth } from '../context/AuthContext'

type Section = 'dashboard' | 'history' | 'contacts' | 'links'

const DESTINATION_CHAINS = PAYMENT_SOURCE_CHAINS.map(chain => ({
  value: chain.value,
  label: chain.label,
}))

const shorten = (address?: string | null) => {
  if (!address) return 'Unknown'
  if (!address.startsWith('0x') || address.length < 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const getDestinationChainLabel = (value?: string) =>
  DESTINATION_CHAINS.find(chain => chain.value === value)?.label || 'Arc Testnet'

function getTxHash(value: any): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  if (Array.isArray(value)) {
    for (const item of value) {
      const hash = getTxHash(item)
      if (hash) return hash
    }
    return undefined
  }
  for (const [key, entry] of Object.entries(value)) {
    if (/^(txHash|transactionHash|hash)$/i.test(key) && typeof entry === 'string' && /^0x[a-fA-F0-9]{64}$/.test(entry)) {
      return entry
    }
    const nested = getTxHash(entry)
    if (nested) return nested
  }
  return undefined
}

function paymentExplorerUrl(payment: Payment) {
  if (!payment.tx_hash) return '#'
  const chain = getPaymentSourceChain(payment.source_chain || payment.destination_chain || ARC_TESTNET_CHAIN)
  return `${chain.explorer}${payment.tx_hash}`
}

function normalizeAddress(value?: string | null) {
  return typeof value === 'string' ? value.toLowerCase() : ''
}

function formatLedgerAddress(value?: string | null, profileMap?: Record<string, Profile>) {
  const key = normalizeAddress(value)
  if (key && profileMap?.[key]) return `@${profileMap[key].username}`
  return shorten(value)
}

function mergePayments(logged: LedgerPayment[], onchain: LedgerPayment[]) {
  const seen = new Set<string>()
  const merged: LedgerPayment[] = []

  for (const payment of [...logged, ...onchain]) {
    const key = payment.tx_hash ? payment.tx_hash.toLowerCase() : payment.id
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(payment)
  }

  return merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

function resizeAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Choose an image file'))
      return
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('Could not load image'))
      image.onload = () => {
        const size = 320
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('Could not prepare image'))
          return
        }

        const scale = Math.max(size / image.width, size / image.height)
        const width = image.width * scale
        const height = image.height * scale
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

export default function DashboardPage() {
  const { user: authUser } = usePayMeAuth()
  const navigate = useNavigate()
  const isLoggedIn = !!authUser?.paymeSessionToken
  const activeUserKey = authUser?.userKey || ''
  const loginLabel = authUser?.email || ''

  const [section, setSection] = useState<Section>('dashboard')
  const [circleWallet, setCircleWallet] = useState<CircleWallet | null>(null)
  const [walletLoading, setWalletLoading] = useState(false)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [profileMap, setProfileMap] = useState<Record<string, Profile>>({})
  const [missingProfileAddresses, setMissingProfileAddresses] = useState<Record<string, true>>({})

  const [usdcDisplay, setUsdcDisplay] = useState('0.00')
  const [eurcDisplay, setEurcDisplay] = useState('0.00')
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [receivedPayments, setReceivedPayments] = useState<LedgerPayment[]>([])
  const [sentPayments, setSentPayments] = useState<LedgerPayment[]>([])
  const [ledgerTab, setLedgerTab] = useState<LedgerTab>('all')
  const [historyVisibleCount, setHistoryVisibleCount] = useState(8)
  const [selectedPayment, setSelectedPayment] = useState<LedgerPayment | null>(null)

  const [showClaimModal, setShowClaimModal] = useState(false)
  const [claimName, setClaimName] = useState('')
  const [claimLoading, setClaimLoading] = useState(false)
  const [claimErr, setClaimErr] = useState<string | null>(null)

  const [form, setForm] = useState({ amount: '', token: 'USDC' as SendToken, note: '', recipient: '' })
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false)
  const [isScanQrOpen, setIsScanQrOpen] = useState(false)
  const [isSendModalOpen, setIsSendModalOpen] = useState(false)
  const [sendDest, setSendDest] = useState('')
  const [sendAmount, setSendAmount] = useState('')
  const [sendToken, setSendToken] = useState<SendToken>('USDC')
  const [destinationChain, setDestinationChain] = useState(ARC_TESTNET_CHAIN)
  const [sendStep, setSendStep] = useState<SendStep>('details')
  const [pendingSend, setPendingSend] = useState<PendingSend | null>(null)
  const [paymePin, setPaymePin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [securityAnswerOne, setSecurityAnswerOne] = useState('')
  const [securityAnswerTwo, setSecurityAnswerTwo] = useState('')
  const [hasPayMePin, setHasPayMePin] = useState<boolean | null>(null)
  const [showPinSetupModal, setShowPinSetupModal] = useState(false)
  const [pinSetupLoading, setPinSetupLoading] = useState(false)
  const [pinSetupError, setPinSetupError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [bridgeStage, setBridgeStage] = useState<BridgeStage>('idle')
  const [sendSuccess, setSendSuccess] = useState<{ amount: string; token: string; recipient: string; txHash?: string } | null>(null)
  const [scannedRecipient, setScannedRecipient] = useState<Profile | null>(null)

  const [contactTab, setContactTab] = useState<ContactTab>('recent')
  const [favorites, setFavorites] = useState<ContactEntry[]>([])
  const refreshTimer = useRef<number | null>(null)
  const profileLookupInFlight = useRef<Set<string>>(new Set())
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  const paymeWalletAddress = circleWallet?.walletAddress || ''

  const allPayments = useMemo(() => {
    const received = receivedPayments.map(payment => ({ ...payment, type: 'received' as const }))
    const sent = sentPayments.map(payment => ({ ...payment, type: 'sent' as const }))
    const merged = mergePayments(received, sent)
    if (ledgerTab === 'received') return merged.filter(payment => payment.type === 'received')
    if (ledgerTab === 'sent') return merged.filter(payment => payment.type === 'sent')
    return merged
  }, [ledgerTab, receivedPayments, sentPayments])

  const dashboardPayments = useMemo(() => mergePayments(
    receivedPayments.map(payment => ({ ...payment, type: 'received' as const })),
    sentPayments.map(payment => ({ ...payment, type: 'sent' as const })),
  ), [receivedPayments, sentPayments])

  const favoritesKey = activeUserKey ? `payme.contacts.favorites:${activeUserKey}` : ''

  const updateWalletAddressCache = (walletAddress: string) => {
    if (!authUser?.userKey || !walletAddress) return
    localStorage.setItem(`payme.walletAddress:${authUser.userKey}`, walletAddress)
    window.dispatchEvent(new CustomEvent('payme:wallet-address-updated', {
      detail: { userKey: authUser.userKey, walletAddress },
    }))
  }

  const getBalanceCacheKey = (walletAddress: string) => `payme.balances:${normalizeAddress(walletAddress)}`

  const loadCachedBalances = (walletAddress: string) => {
    try {
      const cached = JSON.parse(localStorage.getItem(getBalanceCacheKey(walletAddress)) || '{}')
      if (typeof cached.usdc === 'string') setUsdcDisplay(cached.usdc)
      if (typeof cached.eurc === 'string') setEurcDisplay(cached.eurc)
    } catch {
      // Bad cache should never block fresh balance loading.
    }
  }

  const saveBalanceCache = (walletAddress: string, usdc: string, eurc: string) => {
    localStorage.setItem(getBalanceCacheKey(walletAddress), JSON.stringify({
      usdc,
      eurc,
      updatedAt: Date.now(),
    }))
  }

  const refreshProfileMap = async (addresses: string[]) => {
    const unique = Array.from(new Set(addresses.map(normalizeAddress).filter(Boolean)))
    const lookupTargets = unique.filter(item =>
      !profileMap[item]
      && !missingProfileAddresses[item]
      && !profileLookupInFlight.current.has(item)
    )
    if (lookupTargets.length === 0) return

    lookupTargets.forEach(item => profileLookupInFlight.current.add(item))
    const entries = await Promise.all(lookupTargets.map(async walletAddress => {
      try {
        const nextProfile = await getProfileByWallet(walletAddress)
        return nextProfile ? [walletAddress, nextProfile] as const : null
      } catch {
        return null
      } finally {
        profileLookupInFlight.current.delete(walletAddress)
      }
    }))

    const found = Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, Profile]>)
    if (Object.keys(found).length > 0) {
      setProfileMap(previous => ({ ...previous, ...found }))
    }
    const foundKeys = new Set(Object.keys(found))
    const notFound = lookupTargets.filter(item => !foundKeys.has(item))
    if (notFound.length > 0) {
      setMissingProfileAddresses(previous => {
        const next = { ...previous }
        notFound.forEach(item => { next[item] = true })
        return next
      })
    }
  }

  const refreshWallet = async () => {
    if (!activeUserKey) return
    setWalletLoading(true)
    setWalletError(null)
    try {
      let wallet = await getDeveloperControlledWallet(activeUserKey)
      if (!wallet.exists || !wallet.walletAddress) {
        wallet = await createDeveloperControlledWallet(activeUserKey)
      }
      setCircleWallet(wallet)
      updateWalletAddressCache(wallet.walletAddress)

      const ownerKey = wallet.ownerUserKey || activeUserKey
      const nextProfile = await getProfileByWallet(ownerKey)
        .catch(() => null)
        || await getProfileByWallet(wallet.walletAddress).catch(() => null)
      setProfile(nextProfile)
      if (nextProfile) {
        setProfileMap(previous => ({
          ...previous,
          [normalizeAddress(ownerKey)]: nextProfile,
          [normalizeAddress(wallet.walletAddress)]: nextProfile,
        }))
      }
      setShowClaimModal(!nextProfile)
    } catch (error: any) {
      setWalletError(error.message || 'Failed to load Cavopay wallet')
    } finally {
      setWalletLoading(false)
    }
  }

  const refreshBalances = async () => {
    if (!paymeWalletAddress) return
    setBalanceLoading(true)
    try {
      const [usdc, eurc] = await Promise.all([
        getTokenBalance(paymeWalletAddress, TOKENS.USDC.address),
        getTokenBalance(paymeWalletAddress, TOKENS.EURC.address),
      ])
      const nextUsdc = Number(formatUnits(usdc, TOKENS.USDC.decimals)).toFixed(2)
      const nextEurc = Number(formatUnits(eurc, TOKENS.EURC.decimals)).toFixed(2)
      setUsdcDisplay(nextUsdc)
      setEurcDisplay(nextEurc)
      saveBalanceCache(paymeWalletAddress, nextUsdc, nextEurc)
    } catch (error) {
      console.warn('Balance refresh failed:', error)
    } finally {
      setBalanceLoading(false)
    }
  }

  const getOnchainTokenTransfers = async (walletAddress: string) => {
    const transfers = await Promise.all([
      getTokenTransfers(walletAddress, TOKENS.USDC.address).catch(() => []),
      getTokenTransfers(walletAddress, TOKENS.EURC.address).catch(() => []),
    ])

    return transfers.flat().map((transfer: any): LedgerPayment => {
      const token = (transfer.tokenSymbol || transfer.tokenName || '').toUpperCase().includes('EUR') ? 'EURC' : 'USDC'
      const decimals = Number(transfer.tokenDecimal || TOKENS[token as SendToken].decimals)
      const rawValue = BigInt(transfer.value || 0)
      const from = transfer.from || ''
      const to = transfer.to || ''
      const isReceived = normalizeAddress(to) === normalizeAddress(walletAddress)
      return {
        id: `chain-${transfer.hash}-${transfer.logIndex || transfer.transactionIndex || ''}-${isReceived ? 'in' : 'out'}`,
        link_id: '',
        payer_address: from,
        recipient_address: to,
        destination_chain: ARC_TESTNET_CHAIN,
        source_chain: ARC_TESTNET_CHAIN,
        tx_hash: transfer.hash,
        amount: Number(formatUnits(rawValue, decimals)),
        token,
        created_at: transfer.timeStamp ? new Date(Number(transfer.timeStamp) * 1000).toISOString() : new Date().toISOString(),
        type: isReceived ? 'received' : 'sent',
      }
    })
  }

  const refreshLedger = async () => {
    if (!paymeWalletAddress) return
    setLedgerLoading(true)
    try {
      const [creatorRows, payerRows, onchainRows] = await Promise.all([
        getCreatorPayments(paymeWalletAddress),
        getPayerPayments(paymeWalletAddress),
        getOnchainTokenTransfers(paymeWalletAddress),
      ])
      const receivedLogged = creatorRows.map(payment => ({ ...payment, type: 'received' as const }))
      const sentLogged = payerRows.map(payment => ({ ...payment, type: 'sent' as const }))
      const receivedOnchain = onchainRows.filter(payment => payment.type === 'received')
      const sentOnchain = onchainRows.filter(payment => payment.type === 'sent')
      setReceivedPayments(mergePayments(receivedLogged, receivedOnchain))
      setSentPayments(mergePayments(sentLogged, sentOnchain))

      const counterpartyAddresses = [...receivedLogged, ...sentLogged, ...onchainRows].flatMap(payment => [
        payment.payer_address,
        payment.recipient_address,
        payment.payment_links?.creator_address,
      ]).filter(Boolean) as string[]
      refreshProfileMap(counterpartyAddresses)
    } catch (error) {
      console.warn('Ledger refresh failed:', error)
    } finally {
      setLedgerLoading(false)
    }
  }

  const refreshPayMePinStatus = async () => {
    if (!activeUserKey) return
    try {
      const status = await getPayMePinStatus(activeUserKey)
      setHasPayMePin(status.hasPin)
    } catch (error) {
      console.warn('Cavopay PIN status failed:', error)
    }
  }

  useEffect(() => {
    if (!activeUserKey) return
    refreshWallet()
    refreshPayMePinStatus()
  }, [activeUserKey])

  useEffect(() => {
    if (!paymeWalletAddress) return
    loadCachedBalances(paymeWalletAddress)
    refreshBalances()
    refreshLedger()
    if (refreshTimer.current) window.clearInterval(refreshTimer.current)
    refreshTimer.current = window.setInterval(() => {
      refreshBalances()
      refreshLedger()
    }, 12000)
    return () => {
      if (refreshTimer.current) window.clearInterval(refreshTimer.current)
    }
  }, [paymeWalletAddress])

  const handleQrScan = async (value: string) => {
    setIsScanQrOpen(false)
    const trimmed = value.trim()
    if (!trimmed) return

    try {
      const parsed = new URL(trimmed, window.location.origin)
      if (parsed.origin === window.location.origin && parsed.pathname.startsWith('/u/')) {
        const username = decodeURIComponent(parsed.pathname.replace(/^\/u\//, '')).replace(/^@/, '').trim()
        if (!username) return
        const scannedProfile = await getProfile(username)
        setScannedRecipient(scannedProfile)
        openSend(`@${scannedProfile.username}`, scannedProfile)
        return
      }
      if (parsed.origin === window.location.origin && parsed.pathname.startsWith('/pay/')) {
        navigate(`${parsed.pathname}${parsed.search}${parsed.hash}`)
        return
      }
      window.location.href = trimmed
    } catch {
      setSendDest(trimmed)
      openSend(trimmed)
    }
  }

  useEffect(() => {
    if (!favoritesKey) return
    try {
      const stored = JSON.parse(localStorage.getItem(favoritesKey) || '[]')
      setFavorites(Array.isArray(stored) ? stored : [])
    } catch {
      setFavorites([])
    }
  }, [favoritesKey])

  useEffect(() => {
    if (!profile || hasPayMePin !== false || showClaimModal) return
    setPaymePin('')
    setConfirmPin('')
    setSecurityAnswerOne('')
    setSecurityAnswerTwo('')
    setPinSetupError(null)
    setShowPinSetupModal(true)
  }, [profile, hasPayMePin, showClaimModal])

  const saveFavorites = (nextFavorites: ContactEntry[]) => {
    setFavorites(nextFavorites)
    if (favoritesKey) localStorage.setItem(favoritesKey, JSON.stringify(nextFavorites))
  }

  const toggleFavorite = (contactAddress: string) => {
    const key = normalizeAddress(contactAddress)
    if (!key) return
    const existing = favorites.some(item => normalizeAddress(item.address) === key)
    if (existing) {
      saveFavorites(favorites.filter(item => normalizeAddress(item.address) !== key))
      return
    }
    saveFavorites([
      ...favorites,
      {
        address: contactAddress,
        username: profileMap[key]?.username,
        avatarUrl: profileMap[key]?.avatar_url,
        lastPayment: new Date().toISOString(),
        token: '',
        type: 'favorite',
      },
    ])
  }

  const toContactEntries = (payments: LedgerPayment[], addressSelector: (payment: LedgerPayment) => string | undefined | null) => {
    const byAddress = new Map<string, ContactEntry>()
    for (const payment of payments) {
      const contactAddress = addressSelector(payment)
      const key = normalizeAddress(contactAddress)
      if (!key || key === normalizeAddress(paymeWalletAddress)) continue
      const existing = byAddress.get(key)
      if (existing && new Date(existing.lastPayment) >= new Date(payment.created_at)) continue
      byAddress.set(key, {
        address: contactAddress || key,
        username: profileMap[key]?.username,
        avatarUrl: profileMap[key]?.avatar_url,
        lastPayment: payment.created_at,
        token: payment.token,
        type: payment.type,
      })
    }
    return Array.from(byAddress.values()).sort((a, b) => new Date(b.lastPayment).getTime() - new Date(a.lastPayment).getTime())
  }

  const recentSentContacts = useMemo(() => toContactEntries(sentPayments, payment =>
    payment.recipient_address || payment.payment_links?.creator_address,
  ), [sentPayments, profileMap, paymeWalletAddress])

  const receivedFromContacts = useMemo(() => toContactEntries(receivedPayments, payment =>
    payment.payer_address,
  ), [receivedPayments, profileMap, paymeWalletAddress])

  const profileUrl = profile ? `${window.location.origin}/u/${profile.username}` : ''

  const createLink = async () => {
    const targetAddress = form.recipient.trim() || paymeWalletAddress
    if (!targetAddress) {
      setCreateError('Cavopay wallet is still loading')
      return
    }
    setCreateLoading(true)
    setCreateError(null)
    setGeneratedLink(null)
    try {
      let creatorAddress = targetAddress
      if (!creatorAddress.startsWith('0x')) {
        const username = creatorAddress.replace('@', '').toLowerCase()
        const targetProfile = await getProfile(username)
        creatorAddress = targetProfile.wallet_address
      }
      const link = await createPaymentLink({
        creatorAddress,
        amount: form.amount,
        token: form.token,
        note: form.note,
      })
      setGeneratedLink(link.linkUrl)
    } catch (error: any) {
      setCreateError(error.message || 'Failed to create payment link')
    } finally {
      setCreateLoading(false)
    }
  }

  const claimUsername = async () => {
    if (!claimName || !paymeWalletAddress || !activeUserKey) return
    setClaimLoading(true)
    setClaimErr(null)
    try {
      const nextProfile = await claimProfile({ username: claimName, walletAddress: activeUserKey })
      setProfile(nextProfile)
      setProfileMap(previous => ({
        ...previous,
        [normalizeAddress(activeUserKey)]: nextProfile,
        [normalizeAddress(paymeWalletAddress)]: nextProfile,
      }))
      setShowClaimModal(false)
      if (hasPayMePin === false) {
        setPaymePin('')
        setConfirmPin('')
        setSecurityAnswerOne('')
        setSecurityAnswerTwo('')
        setPinSetupError(null)
        setShowPinSetupModal(true)
      }
    } catch (error: any) {
      setClaimErr(error.message || 'Failed to claim username')
    } finally {
      setClaimLoading(false)
    }
  }

  const saveProfileToMaps = (nextProfile: Profile) => {
    setProfile(nextProfile)
    setProfileMap(previous => ({
      ...previous,
      [normalizeAddress(activeUserKey)]: nextProfile,
      [normalizeAddress(paymeWalletAddress)]: nextProfile,
      [normalizeAddress(nextProfile.owner_address)]: nextProfile,
      [normalizeAddress(nextProfile.wallet_address)]: nextProfile,
    }))
  }

  const selectAvatarFile = () => {
    if (!profile || avatarUploading) return
    avatarInputRef.current?.click()
  }

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !profile) return

    setAvatarUploading(true)
    setAvatarError(null)
    try {
      const avatarUrl = await resizeAvatarFile(file)
      const nextProfile = await updateProfileAvatar(profile.username, avatarUrl)
      saveProfileToMaps(nextProfile)
    } catch (error: any) {
      setAvatarError(error.message || 'Failed to update profile picture')
    } finally {
      setAvatarUploading(false)
    }
  }

  const createPaymentPin = async () => {
    if (!activeUserKey) return
    if (paymePin.length !== 4 || confirmPin.length !== 4) {
      setPinSetupError('Enter and confirm your 4-digit Payment PIN')
      return
    }
    if (paymePin !== confirmPin) {
      setPinSetupError('Payment PINs do not match')
      return
    }
    if (!securityAnswerOne.trim() || !securityAnswerTwo.trim()) {
      setPinSetupError('Answer both security questions')
      return
    }

    setPinSetupLoading(true)
    setPinSetupError(null)
    try {
      await setupPayMePin({
        userKey: activeUserKey,
        pin: paymePin,
        recoveryAnswers: [securityAnswerOne, securityAnswerTwo],
      })
      setHasPayMePin(true)
      setShowPinSetupModal(false)
      setPaymePin('')
      setConfirmPin('')
      setSecurityAnswerOne('')
      setSecurityAnswerTwo('')
    } catch (error: any) {
      setPinSetupError(error.message || 'Failed to create Payment PIN')
    } finally {
      setPinSetupLoading(false)
    }
  }

  const openSend = (target?: string, scannedProfile?: Profile | null) => {
    setSendDest(target || '')
    setScannedRecipient(scannedProfile || null)
    setSendAmount('')
    setSendToken('USDC')
    setDestinationChain(ARC_TESTNET_CHAIN)
    setSendStep('details')
    setPendingSend(null)
    setPaymePin('')
    setConfirmPin('')
    setSecurityAnswerOne('')
    setSecurityAnswerTwo('')
    setBridgeStage('idle')
    setSendError(null)
    setIsSendModalOpen(true)
  }

  const closeSend = () => {
    if (isSending) return
    setIsSendModalOpen(false)
    setSendError(null)
    setScannedRecipient(null)
  }

  const prepareSend = async () => {
    if (!sendDest.trim() || !sendAmount || !circleWallet?.walletId || !paymeWalletAddress) return
    setSendError(null)
    setIsSending(true)
    try {
      let recipientAddress = sendDest.trim()
      let isUsername = false
      if (!recipientAddress.startsWith('0x')) {
        const username = recipientAddress.replace('@', '').toLowerCase()
        const targetProfile = await getProfile(username)
        recipientAddress = targetProfile.wallet_address
        isUsername = true
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
        throw new Error('Recipient must be a valid wallet address or Cavopay username')
      }
      setPendingSend({
        recipientAddress,
        amount: sendAmount,
        destinationChain: sendToken === 'EURC' ? ARC_TESTNET_CHAIN : destinationChain,
        token: sendToken,
        isUsername,
      })
      setSendStep('pin')
    } catch (error: any) {
      setSendError(error.message || 'Failed to prepare payment')
    } finally {
      setIsSending(false)
    }
  }

  const addPendingSentPayment = (send: PendingSend, trackingId?: string) => {
    const id = trackingId ? `pending-${trackingId}` : `pending-${Date.now()}`
    const pendingPayment: LedgerPayment = {
      id,
      link_id: '',
      payer_address: paymeWalletAddress,
      recipient_address: send.recipientAddress,
      source_chain: ARC_TESTNET_CHAIN,
      destination_chain: send.destinationChain,
      tx_hash: '',
      amount: Number(send.amount),
      token: send.token,
      created_at: new Date().toISOString(),
      type: 'sent',
    }
    setSentPayments(previous => mergePayments([pendingPayment], previous))
    return id
  }

  const removePendingSentPayment = (pendingId?: string) => {
    if (!pendingId) return
    setSentPayments(previous => previous.filter(payment => payment.id !== pendingId))
  }

  const findRecentOutgoingTransferHash = async (send: PendingSend, startedAt: number) => {
    const token = TOKENS[send.token]
    const expectedAmount = parseUnits(send.amount, token.decimals)
    const transfers = await getTokenTransfers(paymeWalletAddress, token.address).catch(() => [])
    const match = transfers.find((transfer: any) => {
      const from = String(transfer.from || '').toLowerCase()
      const value = BigInt(transfer.value || 0)
      const timestamp = Number(transfer.timeStamp || 0) * 1000
      return from === paymeWalletAddress.toLowerCase()
        && value === expectedAmount
        && timestamp >= startedAt - 30000
        && /^0x[a-fA-F0-9]{64}$/.test(String(transfer.hash || ''))
    })
    return match?.hash as string | undefined
  }

  const waitForTrackedTransaction = async (trackingId: string, send: PendingSend, startedAt: number) => {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      await wait(attempt === 0 ? 1200 : 2500)
      const status = await getWalletTransactionStatus(trackingId)
      const txHash = status.txHash || getTxHash(status)
      if (txHash) return txHash
      const arcHash = await findRecentOutgoingTransferHash(send, startedAt)
      if (arcHash) return arcHash
      refreshBalances()
      refreshLedger()
    }
    return undefined
  }

  const completePayMePinSend = async () => {
    if (!pendingSend || !circleWallet?.walletId || !paymeWalletAddress || !activeUserKey) return
    if (!hasPayMePin && paymePin !== confirmPin) {
      setSendError('Payment PINs do not match')
      return
    }
    setIsSending(true)
    setSendError(null)
    setSendStep('processing')
    setBridgeStage('preparing')
    try {
      if (!hasPayMePin) {
        if (!securityAnswerOne.trim() || !securityAnswerTwo.trim()) {
          throw new Error('Answer both security questions before creating your Payment PIN')
        }
        await setupPayMePin({
          userKey: activeUserKey,
          pin: paymePin,
          recoveryAnswers: [securityAnswerOne, securityAnswerTwo],
        })
        setHasPayMePin(true)
      }

      const approval = await approvePayMePinTransaction({
        userKey: activeUserKey,
        pin: paymePin,
        walletAddress: paymeWalletAddress,
        walletId: circleWallet.walletId,
        destinationAddress: pendingSend.recipientAddress,
        destinationChain: pendingSend.destinationChain,
        amount: pendingSend.amount,
        token: pendingSend.token,
      })

      setBridgeStage('submitting')
      const submittedAt = Date.now()
      const result = pendingSend.destinationChain === ARC_TESTNET_CHAIN
        ? await sendDeveloperControlledTransfer({
            userKey: activeUserKey,
            walletAddress: paymeWalletAddress,
            walletId: circleWallet.walletId,
            destinationAddress: pendingSend.recipientAddress,
            destinationChain: pendingSend.destinationChain,
            amount: pendingSend.amount,
            token: pendingSend.token,
            approvalId: approval.approvalId,
          })
        : await bridgeDeveloperControlledTransfer({
            userKey: activeUserKey,
            walletAddress: paymeWalletAddress,
            walletId: circleWallet.walletId,
            destinationAddress: pendingSend.recipientAddress,
            destinationChain: pendingSend.destinationChain,
            amount: pendingSend.amount,
            approvalId: approval.approvalId,
          })

      setBridgeStage('confirming')
      let txHash = getTxHash(result)
      const trackingId = result.trackingId
      const pendingPaymentId = !txHash ? addPendingSentPayment(pendingSend, trackingId) : undefined

      if (!txHash && trackingId) {
        txHash = await waitForTrackedTransaction(trackingId, pendingSend, submittedAt)
      }

      if (txHash) {
        setBridgeStage('recording')
        removePendingSentPayment(pendingPaymentId)
        await logPayment({
          payerAddress: paymeWalletAddress,
          recipientAddress: pendingSend.recipientAddress,
          sourceChain: ARC_TESTNET_CHAIN,
          destinationChain: pendingSend.destinationChain,
          txHash,
          amount: pendingSend.amount,
          token: pendingSend.token,
        })
      } else {
        console.warn('Payment submitted but the backend has not returned a transaction hash yet:', result)
      }

      setBridgeStage('complete')
      setSendSuccess({
        amount: pendingSend.amount,
        token: pendingSend.token,
        recipient: pendingSend.isUsername ? sendDest : pendingSend.recipientAddress,
        txHash,
      })
      setIsSendModalOpen(false)
      await wait(2500)
      refreshBalances()
      refreshLedger()
    } catch (error: any) {
      setBridgeStage('error')
      setSendStep('pin')
      setSendError(error.message || 'Payment failed')
    } finally {
      setIsSending(false)
      setPaymePin('')
    }
  }

  const getCounterpartyLabel = (payment: LedgerPayment) => {
    const isReceived = payment.type === 'received'
    const value = isReceived
      ? payment.payer_address
      : payment.recipient_address || payment.payment_links?.creator_address
    return `${isReceived ? 'From' : 'To'}: ${formatLedgerAddress(value, profileMap)}`
  }

  const renderTransactionReceipt = () => {
    if (!selectedPayment) return null

    const isReceived = selectedPayment.type === 'received'
    const status = selectedPayment.tx_hash ? 'Completed' : 'Pending'
    const counterpartyAddress = isReceived
      ? selectedPayment.payer_address
      : selectedPayment.recipient_address || selectedPayment.payment_links?.creator_address
    const sourceChain = getDestinationChainLabel(selectedPayment.source_chain || ARC_TESTNET_CHAIN)
    const destinationChain = getDestinationChainLabel(selectedPayment.destination_chain || ARC_TESTNET_CHAIN)
    const explorerUrl = paymentExplorerUrl(selectedPayment)
    const amountPrefix = isReceived ? '+' : '-'

    return (
      <div className="wc-modal" onClick={() => setSelectedPayment(null)}>
        <div className="card glass receipt-card" onClick={event => event.stopPropagation()}>
          <div className="receipt-header">
            <div>
              <span className={`receipt-status ${selectedPayment.tx_hash ? 'success' : 'pending'}`}>{status}</span>
              <h2>Transaction Receipt</h2>
              <p>{isReceived ? 'Incoming stablecoin payment' : 'Outgoing stablecoin payment'}</p>
            </div>
            <button className="receipt-close icon-btn" onClick={() => setSelectedPayment(null)} aria-label="Close receipt">
              <X size={20} />
            </button>
          </div>

          <div className={`receipt-amount ${isReceived ? 'incoming' : 'outgoing'}`}>
            <span>{isReceived ? 'Received' : 'Sent'}</span>
            <strong>{amountPrefix}{selectedPayment.amount} {selectedPayment.token}</strong>
          </div>

          <div className="receipt-section">
            <div className="receipt-row"><span>Direction</span><strong>{isReceived ? 'Received' : 'Sent'}</strong></div>
            <div className="receipt-row"><span>{isReceived ? 'From' : 'To'}</span><strong>{formatLedgerAddress(counterpartyAddress, profileMap)}</strong></div>
            <div className="receipt-row"><span>Your Cavopay wallet</span><strong>{shorten(paymeWalletAddress)}</strong></div>
            <div className="receipt-row"><span>Date</span><strong>{fmtDate(selectedPayment.created_at)}</strong></div>
          </div>

          <div className="receipt-section">
            <div className="receipt-row"><span>Asset</span><strong>{selectedPayment.token}</strong></div>
            <div className="receipt-row"><span>Source network</span><strong>{sourceChain}</strong></div>
            <div className="receipt-row"><span>Settlement network</span><strong>{destinationChain}</strong></div>
            {selectedPayment.link_id && <div className="receipt-row"><span>Payment link ID</span><strong>{selectedPayment.link_id}</strong></div>}
            {selectedPayment.payment_links?.note && <div className="receipt-row"><span>Note</span><strong>{selectedPayment.payment_links.note}</strong></div>}
          </div>

          <div className="receipt-hash-box">
            <span>Transaction hash</span>
            <div>
              <code>{selectedPayment.tx_hash || 'Waiting for confirmation'}</code>
              {selectedPayment.tx_hash && <CopyButton text={selectedPayment.tx_hash} />}
            </div>
          </div>

          <div className="receipt-actions">
            {selectedPayment.tx_hash ? (
              <a className="btn btn-primary btn-full" href={explorerUrl} target="_blank" rel="noopener noreferrer">
                View on Explorer
              </a>
            ) : (
              <button className="btn btn-secondary btn-full" disabled>Explorer available after confirmation</button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <>
        <Navbar />
        <div className="secure-screen">
          <div className="secure-card card glass">
            <h1>Secure</h1>
            <h2>Login to Cavopay</h2>
            <p>Access your Cavopay wallet, payment links, and transaction history.</p>
            <WalletButton />
          </div>
        </div>
      </>
    )
  }

  const renderSidebar = () => (
    <aside className="dashboard-sidebar">
      <button className={`side-link ${section === 'dashboard' ? 'active' : ''}`} onClick={() => setSection('dashboard')}>
        <Shield size={18} /> Dashboard
      </button>
      <button className={`side-link ${section === 'history' ? 'active' : ''}`} onClick={() => setSection('history')}>
        <RefreshCw size={18} /> History
      </button>
      <button className={`side-link ${section === 'contacts' ? 'active' : ''}`} onClick={() => setSection('contacts')}>
        <Users size={18} /> Contacts
      </button>
      <button className={`side-link ${section === 'links' ? 'active' : ''}`} onClick={() => setSection('links')}>
        <LinkIcon size={18} /> Links
      </button>
    </aside>
  )

  return (
    <>
      <Navbar username={profile?.username} />
      <main className="dashboard-layout">
        {renderSidebar()}
        <section className="dashboard-main">
          {section === 'dashboard' && (
            <>
              <div className="dashboard-hero">
                <button
                  type="button"
                  className={`avatar-ring avatar-upload-button ${avatarUploading ? 'is-uploading' : ''}`}
                  onClick={selectAvatarFile}
                  title={profile ? 'Change profile picture' : 'Claim a username first'}
                  disabled={!profile || avatarUploading}
                >
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={`${profile.username} profile`} />
                  ) : (
                    profile?.username?.[0]?.toUpperCase() || loginLabel?.[0]?.toUpperCase() || 'P'
                  )}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="visually-hidden"
                  onChange={handleAvatarFileChange}
                />
                <div>
                  <h1>Dashboard</h1>
                  {profile && <div className="profile-pill">@{profile.username}</div>}
                  {walletLoading && <p className="muted-small">Creating your Cavopay wallet...</p>}
                  {walletError && <p style={{ color: 'var(--red)', fontSize: 13 }}>{walletError}</p>}
                  {avatarError && <p style={{ color: 'var(--red)', fontSize: 13 }}>{avatarError}</p>}
                </div>
              </div>

              <div className="dashboard-grid-top">
                <BalanceCard
                  walletAddress={paymeWalletAddress}
                  usdcDisplay={usdcDisplay}
                  eurcDisplay={eurcDisplay}
                  syncing={balanceLoading && !!paymeWalletAddress}
                  shortenAddress={shorten}
                />
                <QuickActions
                  profile={profile}
                  disabled={!paymeWalletAddress}
                  onSend={() => openSend()}
                  onReceive={() => setIsReceiveModalOpen(true)}
                  onScanQr={() => setIsScanQrOpen(true)}
                />
              </div>

              <TransactionList
                activeTab="all"
                loading={ledgerLoading}
                payments={dashboardPayments}
                receivedCount={receivedPayments.length}
                sentCount={sentPayments.length}
                visibleCount={4}
                showViewAll
                onTabChange={setLedgerTab}
                onSelectPayment={setSelectedPayment}
                onViewAll={() => setSection('history')}
                formatDate={fmtDate}
                getCounterpartyLabel={getCounterpartyLabel}
                getExplorerUrl={paymentExplorerUrl}
              />
            </>
          )}

          {section === 'history' && (
            <>
              <div className="page-heading">
                <h1>Transaction History</h1>
                <p>View and filter all incoming and outgoing stablecoin payments.</p>
              </div>
              <TransactionList
                activeTab={ledgerTab}
                loading={ledgerLoading}
                payments={allPayments}
                receivedCount={receivedPayments.length}
                sentCount={sentPayments.length}
                visibleCount={historyVisibleCount}
                onTabChange={(tab) => {
                  setLedgerTab(tab)
                  setHistoryVisibleCount(8)
                }}
                onSelectPayment={setSelectedPayment}
                formatDate={fmtDate}
                getCounterpartyLabel={getCounterpartyLabel}
                getExplorerUrl={paymentExplorerUrl}
              />
              {allPayments.length > historyVisibleCount && (
                <button className="btn btn-secondary btn-full" style={{ marginTop: 16 }} onClick={() => setHistoryVisibleCount(count => count + 8)}>
                  Load More
                </button>
              )}
            </>
          )}

          {section === 'contacts' && (
            <>
              <div className="page-heading">
                <h1>Contacts</h1>
                <p>Recently paid addresses, saved favorites, and people who paid you.</p>
              </div>
              <ContactsPanel
                activeTab={contactTab}
                favorites={favorites}
                recentSent={recentSentContacts}
                receivedFrom={receivedFromContacts}
                formatDate={fmtDate}
                isFavorite={(contactAddress) => favorites.some(item => normalizeAddress(item.address) === normalizeAddress(contactAddress))}
                onSend={openSend}
                onTabChange={setContactTab}
                onToggleFavorite={toggleFavorite}
                shortenAddress={shorten}
              />
            </>
          )}

          {section === 'links' && (
            <>
              <div className="page-heading">
                <h1>Links</h1>
                <p>Create and share Cavopay payment links.</p>
              </div>
              <div className="card glass links-create-card">
                <div className="form-stack">
                  <div className="form-group">
                    <label className="form-label">Recipient address or username</label>
                    <input
                      className="form-input"
                      value={form.recipient}
                      onChange={event => setForm({ ...form, recipient: event.target.value })}
                      placeholder={paymeWalletAddress || '0x address or @username'}
                    />
                    <p className="muted-small">Leave blank to use your Cavopay wallet.</p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount</label>
                    <input
                      className="form-input"
                      value={form.amount}
                      onChange={event => setForm({ ...form, amount: event.target.value })}
                      placeholder="0.00"
                      type="number"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Token</label>
                    <select className="form-input" value={form.token} onChange={event => setForm({ ...form, token: event.target.value as SendToken })}>
                      <option value="USDC">USDC</option>
                      <option value="EURC">EURC</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Note</label>
                    <input
                      className="form-input"
                      value={form.note}
                      onChange={event => setForm({ ...form, note: event.target.value })}
                      placeholder="Optional note"
                    />
                  </div>
                  {createError && <div className="error-text">{createError}</div>}
                  <button className="btn btn-primary btn-full" onClick={createLink} disabled={createLoading || !paymeWalletAddress}>
                    {createLoading ? 'Creating...' : 'Create Payment Link'}
                  </button>
                  {generatedLink && (
                    <div className="link-box">
                      <span className="link-url">{generatedLink}</span>
                      <CopyButton text={generatedLink} />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      {showClaimModal && paymeWalletAddress && (
        <div className="wc-modal">
          <div className="card glass wc-card">
            <h2 className="wc-title">Claim Your Username</h2>
            <p className="wc-sub">Create a permanent link to receive payments instantly into your Cavopay wallet.</p>
            <p className="claim-modal-warning">
              Important: Your username cannot be changed once claimed. Choose carefully.
            </p>
            <div className="form-stack">
              <input
                className="form-input"
                placeholder="Username (e.g. alice)"
                value={claimName}
                onChange={event => setClaimName(event.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
              />
              {claimErr && <div className="error-text">{claimErr}</div>}
              <button className="btn btn-primary btn-full" onClick={claimUsername} disabled={claimLoading || !claimName}>
                {claimLoading ? 'Claiming...' : 'Claim Username'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPinSetupModal && profile && (
        <div className="wc-modal">
          <div className="card glass wc-card">
            <h2 className="wc-title">Create Payment PIN</h2>
            <p className="wc-sub">
              Create a 4-digit Payment PIN. Cavopay will require this PIN before every in-app send.
            </p>
            <div className="form-stack">
              <PinDotsInput
                label="New Payment PIN"
                value={paymePin}
                onChange={setPaymePin}
                disabled={pinSetupLoading}
              />
              <PinDotsInput
                label="Confirm Payment PIN"
                value={confirmPin}
                onChange={setConfirmPin}
                disabled={pinSetupLoading}
              />
              <div className="form-group">
                <label className="form-label">{PAYME_SECURITY_QUESTIONS[0]}</label>
                <input
                  className="form-input"
                  placeholder="Your answer"
                  value={securityAnswerOne}
                  disabled={pinSetupLoading}
                  onChange={event => setSecurityAnswerOne(event.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{PAYME_SECURITY_QUESTIONS[1]}</label>
                <input
                  className="form-input"
                  placeholder="Your recovery answer"
                  value={securityAnswerTwo}
                  disabled={pinSetupLoading}
                  onChange={event => setSecurityAnswerTwo(event.target.value)}
                />
              </div>
              {pinSetupError && <div className="error-text">{pinSetupError}</div>}
              <button
                className="btn btn-primary btn-full"
                onClick={createPaymentPin}
                disabled={
                  pinSetupLoading
                  || paymePin.length !== 4
                  || confirmPin.length !== 4
                  || !securityAnswerOne.trim()
                  || !securityAnswerTwo.trim()
                }
              >
                {pinSetupLoading ? 'Creating PIN...' : 'Create Payment PIN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSendModalOpen && (
        <SendPaymentModal
          arcChain={ARC_TESTNET_CHAIN}
          chains={DESTINATION_CHAINS}
          confirmPin={confirmPin}
          destinationChain={destinationChain}
          hasPayMePin={hasPayMePin}
          isSending={isSending}
          paymePin={paymePin}
          pendingSend={pendingSend}
          securityAnswerOne={securityAnswerOne}
          securityAnswerTwo={securityAnswerTwo}
          sendAmount={sendAmount}
          sendDest={sendDest}
          sendError={sendError}
          sendStep={sendStep}
          sendToken={sendToken}
          scannedRecipient={scannedRecipient}
          onAmountChange={setSendAmount}
          onBackToDetails={() => setSendStep('details')}
          onClose={closeSend}
          onConfirmPinChange={setConfirmPin}
          onDestinationChainChange={setDestinationChain}
          onPayMePinChange={setPaymePin}
          onRecipientChange={setSendDest}
          onSecurityAnswerOneChange={setSecurityAnswerOne}
          onSecurityAnswerTwoChange={setSecurityAnswerTwo}
          onSend={prepareSend}
          onSubmitPin={completePayMePinSend}
          onTokenChange={(token) => {
            setSendToken(token)
            if (token === 'EURC') setDestinationChain(ARC_TESTNET_CHAIN)
          }}
          getChainLabel={getDestinationChainLabel}
          shortenAddress={shorten}
        />
      )}

      {isReceiveModalOpen && (
        <ReceiveModal
          claimError={claimErr}
          claimLoading={claimLoading}
          claimName={claimName}
          loginLabel={loginLabel}
          paymeWalletAddress={paymeWalletAddress}
          profile={profile}
          qrValue={profileUrl || paymeWalletAddress || window.location.origin}
          onClaim={claimUsername}
          onClaimNameChange={setClaimName}
          onClose={() => setIsReceiveModalOpen(false)}
        />
      )}

      {isScanQrOpen && (
        <ScanQrModal
          onClose={() => setIsScanQrOpen(false)}
          onScan={handleQrScan}
        />
      )}

      {renderTransactionReceipt()}

      {sendSuccess && (
        <PaymentSuccessCelebration
          amount={sendSuccess.amount}
          token={sendSuccess.token}
          recipient={sendSuccess.recipient}
          txHash={sendSuccess.txHash}
          explorerUrl={sendSuccess.txHash ? `${getPaymentSourceChain(ARC_TESTNET_CHAIN).explorer}${sendSuccess.txHash}` : undefined}
          onClose={() => setSendSuccess(null)}
          onSendAnother={() => {
            setSendSuccess(null)
            openSend()
          }}
        />
      )}

      <div style={{ display: 'none' }}>
        <Link to="/dashboard">Dashboard</Link>
      </div>
    </>
  )
}
