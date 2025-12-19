import { pgTable, text, timestamp, uuid, boolean, jsonb } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name').default('Founder'), 
    licenseKey: text('license_key').unique(), 
    hasAccess: boolean('has_access').default(false).notNull(),
    apiKey: text("api_key").unique(),
    stripeCustomerId: text('stripe_customer_id'),

    automationEnabled: boolean("automation_enabled").default(false),
    
    // === STEP 1 (Activation) ===
    activationStep: text("activation_step").default("connect_repo"), 
    emailSubject: text("email_subject").default("Quick question..."),
    emailBody: text("email_body").default("We noticed you signed up but haven't started yet."),
  
    // === STEP 2 (New Email Cols) ===
    step2: text("step_2"),
    // NEW
    emailSubject2: text("email_subject_2"),
    emailBody2: text("email_body_2"),
  
    // === STEP 3 (New Email Cols) ===
    step3: text("step_3"),
    // NEW
    emailSubject3: text("email_subject_3"),
    emailBody3: text("email_body_3"),
    
    createdAt: timestamp('created_at').defaultNow().notNull(),
  });

export const endUsers = pgTable("end_users", {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id), // The Founder
    externalId: text("external_id").notNull(), // The Founder's User ID (e.g. "u_123")
    email: text("email"),
    
    // This JSON array stores their progress: ["step_1", "step_2"]
    completedSteps: jsonb("completed_steps").$type<string[]>().default([]),

    lastEmailedAt: timestamp("last_emailed_at"),

    automationsReceived: text("automations_received").array().default([]),
    
    lastSeenAt: timestamp("last_seen_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  });