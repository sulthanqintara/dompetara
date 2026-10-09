"use client";
import { useErrorMessage } from "@/features/i18n/use-error-message";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { BrandWordmark } from "@/features/branding/components/brand-wordmark";
import { ThemeToggle } from "@/features/theme/components/theme-toggle";

export function SignInForm() {
  const errorMessage = useErrorMessage();
  const t = useTranslations("UI");
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
      <div className="login-theme-toggle"><ThemeToggle /></div>
      <section className="login-story">
        <div className="brand">
          <BrandWordmark size={64} />
        </div>
        <div>
          <h1>
            {t("yourMoney")}<br />
            {t("allAccountedFor")}</h1>
        </div>
      </section>
      <section className="login-form">
        <div>
          <h2>{t("signIn")}</h2>
          <Button
            variant="outline"
            className="google-button"
            onClick={signIn}
            disabled={pending}
          >
            {pending ? <Spinner /> : <strong className="google-g">G</strong>}
            {pending ? t("connecting") : t("continueWithGoogle")}
            <ArrowUpRight size={18} />
          </Button>
          {error && (
            <Alert variant="destructive" className="error">
              {errorMessage(error)}
            </Alert>
          )}
          <div className="privacy">
            <ShieldCheck size={18} />  {t("yourLedgerIsPrivateToYourGoogleAccount")}</div>
        </div>
      </section>
    </main>
  );
}
