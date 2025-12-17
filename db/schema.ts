import { pgTable, text, timestamp, uuid, boolean } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  // 1. Identity
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').default('Founder'), 
  
  // 2. License Details
  // Null initially. Only generated after payment succeeds.
  licenseKey: text('license_key').unique(), 
  
  // Simple check for the UI buttons (true = paid, false = unpaid)
  hasAccess: boolean('has_access').default(false).notNull(),
  
  // 3. Payment Tracking (Optional but recommended so you know who paid)
  stripeCustomerId: text('stripe_customer_id'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});