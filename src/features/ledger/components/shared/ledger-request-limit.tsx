import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export async function LedgerRequestLimit({ unavailable }: { unavailable: boolean }) {
  const errors = await getTranslations("Errors");
  const ui = await getTranslations("UI");
  return (
    <main className="mx-auto flex min-h-svh max-w-xl items-center p-4">
      <Alert variant="destructive" role="alert" className="space-y-4">
        <p>{errors(unavailable ? "requestProtectionUnavailable" : "tooManyRequests")}</p>
        <Button variant="outline" className="min-h-11 h-auto whitespace-normal px-3 py-2" nativeButton={false} render={<a href="/transactions" />}>
          {ui("reloadLatestLedger")}
        </Button>
      </Alert>
    </main>
  );
}
