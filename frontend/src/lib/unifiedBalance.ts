import { AppKit } from '@circle-fin/app-kit';
import { ViemAdapter, createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2';
import { SolanaKitAdapter, createSolanaKitAdapterFromProvider } from '@circle-fin/adapter-solana-kit';
import { ArcTestnet } from '@circle-fin/app-kit/chains';

let kitInstance: AppKit | null = null;
let viemAdapterInstance: ViemAdapter | null = null;
let solanaAdapterInstance: SolanaKitAdapter | null = null;

// Custom chain configs that viem doesn't know about.
// When the SDK's internal viem WalletClient calls switchChain, viem checks its
// own registry BEFORE forwarding the RPC to the wallet. Custom chains like Arc
// aren't in that registry, so viem throws "Chain not configured".
// This map lets our proxy intercept the call and use wallet_addEthereumChain
// instead, which both registers AND switches in one step.
const CUSTOM_CHAIN_ADD_PARAMS: Record<number, any> = {
  [ArcTestnet.chainId]: {
    chainId: '0x' + ArcTestnet.chainId.toString(16),
    chainName: ArcTestnet.name,
    nativeCurrency: ArcTestnet.nativeCurrency,
    rpcUrls: [...ArcTestnet.rpcEndpoints],
    blockExplorerUrls: ['https://testnet.arcscan.app'],
  },
};

/**
 * Wraps an EIP-1193 provider with a proxy that intercepts
 * wallet_switchEthereumChain for custom chains. If the target chain is
 * custom (not in viem's registry), we call wallet_addEthereumChain instead,
 * which adds the chain to the wallet AND switches to it in one step.
 */
function wrapProviderForCustomChains(provider: any): any {
  return new Proxy(provider, {
    get(target, prop, receiver) {
      if (prop === 'request') {
        return async (args: { method: string; params?: any[] }) => {
          // HACK: Force gas estimation for Arc
          if (args.method === 'eth_estimateGas') {
            try {
              const currentChainIdHex = await target.request({ method: 'eth_chainId' });
              if (currentChainIdHex.toLowerCase() === '0x4cef52') {
                return '0x493e0'; // Hardcoded 300,000 gas
              }
            } catch (e) { }
          }

          if (args.method === 'wallet_switchEthereumChain' && args.params?.[0]?.chainId) {
            const targetChainIdHex = args.params[0].chainId.toLowerCase();
            let targetChainIdNum = parseInt(targetChainIdHex, 16);
            
          
            // If it asks for 1244, we treat it as 5042002 to match the actual network.
            if (targetChainIdNum === 1244) {
              console.log('[ArcProxy] Redirecting SDK request for 1244 to 5042002.');
              targetChainIdNum = 5042002;
            }

            const addParams = CUSTOM_CHAIN_ADD_PARAMS[targetChainIdNum];

            if (addParams) {
              try {
                const currentChainIdHex = await target.request({ method: 'eth_chainId' });
                const currentChainIdNum = parseInt(currentChainIdHex, 16);

                console.log(`[ArcProxy] Switch requested to ${targetChainIdNum}. Wallet is on: ${currentChainIdNum}`);

                if (currentChainIdNum === targetChainIdNum) {
                  console.log('[ArcProxy] Already on correct network. Silently confirming to SDK.');
                  return null; // SUCCESS - No wallet popup!
                }
                
                // If we are on a different network, only then do we show the popup
                console.log(`[ArcProxy] Not on ${targetChainIdNum}. Triggering wallet_addEthereumChain.`);
                await target.request({
                  method: 'wallet_addEthereumChain',
                  params: [addParams],
                });
                return null;
              } catch (e) {
                console.warn('[ArcProxy] Silent switch failed, letting original request through:', e);
              }
            }
          }
          return target.request(args);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export async function getUnifiedBalanceKit(): Promise<AppKit> {
  if (kitInstance) return kitInstance;
  kitInstance = new AppKit();
  return kitInstance;
}

export async function getViemAdapter(externalProvider?: any): Promise<ViemAdapter> {
  if (externalProvider) {
    // Wrap the provider so custom-chain switchChain calls work
    const wrapped = wrapProviderForCustomChains(externalProvider);
    viemAdapterInstance = await createViemAdapterFromProvider({
      provider: wrapped,
    });
    return viemAdapterInstance;
  }

  if (viemAdapterInstance) return viemAdapterInstance;

  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No Ethereum wallet found');
  }

  const wrapped = wrapProviderForCustomChains(window.ethereum);
  viemAdapterInstance = await createViemAdapterFromProvider({
    provider: wrapped as any,
  });
  return viemAdapterInstance;
}

export async function getSolanaAdapter(): Promise<SolanaKitAdapter> {
  if (solanaAdapterInstance) return solanaAdapterInstance;

  if (typeof window === 'undefined' || !window.solana) {
    throw new Error('No Solana wallet found');
  }

  solanaAdapterInstance = await createSolanaKitAdapterFromProvider({
    provider: window.solana
  });

  return solanaAdapterInstance;
}

// Helper to fetch total balance across EVM and Solana
export async function fetchTotalUnifiedBalance(address: string, solanaAddress?: string) {
  const kit = await getUnifiedBalanceKit();

  let confirmed = 0;
  let pending = 0;

  try {
    const evmBalance = await kit.unifiedBalance.getBalances({
      token: 'USDC',
      sources: { address: address },
      networkType: 'testnet',
      includePending: true
    });
    confirmed += parseFloat(evmBalance.totalConfirmedBalance);
    pending += parseFloat(evmBalance.totalPendingBalance || '0');
  } catch (err) {
    console.warn('EVM balance fetch failed:', err);
  }

  if (solanaAddress) {
    try {
      const solBalance = await kit.unifiedBalance.getBalances({
        token: 'USDC',
        sources: [
          { adapter: await getSolanaAdapter() }
        ],
        networkType: 'testnet',
        includePending: true
      });
      confirmed += parseFloat(solBalance.totalConfirmedBalance);
      pending += parseFloat(solBalance.totalPendingBalance || '0');
    } catch (err) {
      console.warn('Solana balance fetch failed:', err);
    }
  }

  return {
    confirmed: confirmed.toFixed(2),
    pending: pending.toFixed(2)
  };
}
