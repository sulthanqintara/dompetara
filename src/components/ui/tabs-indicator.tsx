"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

// Extend the shadcn Base UI Tabs with its native active-tab indicator.
export function TabsIndicator(props: TabsPrimitive.Indicator.Props) {
  return <TabsPrimitive.Indicator data-slot="tabs-indicator" {...props} />;
}
