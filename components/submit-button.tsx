"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./ui/button"; // Assuming you use Shadcn UI
import { Loader2 } from "lucide-react";

export function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Sending Magic Link...
        </>
      ) : (
        "Sign In with Email"
      )}
    </Button>
  );
}