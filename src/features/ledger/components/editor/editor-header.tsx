import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogTitle } from "@/components/ui/dialog-title";
export function EditorHeader({
  title,
  close,
  pending,
  eyebrow = "",
}: {
  title: string;
  close: () => void;
  pending: boolean;
  eyebrow?: string;
}) {
  const t = useTranslations("UI");
  return (
    <div className="panel-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <DialogTitle>{title}</DialogTitle>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("close")}
        onClick={close}
        disabled={pending}
      >
        <X />
      </Button>
    </div>
  );
}
