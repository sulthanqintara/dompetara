import { useRef, useState } from "react";
import type { Extraction } from "../receipts/receipts";

export function useEditorReceipt(initialExtraction?: Extraction, initialImage?: File) {
  const importButton = useRef<HTMLButtonElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<{ extraction: Extraction; image: File }>();
  return {
    importButton, form, importing,
    extraction: imported?.extraction ?? initialExtraction,
    image: imported?.image ?? initialImage,
    open() {
      setImporting(true);
      requestAnimationFrame(() => document.getElementById("receipt-file-button")?.focus());
    },
    back() {
      setImporting(false);
      requestAnimationFrame(() => importButton.current?.focus());
    },
    read(extraction: Extraction, image: File) {
      setImported({ extraction, image });
      setImporting(false);
      requestAnimationFrame(() => form.current?.querySelector<HTMLInputElement>('input[name="title"]')?.focus());
    },
  };
}
