"use client";
import { Menu } from "@base-ui/react/menu";
export function DropdownMenuTrigger(props: Menu.Trigger.Props) {
  return <Menu.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}
