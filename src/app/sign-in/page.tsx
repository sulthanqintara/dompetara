"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const { error } =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: email });

    setPending(false);

    if (error) {
      setError(error.message ?? "Something went wrong");
      return;
    }

    router.push("/");
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">
            {mode === "sign-in" ? "Welcome back" : "Create an account"}
          </CardTitle>
          <CardDescription>
            {mode === "sign-in"
              ? "Sign in to your Personal Ledger"
              : "Sign up to start tracking your finances"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={pending}>
              {pending
                ? "Please wait..."
                : mode === "sign-in"
                  ? "Sign in"
                  : "Sign up"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                setMode(mode === "sign-in" ? "sign-up" : "sign-in")
              }
            >
              {mode === "sign-in"
                ? "No account? Sign up"
                : "Already have an account? Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
