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
    <div className="flex h-screen w-full items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">OnboardFlow</CardTitle>
          <CardDescription>Enter your email to sign in to your dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          {/* MOVE action={login} HERE */}
          <form action={login} className="space-y-4">
            <div className="space-y-2">
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                required
              />
            </div>
            
            {/* Submit Button  */}
            <SubmitButton />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}