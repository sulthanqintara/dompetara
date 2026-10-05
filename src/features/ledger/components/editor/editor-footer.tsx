import type { ReactNode } from "react";
export function EditorFooter({ children }: { children: ReactNode }) {
  return <div className="form-actions">{children}</div>;
}
