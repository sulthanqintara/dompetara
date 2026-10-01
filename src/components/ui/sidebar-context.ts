"use client";
import { createContext } from "react";

export const SidebarContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
  isMobile: boolean;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  toggleSidebar: () => void;
} | null>(null);
