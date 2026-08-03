import type { Config } from 'wagmi'
import { getPublicClient, readContract, switchChain } from 'wagmi/actions'
import type { Address, Hash } from 'viem'
import { ERC20_ABI } from './contracts'

export async function ensureWalletChain(config: Config, currentChainId: number | undefined, targetChainId: number) {
  if (currentChainId === targetChainId) return
  await switchChain(config, { chainId: targetChainId })
}

export async function getTokenAllowance(
  config: Config,
  chainId: number,
  token: Address,
  owner: Address,
  spender: Address,
) {
  return readContract(config, {
    address: token,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [owner, spender],
    chainId,
  })
}

export async function waitForHash(config: Config, chainId: number, hash: Hash) {
  const client = getPublicClient(config, { chainId })
  if (!client) throw new Error('No public client available for this network')
  return client.waitForTransactionReceipt({ hash })
}
