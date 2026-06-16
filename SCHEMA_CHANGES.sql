-- Dripmetric manual Supabase schema changes for public compliance and idempotent API support.
-- Required because migration files are intentionally not generated in this change.

-- Consent storage mechanism for product, email, and cookie/privacy consent events.
CREATE TABLE IF NOT EXISTS consent_records (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  consent_type VARCHAR(100) NOT NULL,
  consented BOOLEAN NOT NULL DEFAULT false,
  source VARCHAR(100) NOT NULL DEFAULT 'web',
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Audit logging framework for security/compliance-relevant events.
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  actor_email VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Founder-reviewed export/deletion requests. These are requests, not automated legal determinations.
CREATE TABLE IF NOT EXISTS data_requests (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  request_type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  details TEXT,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Optional hardening for retry-safe ingestion. Existing completed_steps idempotence already prevents duplicate step storage.
CREATE UNIQUE INDEX IF NOT EXISTS end_users_tenant_external_id_idx ON end_users(tenant_id, external_id);
