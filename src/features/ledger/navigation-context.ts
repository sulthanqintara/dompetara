"use client";
import { createContext } from "react";

export const NavigationContext = createContext<((href: string) => void) | null>(null);
