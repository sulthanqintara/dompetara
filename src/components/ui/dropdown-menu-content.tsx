"use client";
import { Menu } from "@base-ui/react/menu";
import { cn } from "cn";
export function DropdownMenuContent({
  className,
  side = "bottom",
  align = "end",
  sideOffset = 8,
  ...props
}: Menu.Popup.Props &
  Pick<Menu.Positioner.Props, "side" | "align" | "sideOffset">) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <Menu.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "max-h-(--available-height) max-w-(--available-width) min-w-48 overflow-y-auto rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none",
            className,
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  );
}
