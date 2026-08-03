# Cavopay - Presentation Deck

> **Track**: DeFi  
> **Network**: Arc Testnet  
> **Core Asset**: USDC & EURC  
> **One-Line Pitch**: Cavopay is a stablecoin-native payment account on Arc that lets users, creators, freelancers, and small businesses send, receive, and manage USDC/EURC through usernames, payment links, QR codes, and Circle-powered in-app wallets.

---

## Slide 1: Cover Slide

### **Cavopay**
**The Stablecoin-Native Payment Account for Everyone**

- **Subtitle**: Frictionless USDC & EURC payments on Arc powered by Circle developer-controlled wallets
- **Track**: Build on Arc - DeFi Track
- **Presenter**: Team Cavopay

---

## Slide 2: The Problem

### **Stablecoin Payments are Powerful, but UI/UX is Broken**

1. **Crypto Complexity**: End users, creators, and freelancers are forced to navigate wallet seed phrases, gas tokens, network switching, and raw hex addresses.
2. **High Friction**: Requesting a simple payment requires sharing a long 42-character address or explaining how to use a web3 browser extension.
3. **Missing Everyday Tools**: Small businesses and creators lack simple tools like reusable payment links, claimable handles, and QR codes tailored for stablecoin settlement.

---

## Slide 3: The Solution

### **Cavopay: Web2 Simplicity + Stablecoin Power**

Cavopay abstracts crypto infrastructure into a modern fintech experience:

- **Web2 Onboarding**: Login with Google or Email code — no seed phrases or EOA setup required.
- **In-App Circle Wallet**: Automatic developer-controlled wallet creation for every user.
- **Human Identities**: Claim a public `@username` for instant, readable payments.
- **Flexible Checkout**: Payment links (`/pay/:id`), public profile pages (`/u/:username`), and QR codes.
- **Arc Settlement**: Instant finality and USDC-denominated gas powered by Arc.

---

## Slide 4: Key Features & Product Demo

### **Everything Needed for Everyday Stablecoin Payments**

- **Public Profiles & Links**: Anyone can pay a Cavopay user via web3 wallet without needing a Cavopay account.
- **In-App Sends**: Send USDC/EURC directly to usernames or wallet addresses inside the dashboard.
- **4-Digit Payment PIN**: Enterprise-grade client PIN security with backend verification, salt, and pepper hashing.
- **Multi-Asset Support**: USDC and EURC balances with complete transaction history and receipts.
- **Cross-Chain Bridge**: Integrated Circle App Kit / CCTP flow for bridging USDC into Arc balances.

---

## Slide 5: Built on Arc & Circle Stack

### **Why Arc & Circle?**

- **Arc Settlement Network**: Built for stablecoin-first finance with fast block times and predictable USDC gas.
- **Circle Developer-Controlled Wallets**: Seamlessly manage user funds securely on backend APIs without managing seed phrases.
- **Circle App Kit & CCTP**: Streamlined cross-chain deposit flow bringing liquidity from external chains into Arc.
- **Smart Contracts**: On-chain payment settlement contracts for payment link validation and profile receiving on Arc Testnet.

---

## Slide 6: System Architecture

```
[ User / Web Auth ] ---> [ Cavopay Dashboard ] ---> [ Circle Developer Wallet API ]
                                 |
                                 v
[ External Payer ]  ---> [ Public Checkout ]  ---> [ Arc Smart Contracts / Settlement ]
```

1. **Auth & Wallet**: Google/Email -> Backend maps auth identity to Circle Developer-Controlled Wallet.
2. **Public Payments**: Payers visit `/pay/:linkId` or `/u/:username` -> Pay via Wagmi/Viem connected wallet on Arc.
3. **In-App Sends**: Sender enters PIN -> Backend validates PIN approval -> Executes Circle transaction on Arc.

---

## Slide 7: Current MVP Status (What's Built)

- [x] Google & Email Authentication
- [x] Automatic Circle Wallet creation & balance tracking (USDC / EURC)
- [x] Username registration (`/u/:username`)
- [x] Custom Payment Link generation (`/pay/:linkId`)
- [x] QR code generation for payments and profile sharing
- [x] PIN setup, verification, and transaction-scoped authorization
- [x] Arc Testnet smart contract deployment & integration
- [x] Transaction history logs and detailed payment receipts

---

## Slide 8: Target Market & Use Cases

- **Creators & Streamers**: Display permanent `/u/username` or QR code for audience tips and subscriptions.
- **Freelancers & Service Providers**: Send custom `/pay/:linkId` invoices with preset USDC amounts to clients.
- **Small Businesses**: Accept stablecoins online without friction or complex merchant integrations.
- **Peer-to-Peer**: Send digital dollars to friends using readable handles instead of 0x addresses.

---

## Slide 9: Future Roadmap

### **Post-Hackathon Expansion**

1. **Merchant SDK & Plugins**: Plug-and-play checkout widget for e-commerce (Shopify, WooCommerce).
2. **Invoicing & Recurring Subscriptions**: Automated recurring USDC billing for SaaS and services.
3. **Business Accounts & Multi-Sig**: Team access controls and multi-user approval workflows.
4. **Yield & Treasury Vaults**: Earn yield on idle business balances directly on Arc.

---

## Slide 10: Summary & Links

### **Cavopay — Stablecoin Payments Made Simple**

- **GitHub Repository**: [GitHub Repo](https://github.com/mhizer-fatai/Payme)
- **Live Demo**: Available on Arc Testnet
- **Contact**: Team Cavopay

*Thank you for evaluating Cavopay for the Build on Arc Hackathon!*
