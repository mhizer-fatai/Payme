-- Payment links and confirmed payment ledger entries.
CREATE TABLE public.payment_links (
  id UUID PRIMARY KEY,
  creator_address TEXT NOT NULL,
  amount NUMERIC,
  token TEXT NOT NULL DEFAULT 'USDC',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT payment_links_token_check
    CHECK (token IN ('USDC', 'EURC'))
);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY,
  link_id UUID REFERENCES public.payment_links(id) ON DELETE SET NULL,
  payer_address TEXT NOT NULL,
  recipient_address TEXT,
  source_chain TEXT NOT NULL DEFAULT 'Arc_Testnet',
  destination_chain TEXT NOT NULL DEFAULT 'Arc_Testnet',
  tx_hash TEXT NOT NULL UNIQUE,
  amount NUMERIC,
  token TEXT NOT NULL DEFAULT 'USDC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payments_token_check
    CHECK (token IN ('USDC', 'EURC'))
);
