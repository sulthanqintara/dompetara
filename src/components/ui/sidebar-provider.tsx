"use client";
import { useEffect, useState, type ComponentProps } from "react";
import { cn } from "cn";
import { SidebarContext } from "./sidebar-context";

// Adapted from shadcn SidebarProvider; retain only the offcanvas layout we use.
export function SidebarProvider({ className, children, ...props }: ComponentProps<"div">) {
  const [open, setOpen] = useState(true);
  const [openMobile, setOpenMobile] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1199px)");
    const update = () => {
      setIsMobile(query.matches);
      if (!query.matches) setOpenMobile(false);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return (
    <SidebarContext.Provider value={{
      open, setOpen, isMobile, openMobile, setOpenMobile,
      toggleSidebar: () => isMobile ? setOpenMobile((value) => !value) : setOpen((value) => !value),
    }}>
      <div data-slot="sidebar-wrapper" className={cn("ledger-sidebar-wrapper", className)} {...props}>
        {children}
      </div>
    </SidebarContext.Provider>
  );
}
