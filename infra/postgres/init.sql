-- Mülk Chain local schema: investors, auction orders, matched trades, DvP legs.
CREATE TABLE IF NOT EXISTS investors (
    investor_id TEXT PRIMARY KEY,
    wallet TEXT NOT NULL,
    onchain_id TEXT NOT NULL,
    iban TEXT,
    kyc_status TEXT NOT NULL DEFAULT 'PENDING_KYC',
    investor_class TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,
    interval_id TEXT NOT NULL,
    investor_id TEXT NOT NULL REFERENCES investors (investor_id),
    asset_id TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
    price NUMERIC NOT NULL,
    quantity NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trades (
    trade_id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    buy_order_id TEXT,
    sell_order_id TEXT,
    quantity NUMERIC NOT NULL,
    price NUMERIC NOT NULL,
    cash_amount NUMERIC NOT NULL,
    dvp_status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_interval ON orders (interval_id);
CREATE INDEX IF NOT EXISTS idx_trades_batch ON trades (batch_id);
