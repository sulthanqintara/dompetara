import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import Image from "next/image";
export function ReceiptPreview({ file }: { file: File }) {
  const t = useTranslations("UI");
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const preview = URL.createObjectURL(file);
    // Object URLs are external resources; acquire and release them together, including Strict Mode remounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [file]);
  return url ? (
    <Image
      src={url}
      alt={t("originalReceiptForReview")}
      width={800}
      height={1200}
      unoptimized
      className="w-full max-h-64 object-contain my-3"
    />
  ) : null;
}
