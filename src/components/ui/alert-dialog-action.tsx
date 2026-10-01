"use client";

import * as React from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

function AlertDialogAction({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="alert-dialog-action"
      className={cn(className)}
      {...props}
    />
  );
}

export { AlertDialogAction };
