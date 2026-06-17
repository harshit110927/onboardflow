# Dripmetric Compliance Infrastructure

This document tracks code-level compliance infrastructure only. It is not legal advice and does not make legal claims.

## SECTION A — Implemented compliance features

- Privacy Policy page: `app/privacy/page.tsx`, route `/privacy`.
- Terms of Service page: `app/terms/page.tsx`, route `/terms`.
- Cookie Policy page: `app/cookies/page.tsx`, route `/cookies`.
- Data Export Request page: `app/data-export/page.tsx`, route `/data-export`, stores requests in `data_requests`, logs `data_export.requested` through `lib/compliance/audit.ts`.
- Data Deletion Request page: `app/data-deletion/page.tsx`, route `/data-deletion`, stores requests in `data_requests`, logs `data_deletion.requested` through `lib/compliance/audit.ts`.
- Consent storage mechanism: `consentRecords` in `db/schema.ts`; SQL in `SCHEMA_CHANGES.sql`.
- Audit logging framework: `auditLogs` in `db/schema.ts`; utility `lib/compliance/audit.ts`; SQL in `SCHEMA_CHANGES.sql`.
- API key creation/deletion audit hooks: `app/actions/api-key.ts` logs `api_key.created` and `api_key.deleted`.
- Unsubscribe infrastructure: existing `unsubscribedContacts` table in `db/schema.ts`, `app/unsubscribe/page.tsx`, and email template links in `lib/email/templates.ts`.

## SECTION B — Partially implemented compliance features

- Data export/deletion requests are captured and audited, but fulfillment remains manual.
- Consent records schema exists, but individual consent capture points must be wired as product surfaces are finalized.
- Cookie policy route exists, but a formal cookie inventory must be maintained by the founder.

## SECTION C — Not implemented compliance features

- Automated GDPR/CCPA/DPDP fulfillment workflows.
- Legal-reviewed DPA and subprocessor pages.
- Incident response automation.
- Automated data retention/deletion schedules.

## SECTION D — Manual actions required by founder

### SPF
- Requirement: Publish SPF DNS records for the sending domain.
- Why it matters: Helps recipient mail servers verify authorized senders.
- Service involved: DNS provider and Resend.
- Exact implementation steps: Open Resend domain settings, copy the SPF TXT record, add it at the DNS provider, wait for DNS propagation, verify in Resend.

### DKIM
- Requirement: Publish DKIM DNS records for the sending domain.
- Why it matters: Cryptographically signs outgoing email.
- Service involved: DNS provider and Resend.
- Exact implementation steps: Open Resend domain settings, copy DKIM CNAME/TXT records, add them to DNS, verify in Resend.

### DMARC
- Requirement: Publish a DMARC DNS record.
- Why it matters: Defines handling and reporting for SPF/DKIM failures.
- Service involved: DNS provider.
- Exact implementation steps: Create `_dmarc.yourdomain.com` TXT record, start with a monitoring policy, review reports, tighten policy when ready.

### DPA
- Requirement: Maintain a Data Processing Addendum.
- Why it matters: Customers may require processor commitments.
- Service involved: Founder legal counsel.
- Exact implementation steps: Have counsel draft/review a DPA, publish request instructions, keep executed copies.

### Subprocessor disclosure
- Requirement: Maintain a current subprocessor list.
- Why it matters: Customers need to know which vendors process data.
- Service involved: Supabase, Resend, Stripe, Vercel, and any analytics/support vendors.
- Exact implementation steps: List vendor, purpose, location/links, review whenever vendors change, publish or provide on request.

### Incident response policy
- Requirement: Write and maintain an incident response policy.
- Why it matters: Security incidents require consistent triage, containment, notice, and remediation.
- Service involved: Founder operations.
- Exact implementation steps: Define severity levels, owners, notification criteria, timelines, templates, and postmortem process.

### Data retention policy
- Requirement: Define retention periods for tenants, end users, logs, requests, and email events.
- Why it matters: Retention limits reduce risk and support compliance requests.
- Service involved: Supabase and founder operations.
- Exact implementation steps: Define retention schedule, document exceptions, implement deletion jobs only after legal/product approval.

### CCPA process
- Requirement: Define intake, verification, fulfillment, and appeal process.
- Why it matters: California users may exercise privacy rights.
- Service involved: Founder operations.
- Exact implementation steps: Use `/data-export` and `/data-deletion` intake, verify identity, record status, fulfill manually, document completion.

### GDPR process
- Requirement: Define data subject request and lawful basis process.
- Why it matters: EU/UK data subjects have access/deletion/objection rights.
- Service involved: Founder legal counsel and operations.
- Exact implementation steps: Document lawful bases, use request pages for intake, verify requester, fulfill/export/delete as applicable, record audit trail.

### DPDP process
- Requirement: Define India DPDP request handling and consent/notice review.
- Why it matters: India users may have rights and notice requirements.
- Service involved: Founder legal counsel and operations.
- Exact implementation steps: Review notices with counsel, capture applicable requests, verify identity, fulfill and log outcomes.
