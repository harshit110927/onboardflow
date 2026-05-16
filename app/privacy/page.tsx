import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-16 flex flex-col gap-8">
        <div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Dripmetric
          </Link>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: March 2025</p>
        </div>

        <div className="flex flex-col gap-6 text-sm text-foreground leading-relaxed">
          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">1. Data We Collect</h2>
            <p>We collect your email address when you sign up. For Enterprise accounts, we also store email addresses of end users you track through our API. We collect usage data including email send counts and feature usage to enforce plan limits.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">2. How We Use Your Data</h2>
            <p>Your email is used to authenticate your account and send transactional emails (receipts, payment failures, system alerts). We do not sell your data to third parties. We do not use your data for advertising.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">3. Data Processors</h2>
            <p>We use the following third-party services to operate Dripmetric: Supabase (database and authentication), Resend (transactional email delivery), Stripe (payment processing), and Vercel (hosting). Each processor has their own privacy policy and data processing agreements.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">4. Gmail SMTP Credentials</h2>
            <p>If you connect your Gmail account, your App Password is encrypted using AES-256 before storage and is never accessible in plaintext outside of our servers. We do not access your Gmail inbox.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">5. Data Retention</h2>
            <p>Your data is retained for as long as your account is active. Upon account deletion, your data is permanently deleted within 30 days. Email open and click tracking data is retained for 12 months.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">6. Your Rights (GDPR)</h2>
            <p>If you are in the European Economic Area, you have the right to access, correct, or delete your personal data. You may also request data portability or object to processing. Contact us at support@dripmetric.com to exercise these rights.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">7. Cookies</h2>
            <p>We use session cookies for authentication only. We do not use tracking cookies or third-party advertising cookies.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">8. Contact</h2>
            <p>For privacy questions or data deletion requests, contact us at support@dripmetric.com.</p>
          </section>
        </div>
      </div>
    </div>
  );
}