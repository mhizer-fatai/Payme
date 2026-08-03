const { AppKit } = require("@circle-fin/app-kit");
const { createCircleWalletsAdapter } = require("@circle-fin/adapter-circle-wallets");

const SOURCE_CHAIN = "Arc_Testnet";

const SUPPORTED_DESTINATION_CHAINS = Object.freeze({
  Arc_Testnet: {
    value: "Arc_Testnet",
    label: "Arc Testnet",
    explorer: "https://testnet.arcscan.app/tx/",
  },
  Ethereum_Sepolia: {
    value: "Ethereum_Sepolia",
    label: "Ethereum Sepolia",
    explorer: "https://sepolia.etherscan.io/tx/",
  },
  Base_Sepolia: {
    value: "Base_Sepolia",
    label: "Base Sepolia",
    explorer: "https://sepolia.basescan.org/tx/",
  },
  Arbitrum_Sepolia: {
    value: "Arbitrum_Sepolia",
    label: "Arbitrum Sepolia",
    explorer: "https://sepolia.arbiscan.io/tx/",
  },
  Optimism_Sepolia: {
    value: "Optimism_Sepolia",
    label: "OP Sepolia",
    explorer: "https://sepolia-optimism.etherscan.io/tx/",
  },
  Polygon_Amoy_Testnet: {
    value: "Polygon_Amoy_Testnet",
    label: "Polygon Amoy",
    explorer: "https://amoy.polygonscan.com/tx/",
  },
});

let adapter;
let kit;

function getArcKit() {
  if (!process.env.CIRCLE_API_KEY || !process.env.CIRCLE_ENTITY_SECRET) {
    throw Object.assign(new Error("Circle API key and entity secret are required for Arc App Kit sends"), { status: 500 });
  }
  if (!adapter) {
    adapter = createCircleWalletsAdapter({
      apiKey: process.env.CIRCLE_API_KEY,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET,
    });
  }
  if (!kit) kit = new AppKit();
  return { adapter, kit };
}

function normalizeDestinationChain(value) {
  const chain = String(value || SOURCE_CHAIN).trim();
  if (!SUPPORTED_DESTINATION_CHAINS[chain]) {
    throw Object.assign(new Error("Unsupported destination chain"), { status: 400 });
  }
  return chain;
}

function getBridgeTransactionHash(result) {
  if (!result || typeof result !== "object") return null;
  if (Array.isArray(result)) {
    for (const entry of result) {
      const hash = getBridgeTransactionHash(entry);
      if (hash) return hash;
    }
    return null;
  }
  for (const [key, entry] of Object.entries(result)) {
    if (/^(txHash|transactionHash|hash)$/i.test(key) && typeof entry === "string" && /^0x[a-fA-F0-9]{64}$/.test(entry)) {
      return entry;
    }
    const nested = getBridgeTransactionHash(entry);
    if (nested) return nested;
  }
  return null;
}

function toJsonSafe(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, toJsonSafe(entry)])
  );
}

async function bridgeUsdcFromArc({ fromAddress, toAddress, destinationChain, amount }) {
  const chain = normalizeDestinationChain(destinationChain);
  if (chain === SOURCE_CHAIN) {
    throw Object.assign(new Error("Use a same-chain send for Arc Testnet transfers"), { status: 400 });
  }

  const { adapter: circleAdapter, kit: appKit } = getArcKit();
  const result = await appKit.bridge({
    from: {
      adapter: circleAdapter,
      chain: SOURCE_CHAIN,
      address: fromAddress,
    },
    to: {
      chain,
      recipientAddress: toAddress,
      useForwarder: true,
    },
    amount,
    token: "USDC",
  });

  return {
    result: toJsonSafe(result),
    state: result?.state || "pending",
    txHash: getBridgeTransactionHash(result),
  };
}

module.exports = {
  SOURCE_CHAIN,
  SUPPORTED_DESTINATION_CHAINS,
  bridgeUsdcFromArc,
  normalizeDestinationChain,
};
