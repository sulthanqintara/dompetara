import type { ComponentProps } from "react";
import { Tabs } from "@/components/ui/tabs";
import { useSidebar } from "@/components/ui/use-sidebar";

export function WorkspaceTabs(props: ComponentProps<typeof Tabs>) {
  const { isPhone } = useSidebar();
  return <Tabs {...props} orientation={isPhone ? "horizontal" : "vertical"} />;
}
