import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, Terminal, Code, Zap } from "lucide-react";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">
      
      {/* Navigation Bar */}
      <nav className="border-b sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-bold text-xl tracking-tight">OnboardFlow <span className="text-blue-600">Docs</span></div>
          <Link href="/dashboard">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Button>
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-16">
        
        {/* 1. HERO SECTION */}
        <section className="space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">Documentation</h1>
          <p className="text-xl text-slate-500 max-w-2xl">
            Learn how to integrate OnboardFlow into your application to track users and automate revenue recovery.
          </p>
        </section>

        {/* 2. QUICK START */}
        <section id="quick-start" className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Terminal className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold">Quick Start</h2>
          </div>
          <p className="text-slate-600">
            The fastest way to get started is using our CLI tool. It will automatically detect your project type and generate the authentication code for you.
          </p>
          <div className="bg-slate-950 rounded-lg p-4 text-slate-50 overflow-x-auto shadow-xl">
            <code className="font-mono text-sm">npx onboardflow init</code>
          </div>
        </section>

        {/* 3. CORE CONCEPTS */}
        <section id="concepts" className="grid md:grid-cols-2 gap-6">
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2"><Code className="h-5 w-5 text-blue-500"/> Identify</CardTitle>
             </CardHeader>
             <CardContent className="text-slate-600 text-sm">
               Call this when a user logs in or signs up. It creates the user in your dashboard and triggers the "Welcome" email sequence.
             </CardContent>
           </Card>
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-amber-500"/> Stall Detection</CardTitle>
             </CardHeader>
             <CardContent className="text-slate-600 text-sm">
               We automatically track if a user stops making progress. If they don't complete your <b>Activation Step</b> within 24 hours, we email them.
             </CardContent>
           </Card>
        </section>

        {/* 4. API REFERENCE */}
        <section id="api" className="space-y-8">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Code className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold">Manual Integration</h2>
          </div>

          {/* Identify Endpoint */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">1. Identify User</h3>
            <p className="text-slate-600">
              Send a POST request whenever a user authenticates.
            </p>
            <div className="bg-slate-900 rounded-md p-4 overflow-x-auto">
<pre className="text-sm font-mono text-blue-300">
{`POST /api/v1/identify
Headers: { 
  "x-api-key": "obf_live_..." 
}
Body: {
  "userId": "user_123",
  "email": "alice@example.com"
}`}
</pre>
            </div>
          </div>

          {/* Track Endpoint (Placeholder for future) */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">2. Track Event (Coming Soon)</h3>
            <p className="text-slate-600">
              Track specific user actions like <code>created_project</code> or <code>invited_teammate</code>.
            </p>
             <div className="bg-slate-900 rounded-md p-4 overflow-x-auto opacity-70">
<pre className="text-sm font-mono text-blue-300">
{`POST /api/v1/track
Body: {
  "userId": "user_123",
  "event": "created_project"
}`}
</pre>
            </div>
          </div>
        </section>

        {/* 5. CONFIGURATION */}
        <section id="config" className="space-y-6">
           <h2 className="text-2xl font-bold border-b pb-2">Configuration</h2>
           <p className="text-slate-600">
             You can define which step is your "Activation Goal" (e.g., <code>create_project</code>). 
             Users who sign up but <b>do not</b> complete this step will be flagged as "Stalled".
           </p>
           <Card className="bg-blue-50 border-blue-100">
             <CardContent className="pt-6">
               <p className="text-sm text-blue-800">
                 <b>Tip:</b> You can update your activation goal in the CLI or by using the <code>/config</code> endpoint.
               </p>
             </CardContent>
           </Card>
        </section>

      </main>
    </div>
  );
}