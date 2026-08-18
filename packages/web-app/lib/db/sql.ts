export const PORTAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS portal_investors (
    wallet TEXT PRIMARY KEY,
    investor_id TEXT NOT NULL,
    onchain_id TEXT NOT NULL,
    iban TEXT NOT NULL,
    wht_bps TEXT NOT NULL DEFAULT '0',
    email TEXT,
    country TEXT NOT NULL DEFAULT 'KZ',
    provider TEXT NOT NULL DEFAULT 'SUMSUB',
    applicant_id TEXT NOT NULL,
    onboarding_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING_KYC',
    display_name TEXT,
    investor_kind TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    investor_class TEXT NOT NULL DEFAULT 'RETAIL',
    kyb_status TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    bin TEXT,
    legal_name TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    review_status TEXT NOT NULL DEFAULT 'SUBMITTED',
    application_id TEXT,
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    reviewer_wallet TEXT,
    onchain_confirmed TEXT NOT NULL DEFAULT 'false',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_applications (
    id TEXT PRIMARY KEY,
    wallet TEXT NOT NULL,
    review_status TEXT NOT NULL DEFAULT 'SUBMITTED',
    notes TEXT,
    reviewer_wallet TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_events (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    action TEXT NOT NULL,
    reviewer_wallet TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portal_subscriptions (
    id TEXT PRIMARY KEY,
    wallet TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    amount TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_applications_status ON kyc_applications (review_status);
CREATE INDEX IF NOT EXISTS idx_kyc_applications_wallet ON kyc_applications (wallet);
CREATE INDEX IF NOT EXISTS idx_review_events_app ON review_events (application_id);
CREATE INDEX IF NOT EXISTS idx_portal_subscriptions_status ON portal_subscriptions (status);
`;
