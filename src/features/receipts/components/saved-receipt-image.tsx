import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { fetchReceiptImage } from "../api";

export function SavedReceiptImage({
  imageId,
  expandable = false,
}: {
  imageId: string;
  expandable?: boolean;
}) {
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    fetchReceiptImage(imageId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load this receipt image.",
          );
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageId, attempt]);
  if (error)
    return (
      <Alert variant="destructive" className="receipt-image-error">
        <p>{error}</p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setError("");
            setAttempt(attempt + 1);
          }}
        >
          Retry image
        </Button>
      </Alert>
    );
  return url ? (
    <>
      {expandable && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Fit image" : "Show full-size image"}
        </Button>
      )}
      <Image
        src={url}
        alt="Saved receipt image"
        width={800}
        height={1200}
        unoptimized
        className={`saved-receipt-image${expanded ? " saved-receipt-image-expanded" : ""}`}
      />
    </>
  ) : (
    <p role="status" className="flex items-center gap-2 py-3">
      <Spinner />
      Loading receipt image…
    </p>
  );
}
