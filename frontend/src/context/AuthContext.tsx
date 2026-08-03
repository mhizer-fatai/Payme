import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { completeGoogleLoginFromRedirect } from '../lib/circleAuth'
import { createPayMeSession } from '../lib/api'
import { buildGoogleUserKey, circleUserIdFromUserKey } from '../lib/devIdentity'

export type PayMeAuthUser = {
  authProvider: 'google' | 'email'
  providerUserId: string
  userKey: string
  email?: string
  displayName?: string
  circleUserId?: string
  userToken?: string
  encryptionKey?: string
  refreshToken?: string
  paymeSessionToken?: string
  paymeSessionExpiresAt?: string
}

type AuthContextValue = {
  user: PayMeAuthUser | null
  isAuthLoading: boolean
  setUser: (user: PayMeAuthUser) => void
  logout: () => void
}

const STORAGE_KEY = 'payme.authUser'
const AuthContext = createContext<AuthContextValue | null>(null)

function isGoogleCallbackUrl() {
  return window.location.pathname === '/auth/callback'
    || window.location.hash.includes('access_token')
    || window.location.hash.includes('id_token')
}

async function withPayMeSession(user: PayMeAuthUser): Promise<PayMeAuthUser> {
  const session = await createPayMeSession({
    authProvider: user.authProvider,
    providerUserId: user.providerUserId,
    email: user.email,
    displayName: user.displayName,
    userKey: user.userKey,
    userToken: user.userToken,
  })
  return {
    ...user,
    paymeSessionToken: session.token,
    paymeSessionExpiresAt: session.expiresAt,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<PayMeAuthUser | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    try {
      return JSON.parse(stored)
    } catch {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
  })
  const [isAuthLoading, setIsAuthLoading] = useState(() => {
    return isGoogleCallbackUrl()
  })
  const navigate = useNavigate()

  useEffect(() => {
    if (!isGoogleCallbackUrl()) {
      setIsAuthLoading(false)
      return
    }

    let cancelled = false
    setIsAuthLoading(true)

    completeGoogleLoginFromRedirect()
      .then(async (result) => {
        if (cancelled || !result) return
        const providerUserId = result?.oAuthInfo?.socialUserUUID || result?.oAuthInfo?.socialUserInfo?.email
        if (!providerUserId) throw new Error('Google login did not return a user id')
        const email = result?.oAuthInfo?.socialUserInfo?.email
        if (!email) throw new Error('Google login did not return an email address')
        const nextUser = await withPayMeSession({
          authProvider: 'google',
          providerUserId,
          userKey: buildGoogleUserKey(email),
          email,
          displayName: result?.oAuthInfo?.socialUserInfo?.name,
          circleUserId: circleUserIdFromUserKey(buildGoogleUserKey(email)),
          userToken: result.userToken,
          encryptionKey: result.encryptionKey,
          refreshToken: result.refreshToken,
        })
        setUserState(nextUser)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser))
        navigate('/dashboard', { replace: true })
      })
      .catch((error) => {
        console.error('Google login callback failed:', error)
        if (!cancelled) navigate('/', { replace: true })
      })
      .finally(() => {
        if (!cancelled) setIsAuthLoading(false)
      })
    return () => { cancelled = true }
  }, [navigate])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthLoading,
    setUser: (nextUser) => {
      setUserState(nextUser)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser))
      if (!nextUser.paymeSessionToken) {
        withPayMeSession(nextUser)
          .then((sessionUser) => {
            setUserState(sessionUser)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser))
          })
          .catch((error) => {
            console.error('Cavopay session creation failed:', error)
          })
      }
    },
    logout: () => {
      setUserState(null)
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem('payme.walletAddress')
      if (user?.userKey) localStorage.removeItem(`payme.walletAddress:${user.userKey}`)
    },
  }), [isAuthLoading, user])

  useEffect(() => {
    if (!user || user.paymeSessionToken) return
    let cancelled = false
    withPayMeSession(user)
      .then((sessionUser) => {
        if (cancelled) return
        setUserState(sessionUser)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser))
      })
      .catch((error) => console.error('Cavopay session refresh failed:', error))
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    const handleSessionExpired = () => {
      setUserState(null)
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem('payme.walletAddress')
      if (user?.userKey) localStorage.removeItem(`payme.walletAddress:${user.userKey}`)
      navigate('/dashboard', { replace: true })
    }

    window.addEventListener('payme:session-expired', handleSessionExpired)
    return () => window.removeEventListener('payme:session-expired', handleSessionExpired)
  }, [navigate, user?.userKey])

  if (isAuthLoading) {
    return (
      <AuthContext.Provider value={value}>
        <div className="auth-callback-screen">
          <div className="loader" />
          <div className="auth-callback-title">Finishing sign in</div>
          <div className="auth-callback-sub">Securing your Cavopay session...</div>
        </div>
      </AuthContext.Provider>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function usePayMeAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('usePayMeAuth must be used within AuthProvider')
  return ctx
}
