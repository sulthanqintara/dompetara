"use client";
import { Menu } from "@base-ui/react/menu";
import { cn } from "cn";

export function DropdownMenuBackdrop({ className, ...props }: Menu.Backdrop.Props) {
  return <Menu.Backdrop data-slot="dropdown-menu-backdrop" className={cn(
    "fixed inset-0 z-45 bg-black/25 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
    className,
  )} {...props} />;
}
