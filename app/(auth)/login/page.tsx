import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { login } from "./actions"; 

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Log in to OnboardFlow
          </CardTitle>
          <CardDescription className="text-center">
            Enter your email to receive a magic link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                name="email" 
                type="email" 
                placeholder="founder@startup.com" 
                required 
              />
            </div>
            <Button type="submit" className="w-full">
              Send Magic Link
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}