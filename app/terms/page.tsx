import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-16 flex flex-col gap-8">
        <div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Dripmetric
          </Link>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: March 2025</p>
        </div>

        <div className="flex flex-col gap-6 text-sm text-foreground leading-relaxed">
          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">1. Acceptance of Terms</h2>
            <p>By accessing or using Dripmetric ("Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">2. Description of Service</h2>
            <p>Dripmetric provides email marketing and user onboarding automation tools. The Service is offered in two tiers: Individual (email campaigns and list management) and Enterprise (user tracking, drip automation, and API access).</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">3. Acceptable Use</h2>
            <p>You agree not to use the Service to send unsolicited emails (spam), transmit malware, violate any applicable law, or impersonate any person or entity. You are responsible for all content sent through your account. Dripmetric reserves the right to suspend accounts that violate these terms.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">4. Payment Terms</h2>
            <p>Subscription plans are billed monthly. Credit packs are one-time purchases. All payments are processed securely via Stripe. Prices are listed in USD and subject to change with 30 days notice.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">5. Refund Policy</h2>
            <p>Credit pack purchases are non-refundable. Subscription plans may receive a pro-rated refund if cancelled within 7 days of the billing date. Contact support to request a refund.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">6. Service Limits</h2>
            <p>Free tier accounts are subject to usage limits as described on the pricing page. Dripmetric reserves the right to throttle or suspend accounts that exceed their plan limits without purchasing additional credits.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">7. Termination</h2>
            <p>You may cancel your account at any time. Dripmetric may terminate accounts that violate these terms with or without notice. Upon termination, your data will be retained for 30 days and then permanently deleted.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">8. Limitation of Liability</h2>
            <p>Dripmetric is provided "as is" without warranty of any kind. Dripmetric shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">9. Contact</h2>
            <p>For questions about these terms, contact us at support@dripmetric.com.</p>
          </section>
        </div>
      </div>
    </div>
  );
}