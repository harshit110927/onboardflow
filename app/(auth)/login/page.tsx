import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { login } from "./actions"; 

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-50">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-2">
        <div className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <p className="inline-flex rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-200">
            Built for product and growth teams
          </p>
          <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
            Launch polished onboarding experiences in minutes
          </h1>
          <p className="text-base text-slate-300">
            OnboardFlow helps you create in-app tours, checklists, and progress nudges that activate users faster without shipping custom UI each sprint.
          </p>
          <ul className="space-y-3 text-sm text-slate-200">
            <li>• Build no-code onboarding flows tailored by user segment</li>
            <li>• Track completion and drop-off from a single dashboard</li>
            <li>• Embed onboarding widgets directly in your app</li>
          </ul>
        </div>

        <Card className="w-full max-w-md justify-self-center border-slate-200/20 bg-slate-900/70 text-slate-50 shadow-2xl">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl font-bold text-center">
              Sign in or create your account
            </CardTitle>
            <CardDescription className="text-center text-slate-300">
              Enter your work email and we&apos;ll send you a secure magic link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={login} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="founder@startup.com"
                  required
                  className="border-slate-700 bg-slate-950/70"
                />
              </div>
              <Button type="submit" className="w-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400">
                Continue with Magic Link
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
