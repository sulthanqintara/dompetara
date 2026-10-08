import { useErrorMessage } from "@/features/i18n/use-error-message";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Download } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { downloadLedger } from "../../api";
import type { ExportFormat } from "../../export";

export function ExportSettings({ pending }: { pending: boolean }) {
  const errorMessage = useErrorMessage();
  const t = useTranslations("UI");
  const [loading, setLoading] = useState<ExportFormat | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function download(format: ExportFormat) {
    if (loading || pending) return;
    setLoading(format);
    setError("");
    setMessage("");
    try {
      await downloadLedger(format);
      setMessage(t("downloadStarted", { format: format.toUpperCase() }));
    } catch {
      setError("Could not export your ledger. Please try again.");
    } finally {
      setLoading(null);
    }
  }
  return (
    <Card className="settings-panel" aria-busy={loading !== null}>
      <h3>{t("exportYourLedger")}</h3>
      <div className="export-actions">
        <Button disabled={pending || loading !== null} onClick={() => download("json")}>
          {loading === "json" ? <Spinner /> : <Download size={16} />}
          {loading === "json" ? t("downloadingJSON") : t("downloadJSONBackup")}
        </Button>
        <Button variant="outline" disabled={pending || loading !== null} onClick={() => download("csv")}>
          {loading === "csv" ? <Spinner /> : <Download size={16} />}
          {loading === "csv" ? t("downloadingCSV") : t("downloadCSV")}
        </Button>
      </div>
      {error && <Alert variant="destructive">{errorMessage(error)}</Alert>}
      {message && <Alert role="status" aria-live="polite">{message}</Alert>}
    </Card>
  );
}
