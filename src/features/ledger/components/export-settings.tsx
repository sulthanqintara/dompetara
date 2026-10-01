import { useState } from "react";
import { Download } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { downloadLedger } from "../api";
import type { ExportFormat } from "../export";

export function ExportSettings({ pending }: { pending: boolean }) {
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
      setMessage(`${format.toUpperCase()} download started.`);
    } catch {
      setError("Could not export your ledger. Please try again.");
    } finally {
      setLoading(null);
    }
  }
  return (
    <Card className="settings-panel" aria-busy={loading !== null}>
      <h3>Export your ledger</h3>
      <p>
        Download the latest saved data across all dates and currencies.
        JSON includes your complete ledger, wallets, and categories.
        CSV includes transaction history with wallet names and exact amounts.
      </p>
      <div className="export-actions">
        <Button disabled={pending || loading !== null} onClick={() => download("json")}>
          {loading === "json" ? <Spinner /> : <Download size={16} />}
          {loading === "json" ? "Downloading JSON…" : "Download JSON backup"}
        </Button>
        <Button variant="outline" disabled={pending || loading !== null} onClick={() => download("csv")}>
          {loading === "csv" ? <Spinner /> : <Download size={16} />}
          {loading === "csv" ? "Downloading CSV…" : "Download CSV"}
        </Button>
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
      {message && <Alert role="status" aria-live="polite">{message}</Alert>}
    </Card>
  );
}
