import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { login } from "./actions";
import { createClient } from "@/utils/supabase/server"; 
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/submit-button"; 

export default async function Home() {
  // 1. CHECK SESSION
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 2. REDIRECT IF LOGGED IN
  if (user) {
    redirect("/dashboard");
  }

  // 3. Otherwise, show the Login Form
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-50">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-2">
        <div className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <p className="inline-flex rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-200">
            Turn new signups into active users
          </p>
          <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
            Product onboarding that ships as fast as your team
          </h1>
          <CardDescription className="text-base text-slate-300">
            OnboardFlow helps SaaS teams design guided product tours, contextual hints, and onboarding checklists that improve activation and retention.
          </CardDescription>
          <ul className="space-y-3 text-sm text-slate-200">
            <li>• Personalize flows by role, plan, or lifecycle stage</li>
            <li>• Measure onboarding impact with completion analytics</li>
            <li>• Launch without rebuilding your frontend every time</li>
          </ul>
        </div>

        <Card className="w-full max-w-md justify-self-center border-slate-200/20 bg-slate-900/70 text-slate-50 shadow-2xl">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl font-bold">Sign in or create account</CardTitle>
            <CardDescription className="text-slate-300">
              Enter your work email to continue with a secure magic link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={login} className="space-y-4">
              <div className="space-y-2">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  className="border-slate-700 bg-slate-950/70"
                />
              </div>
              <SubmitButton />
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
