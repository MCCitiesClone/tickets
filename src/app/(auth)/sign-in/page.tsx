"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signIn } from "@/lib/auth-client";

export default function SignInPage() {
  const [loading, setLoading] = useState(false);

  async function handleDiscord() {
    setLoading(true);
    try {
      await signIn.social({ provider: "discord", callbackURL: "/dashboard" });
    } catch {
      toast.error("Could not start Discord sign-in. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Use your Discord account to manage your servers&apos; tickets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            size="lg"
            onClick={handleDiscord}
            disabled={loading}
          >
            {loading ? "Redirecting…" : "Continue with Discord"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
