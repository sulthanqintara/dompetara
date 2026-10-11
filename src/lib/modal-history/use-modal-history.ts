"use client";

import { useEffect, useRef, useState } from "react";
import type { Dialog } from "@base-ui/react/dialog";
import { registerModalHistory } from "./register-modal-history";

type Options = Pick<Dialog.Root.Props, "open" | "defaultOpen" | "onOpenChange" | "actionsRef" | "modal">;

export function useModalHistory({ open, defaultOpen = false, onOpenChange, actionsRef, modal = true }: Options) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const localActions = useRef<Dialog.Root.Actions | null>(null);
  const actions = actionsRef ?? localActions;
  const isOpen = open ?? uncontrolledOpen;

  useEffect(() => {
    if (!isOpen || modal === false) return;
    return registerModalHistory(() => actions.current?.close());
  }, [isOpen, modal, actions]);

  const handleOpenChange: NonNullable<Options["onOpenChange"]> = (next, details) => {
    onOpenChange?.(next, details);
    if (!details.isCanceled) setUncontrolledOpen(next);
  };

  return { open: isOpen, onOpenChange: handleOpenChange, actionsRef: actions };
}
