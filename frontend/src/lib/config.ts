import { defineChain } from 'viem'

// ─── Arc Testnet ──────────────────────────────────────────────────────────────
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: {
      name: 'Arc Explorer',
      url: 'https://testnet.arcscan.app',
    },
  },
  testnet: true,
})

// ─── Token Addresses ──────────────────────────────────────────────────────────
export const TOKENS = {
  USDC: {
    address: '0x3600000000000000000000000000000000000000' as `0x${string}`,
    symbol: 'USDC',
    decimals: 18,
    name: 'USD Coin',
    color: '#2563eb',
  },
  EURC: {
    address: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a' as `0x${string}`,
    symbol: 'EURC',
    decimals: 6,
    name: 'Euro Coin',
    color: '#059669',
  },
} as const

export const MULTICHAIN_TOKENS = {
  Base_Sepolia: {
    USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`,
  },
  Arbitrum_Sepolia: {
    USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d' as `0x${string}`,
  },
  Ethereum_Sepolia: {
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
  },
} as const

export type TokenSymbol = keyof typeof TOKENS

// ─── Contract ─────────────────────────────────────────────────────────────────
export const PAYME_CONTRACT_ADDRESS = (
  import.meta.env.VITE_PAYME_CONTRACT_ADDRESS ||
  '0xE5DEcbeEED2CFc9C59999F902Cc78Bb5fE96aC4E'
) as `0x${string}`

// ─── Backend ──────────────────────────────────────────────────────────────────
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '/api'
