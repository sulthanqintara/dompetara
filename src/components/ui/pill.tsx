import type { ComponentProps } from "react";
import { X } from "lucide-react";
import { Badge } from "./badge";
import { Button } from "./button";
import { cn } from "cn";

export function Pill({
  children,
  removable = false,
  disabled = false,
  className,
  ...props
}: ComponentProps<typeof Badge> & { removable?: boolean; disabled?: boolean }) {
  return (
    <Badge
      variant="secondary"
      render={
        removable ? (
          <Button variant="secondary" disabled={disabled} />
        ) : undefined
      }
      className={cn("compact-pill", removable && "removable-pill", className)}
      {...props}
    >
      <span>{children}</span>
      {removable && <X aria-hidden="true" />}
    </Badge>
  );
}
