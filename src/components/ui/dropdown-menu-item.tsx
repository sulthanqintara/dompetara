"use client";
import { Menu } from "@base-ui/react/menu";
import { cn } from "cn";
export function DropdownMenuItem({ className, ...props }: Menu.Item.Props) {
  return (
    <Menu.Item
      data-slot="dropdown-menu-item"
      className={cn(
        "flex min-h-11 cursor-default items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-highlighted:bg-accent data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}
