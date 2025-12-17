import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function CheckEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Check your inbox</CardTitle>
          <CardDescription className="text-center">
            We've sent a magic link to your email address.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-8">
           <p className="text-sm text-muted-foreground">
             Click the link in the email to sign in.
           </p>
        </CardContent>
      </Card>
    </div>
  );
}