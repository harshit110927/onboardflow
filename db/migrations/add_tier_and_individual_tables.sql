-- NEW FILE — created for tier selection feature

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT NULL;

CREATE TABLE IF NOT EXISTS individual_lists (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS individual_contacts (
  id SERIAL PRIMARY KEY,
  list_id INTEGER NOT NULL REFERENCES individual_lists(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(list_id, email)
);

CREATE TABLE IF NOT EXISTS individual_campaigns (
  id SERIAL PRIMARY KEY,
  list_id INTEGER NOT NULL REFERENCES individual_lists(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
