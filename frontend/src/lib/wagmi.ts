import { createConfig, http } from 'wagmi'
import { injected, coinbaseWallet } from 'wagmi/connectors'
import { arcTestnet } from './config'
import { baseSepolia, arbitrumSepolia } from 'viem/chains'

export const wagmiConfig = createConfig({
  chains: [arcTestnet, baseSepolia, arbitrumSepolia],
  connectors: [
    injected(), // Handles MetaMask, TrustWallet, etc.
    coinbaseWallet({ appName: 'PayMe', preference: 'all' }),
  ],
  transports: {
    [arcTestnet.id]: http('https://rpc.testnet.arc.network'),
    [baseSepolia.id]: http('https://sepolia.base.org'),
    [arbitrumSepolia.id]: http('https://sepolia-rollup.arbitrum.io/rpc'),
  },
})
