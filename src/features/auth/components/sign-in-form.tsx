"use client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { ArrowUpRight, Layers3, ShieldCheck } from "lucide-react";

export function SignInForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function signIn() {
    setPending(true);
    setError("");
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
      if (result.error)
        throw new Error(result.error.message || "Unable to sign in.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to connect. Please try again.",
      );
      setPending(false);
    }
  }
  return (
    <main className="login">
      <section className="login-story">
        <div className="brand">
          <Layers3 /> personal ledger<span className="brand-dot">.</span>
        </div>
        <div>
          <h1>
            Your money.
            <br />
            All accounted for.
          </h1>
        </div>
      </section>
      <section className="login-form">
        <div>
          <h2>Sign in</h2>
          <Button
            variant="outline"
            className="google-button"
            onClick={signIn}
            disabled={pending}
          >
            {pending ? <Spinner /> : <strong className="google-g">G</strong>}
            {pending ? "Connecting…" : "Continue with Google"}
            <ArrowUpRight size={18} />
          </Button>
          {error && (
            <Alert variant="destructive" className="error">
              {error}
            </Alert>
          )}
          <div className="privacy">
            <ShieldCheck size={18} /> Your ledger is private to your Google
            account.
          </div>
        </div>
      </section>
    </main>
  );
}
