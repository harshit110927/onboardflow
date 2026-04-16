CREATE TABLE "ai_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"generated_at" timestamp DEFAULT now(),
	"tokens_used" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"contact_email" varchar(255) NOT NULL,
	"event_type" varchar(20) NOT NULL,
	"event_data" text,
	"occurred_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"description" varchar(255),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "drip_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"event_trigger" varchar(100) NOT NULL,
	"email_subject" varchar(255) NOT NULL,
	"email_body" text NOT NULL,
	"delay_hours" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "end_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"external_id" text NOT NULL,
	"email" text,
	"completed_steps" jsonb DEFAULT '[]'::jsonb,
	"last_emailed_at" timestamp,
	"automations_received" text[] DEFAULT '{}',
	"last_seen_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "individual_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"list_id" integer NOT NULL,
	"subject" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"sequence_id" uuid,
	"sequence_position" integer DEFAULT 1 NOT NULL,
	"send_delay_days" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "individual_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"list_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "individual_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "processed_webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"stripe_event_id" text NOT NULL,
	"processed_at" timestamp DEFAULT now(),
	CONSTRAINT "processed_webhook_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE TABLE "stripe_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"status" varchar(20),
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT 'Founder',
	"license_key" text,
	"has_access" boolean DEFAULT false NOT NULL,
	"api_key" text,
	"stripe_customer_id" text,
	"automation_enabled" boolean DEFAULT false,
	"activation_step" text DEFAULT 'connect_repo',
	"email_subject" text DEFAULT 'Quick question...',
	"email_body" text DEFAULT 'We noticed you signed up but haven''t started yet.',
	"step_2" text,
	"email_subject_2" text,
	"email_body_2" text,
	"step_3" text,
	"email_subject_3" text,
	"email_body_3" text,
	"tier" varchar(20) DEFAULT null,
	"plan" varchar(20) DEFAULT 'free' NOT NULL,
	"plan_expires_at" timestamp,
	"razorpay_subscription_id" text,
	"plan_renewal_date" timestamp,
	"credits" integer DEFAULT 0 NOT NULL,
	"credits_updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"smtp_email" varchar(255),
	"smtp_password" text,
	"smtp_verified" boolean DEFAULT false NOT NULL,
	"smtp_provider" varchar(50),
	CONSTRAINT "tenants_email_unique" UNIQUE("email"),
	CONSTRAINT "tenants_license_key_unique" UNIQUE("license_key"),
	CONSTRAINT "tenants_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "unsubscribed_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"unsubscribed_at" timestamp DEFAULT now(),
	CONSTRAINT "unsubscribed_contacts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"webhook_id" integer NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" text NOT NULL,
	"response_status" integer,
	"delivered_at" timestamp DEFAULT now(),
	"success" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"url" text NOT NULL,
	"events" text[] DEFAULT '{}' NOT NULL,
	"secret" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_campaign_id_individual_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."individual_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drip_steps" ADD CONSTRAINT "drip_steps_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "end_users" ADD CONSTRAINT "end_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "individual_campaigns" ADD CONSTRAINT "individual_campaigns_list_id_individual_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."individual_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "individual_contacts" ADD CONSTRAINT "individual_contacts_list_id_individual_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."individual_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "individual_lists" ADD CONSTRAINT "individual_lists_user_id_tenants_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_subscriptions" ADD CONSTRAINT "stripe_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "individual_contacts_list_id_email_idx" ON "individual_contacts" USING btree ("list_id","email");