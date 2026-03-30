import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

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

  // === STEP 2 ===
  step2: text("step_2"),
  emailSubject2: text("email_subject_2"),
  emailBody2: text("email_body_2"),

  // === STEP 3 ===
  step3: text("step_3"),
  emailSubject3: text("email_subject_3"),
  emailBody3: text("email_body_3"),

  // MODIFIED — tier selection
  tier: varchar("tier", { length: 20 }).$type<"enterprise" | "individual" | null>().default(null),

  // MODIFIED — phase 1 premium foundation
  plan: varchar("plan", { length: 20 }).notNull().default("free"),
  planExpiresAt: timestamp("plan_expires_at"),
  credits: integer("credits").notNull().default(0),
  creditsUpdatedAt: timestamp("credits_updated_at").defaultNow(),

  createdAt: timestamp('created_at').defaultNow().notNull(),

  //smtp related fields
  smtpEmail: varchar("smtp_email", { length: 255 }),
  smtpPassword: text("smtp_password"),
  smtpVerified: boolean("smtp_verified").default(false).notNull(),
  smtpProvider: varchar("smtp_provider", { length: 50 }),
});

export const endUsers = pgTable("end_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  externalId: text("external_id").notNull(),
  email: text("email"),
  completedSteps: jsonb("completed_steps").$type<string[]>().default([]),
  lastEmailedAt: timestamp("last_emailed_at"),
  automationsReceived: text("automations_received").array().default([]),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// MODIFIED — tier selection
export const individualLists = pgTable("individual_lists", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => tenants.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// MODIFIED — tier selection
export const individualContacts = pgTable(
  "individual_contacts",
  {
    id: serial("id").primaryKey(),
    listId: integer("list_id")
      .notNull()
      .references(() => individualLists.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    listEmailUnique: uniqueIndex("individual_contacts_list_id_email_idx").on(
      table.listId,
      table.email,
    ),
  }),
);

// MODIFIED — tier selection
export const individualCampaigns = pgTable("individual_campaigns", {
  id: serial("id").primaryKey(),
  listId: integer("list_id")
    .notNull()
    .references(() => individualLists.id, { onDelete: "cascade" }),
  subject: varchar("subject", { length: 255 }).notNull(),
  body: text("body").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  sequenceId: uuid("sequence_id"),
  sequencePosition: integer("sequence_position").notNull().default(1),
  sendDelayDays: integer("send_delay_days").notNull().default(0),
});

// MODIFIED — phase 1 premium foundation
export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  description: varchar("description", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const stripeSubscriptions = pgTable("stripe_subscriptions", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  status: varchar("status", { length: 20 }),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const processedWebhookEvents = pgTable("processed_webhook_events", {
  id: serial("id").primaryKey(),
  stripeEventId: text("stripe_event_id").notNull().unique(),
  processedAt: timestamp("processed_at").defaultNow(),
});

export const aiUsage = pgTable("ai_usage", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  generatedAt: timestamp("generated_at").defaultNow(),
  tokensUsed: integer("tokens_used").notNull().default(0),
});

export const campaignEvents = pgTable("campaign_events", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => individualCampaigns.id, { onDelete: "cascade" }),
  contactEmail: varchar("contact_email", { length: 255 }).notNull(),
  eventType: varchar("event_type", { length: 20 }).notNull(),
  eventData: text("event_data"),
  occurredAt: timestamp("occurred_at").defaultNow(),
});

export const dripSteps = pgTable("drip_steps", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  eventTrigger: varchar("event_trigger", { length: 100 }).notNull(),
  emailSubject: varchar("email_subject", { length: 255 }).notNull(),
  emailBody: text("email_body").notNull(),
  delayHours: integer("delay_hours").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const webhooks = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  events: text("events").array().notNull().default([]),
  secret: text("secret").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: serial("id").primaryKey(),
  webhookId: integer("webhook_id").notNull().references(() => webhooks.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  payload: text("payload").notNull(),
  responseStatus: integer("response_status"),
  deliveredAt: timestamp("delivered_at").defaultNow(),
  success: boolean("success").notNull().default(false),
});

export const unsubscribedContacts = pgTable("unsubscribed_contacts", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  unsubscribedAt: timestamp("unsubscribed_at").defaultNow(),
});