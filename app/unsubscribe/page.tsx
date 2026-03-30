import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { unsubscribedContacts } from "@/db/schema";
import { createUnsubscribeToken } from "@/lib/email/templates";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const { token, email } = await searchParams;

  if (!token || !email) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center flex flex-col gap-4">
          <h1 className="text-xl font-bold text-foreground">Invalid unsubscribe link</h1>
          <p className="text-sm text-muted-foreground">This link is missing required information.</p>
          <Link href="/" className="text-sm text-primary underline">Go home</Link>
        </div>
      </div>
    );
  }

  const expectedToken = createUnsubscribeToken(email);
  if (token !== expectedToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center flex flex-col gap-4">
          <h1 className="text-xl font-bold text-foreground">Invalid unsubscribe link</h1>
          <p className="text-sm text-muted-foreground">This link is invalid or has expired.</p>
          <Link href="/" className="text-sm text-primary underline">Go home</Link>
        </div>
      </div>
    );
  }

  // Mark as unsubscribed
  try {
    await db
      .insert(unsubscribedContacts)
      .values({ email: email.toLowerCase() })
      .onConflictDoNothing();
  } catch {
    // Already unsubscribed — that's fine
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center flex flex-col gap-4">
        <div className="text-4xl">✓</div>
        <h1 className="text-xl font-bold text-foreground">You've been unsubscribed</h1>
        <p className="text-sm text-muted-foreground">
          <strong>{email}</strong> has been removed from all mailing lists. You won't receive any more emails.
        </p>
        <Link href="/" className="text-sm text-primary underline">Go home</Link>
      </div>
    </div>
  );
}