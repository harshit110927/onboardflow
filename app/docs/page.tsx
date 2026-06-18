import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, Terminal, Code, Zap, AlertTriangle, Info, Mail, BarChart2 } from "lucide-react";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">

      <nav className="border-b sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-bold text-xl tracking-tight">Dripmetric <span className="text-blue-600">Docs</span></div>
          <Link href="/dashboard">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Button>
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-16">

        {/* HERO */}
        <section className="space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">Documentation</h1>
          <p className="text-xl text-slate-500 max-w-2xl">
            Complete integration guide for Dripmetric Enterprise — track onboarding steps, automate drip emails, and recover stuck users.
          </p>
        </section>

        {/* QUICK START */}
        <section id="quick-start" className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Terminal className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold">Quick Start</h2>
          </div>
          <p className="text-slate-600">Use the public HTTP API from any backend. Works with any language capable of making HTTP requests. The Node.js package is a lightweight wrapper around these endpoints.</p>
          <div className="bg-slate-950 rounded-lg p-4 text-slate-50 overflow-x-auto shadow-xl">
            <code className="font-mono text-sm">npm install dripmetric</code>
          </div>
          <div className="bg-slate-900 rounded-md p-4 overflow-x-auto">
<pre className="text-sm font-mono text-blue-300">{`import { Dripmetric } from "dripmetric";

const onboard = new Dripmetric("obf_live_your_api_key");`}</pre>
          </div>
          <Card className="bg-amber-50 border-amber-100">
            <CardContent className="pt-4">
              <p className="text-sm text-amber-800">
                <b>Never expose your API key client-side.</b> Always call <code>identify()</code> and <code>track()</code> from your server — API routes, server actions, or backend handlers only.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* CORE METHODS */}
        <section id="sdk" className="space-y-8">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Code className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold">SDK Methods</h2>
          </div>

          {/* identify */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">onboard.identify()</h3>
            <p className="text-slate-600">
              Call this when a user signs up or logs in. It creates the user in your Dripmetric dashboard and immediately sends them your configured Step 1 welcome email.
            </p>
            <div className="bg-slate-900 rounded-md p-4 overflow-x-auto">
<pre className="text-sm font-mono text-blue-300">{`await onboard.identify({
  userId: "user_123",   // your internal user ID
  email: "alice@example.com"
});`}</pre>
            </div>
            <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
              <li>Safe to call on every login — re-identifying an existing user does not re-send the welcome email.</li>
              <li>If the user already exists, their record is updated with a new <code>lastSeenAt</code> timestamp.</li>
            </ul>
          </div>

          {/* track */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">onboard.track() <Badge variant="secondary" className="font-normal">Schema-less</Badge></h3>
            <p className="text-slate-600">
              Call this whenever a user completes an onboarding step. Dripmetric uses <b>Schema-less Ingestion</b> — this means you do NOT need to pre-create events in your dashboard before tracking them. Your codebase dictates what gets tracked.
            </p>
            <div className="bg-slate-900 rounded-md p-4 overflow-x-auto">
<pre className="text-sm font-mono text-blue-300">{`await onboard.track({
  userId: "user_123",
  stepId: "created_first_project"  // Use any custom string you want!
});`}</pre>
            </div>
            <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
              <li>Just make up a string (like <code>connected_repo</code> or <code>invited_team</code>) and send it. Dripmetric will record it.</li>
              <li>Once your code sends the event, it will automatically appear in your Automation Settings dropdowns for you to trigger emails from.</li>
              <li>Call <code>identify()</code> before <code>track()</code> — tracking an unknown user returns a 404.</li>
              <li>Tracking the same step twice is safe — it is stored only once (idempotent).</li>
            </ul>
          </div>
        </section>

        {/* HOW DRIP EMAILS WORK */}
        <section id="drip" className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Mail className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold">How Drip Emails Work</h2>
          </div>
          <p className="text-slate-600">
            Dripmetric runs an automated cron job that checks all your users for onboarding progress. Emails are sent when a user is stuck — not on every step completion.
          </p>
          <div className="bg-slate-900 rounded-md p-4 overflow-x-auto">
<pre className="text-sm font-mono text-slate-300">{`User signs up
  → identify() called
  → Welcome email sent immediately (Step 1 email template)

Cron runs every 15 minutes:
  → Step 1 not completed after 1 hour  → sends Step 1 nudge email
  → Step 2 not completed after 24 hours → sends Step 2 nudge email
  → Step 3 not completed after 24 hours → sends Step 3 nudge email

User completes a step via track()
  → Step marked complete
  → That step's nudge email will no longer be sent`}</pre>
          </div>
          <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
            <li>Each nudge email is sent at most once per user per step — no repeated emails.</li>
            <li>Users who unsubscribe are automatically excluded from all future emails.</li>
            <li>You can trigger the cron manually from your dashboard using the <b>Run Now</b> button.</li>
          </ul>
        </section>

        {/* SENDING DOMAIN */}
<section id="sending" className="space-y-6">
  <div className="flex items-center gap-2 pb-2 border-b">
    <Mail className="h-6 w-6 text-blue-600" />
    <h2 className="text-2xl font-bold">Setting Up Your Sending Domain</h2>
  </div>
  <p className="text-slate-600">
    By default Dripmetric uses a shared sending domain which only works for your own inbox during testing.
    For production, connect your own Resend account so emails arrive from your domain.
  </p>

  <Card className="bg-amber-50 border-amber-100">
    <CardContent className="pt-4">
      <p className="text-sm text-amber-800">
        <b>Required for production.</b> Without a connected sending account, drip emails will not
        deliver to your users' inboxes reliably.
      </p>
    </CardContent>
  </Card>

  <div className="space-y-4">
    <h3 className="text-lg font-semibold">Setup steps</h3>
    <div className="bg-slate-900 rounded-md p-4 overflow-x-auto">
<pre className="text-sm font-mono text-slate-300">{`1. Create a free account at resend.com

2. Go to Domains → Add Domain → enter yourdomain.com
   Resend will give you DNS records to add (TXT + MX).
   Add them in Cloudflare, Namecheap, or wherever your domain lives.
   Verification takes ~10 minutes.

3. Go to API Keys → Create API Key → Full Access
   Copy the key (starts with re_live_...)

4. In Dripmetric → Automation Settings → Email Sending:
   - Paste your Resend API key
   - Enter your from address (e.g. hello@yourdomain.com)
   - Click Save Email Settings

Your users will now receive emails from your domain.`}</pre>
    </div>
  </div>

  <Card className="bg-blue-50 border-blue-100">
    <CardContent className="pt-4 space-y-1">
      <p className="text-sm text-blue-800 font-semibold">From address format</p>
      <p className="text-sm text-blue-800">
        Use a recognizable address your users will trust — <code>hello@yourapp.com</code>,
        <code> noreply@yourapp.com</code>, or <code>team@yourapp.com</code>.
        The domain must be verified in your Resend account or emails will be rejected.
      </p>
    </CardContent>
  </Card>
</section>

        {/* ANALYTICS & STEP NAMING WARNING */}
        <section id="analytics" className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b">
            <BarChart2 className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold">Analytics & Funnel Tracking</h2>
          </div>
          <p className="text-slate-600">
            Your dashboard shows how many users have completed each step, where they are dropping off, and your overall activation rate. This is calculated in real time from each user's <code>completedSteps</code> array against your current step configuration.
          </p>

          <Card className="bg-red-50 border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-red-700 text-base">
                <AlertTriangle className="h-4 w-4" /> Renaming steps resets your funnel metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-red-700 space-y-2">
              <p>
                Your analytics are calculated by matching each user's recorded <code>completedSteps</code> values against the <b>Event Name (Code)</b> fields in your current Automation Workflow settings.
              </p>
              <p>
                If you rename a step from <code>connect_repo</code> to <code>connected_repository</code>, all users who previously completed <code>connect_repo</code> will no longer be counted as having completed that step. Your completion rate will appear to drop to zero for that step.
              </p>
              <p>
                <b>Rule:</b> Treat Event Name codes like database column names — set them once and do not change them. If you need to rename, you must also backfill your <code>end_users</code> table in Supabase to update the old step strings.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* MANUAL API REFERENCE */}
        <section id="api" className="space-y-8">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Code className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold">Manual API Reference</h2>
          </div>
          <p className="text-slate-600">If you prefer direct HTTP calls over the SDK, use these endpoints.</p>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">POST /api/public/identify</h3>
            <div className="bg-slate-900 rounded-md p-4 overflow-x-auto">
<pre className="text-sm font-mono text-blue-300">{`POST /api/public/identify
Headers: {
  "x-api-key": "obf_live_...",
  "Content-Type": "application/json"
}
Body: {
  "userId": "user_123",
  "email": "alice@example.com"
}`}</pre>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">POST /api/public/track</h3>
            <div className="bg-slate-900 rounded-md p-4 overflow-x-auto">
<pre className="text-sm font-mono text-blue-300">{`POST /api/public/track
Headers: {
  "x-api-key": "obf_live_...",
  "Content-Type": "application/json"
}
Body: {
  "userId": "user_123",
  "stepId": "created_project"
}`}</pre>
            </div>
          </div>
        </section>

        {/* RATE LIMITS */}
        <section id="limits" className="space-y-6">
          <h2 className="text-2xl font-bold border-b pb-2">Rate Limits & Plan Tiers</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="py-3 pr-6 font-semibold text-slate-700">Limit</th>
                  <th className="py-3 pr-6 font-semibold text-slate-700">Free</th>
                  <th className="py-3 pr-6 font-semibold text-slate-700">Starter</th>
                  <th className="py-3 font-semibold text-slate-700">Growth / Pro</th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                <tr className="border-b">
                  <td className="py-3 pr-6">Tracked end users</td>
                  <td className="py-3 pr-6">50</td>
                  <td className="py-3 pr-6">500</td>
                  <td className="py-3">Unlimited</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-6">Emails per day</td>
                  <td className="py-3 pr-6">20</td>
                  <td className="py-3 pr-6">100</td>
                  <td className="py-3">Unlimited</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-6">Emails per month</td>
                  <td className="py-3 pr-6">300</td>
                  <td className="py-3 pr-6">2,000</td>
                  <td className="py-3">Unlimited</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-6">Drip steps</td>
                  <td className="py-3 pr-6">3</td>
                  <td className="py-3 pr-6">3</td>
                  <td className="py-3">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-3 pr-6">API rate limit</td>
                  <td className="py-3 pr-6" colSpan={3}>Rate-limited by IP across all tiers</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* TIPS */}
        <section id="tips" className="space-y-4">
          <Card className="bg-blue-50 border-blue-100">
            <CardContent className="pt-6 space-y-2">
              <p className="text-sm text-blue-800 font-semibold flex items-center gap-2">
                <Info className="h-4 w-4" /> Integration checklist
              </p>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Call <code>identify()</code> in your auth callback (after signup and login)</li>
                <li>Call <code>track()</code> server-side immediately after a key action completes</li>
                <li>Set your Step 1 Event Name in Automation Settings before going live</li>
                <li>Enable Auto-Pilot in Automation Settings to activate the cron</li>
                <li>Never rename Event Name codes after you have real user data</li>
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* AI PROMPT FOR AGENTS */}
        <section id="ai-prompt" className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Zap className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold">AI Integration Prompt</h2>
          </div>
          <p className="text-slate-600">
            Building your app with Cursor, GitHub Copilot, or another AI coding assistant? <b>Before copying the prompt below</b>, replace the bracketed placeholders like <code>[YOUR_API_KEY]</code> and <code>[STEP_NAME]</code> with your actual details. Then paste it into your AI to have it integrate Dripmetric instantly.
          </p>
          <div className="bg-slate-900 rounded-md p-4 overflow-x-auto relative group">
            <pre className="text-sm font-mono text-slate-300 whitespace-pre-wrap">{`You are an expert full-stack developer. I need you to integrate the 'dripmetric' Node SDK into our backend to track user onboarding.

1. Install the SDK: \`npm install dripmetric\`

2. Initialize it in our backend utility or service layer using the API key from our environment variables. Please add \`DRIPMETRIC_API_KEY=[YOUR_API_KEY]\` to our .env files.
   \`\`\`ts
   import { Dripmetric } from "dripmetric";
   export const onboard = new Dripmetric(process.env.DRIPMETRIC_API_KEY!);
   \`\`\`

3. Locate our user SIGNUP and LOGIN logic. At the end of a successful authentication flow, call \`await onboard.identify({ userId: user.id, email: user.email })\` server-side. Do NOT call this from the client-side browser.

4. Locate our core onboarding step completion logic. Specifically, find where the user does the following action: "[DESCRIBE_THE_ACTION_THEY_TAKE]". Add a tracking call server-side right after that action succeeds: \`await onboard.track({ userId: user.id, stepId: "[STEP_NAME]" })\`.

Please find those authentication and onboarding execution points in our codebase now, and add these snippets. Ensure the API key is never exposed to the frontend.`}</pre>
          </div>
        </section>

      </main>
    </div>
  );
}