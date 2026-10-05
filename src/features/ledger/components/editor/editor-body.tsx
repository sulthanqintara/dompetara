import type { ReactNode } from "react";
export function EditorBody({ children }: { children: ReactNode }) {
  return <div className="editor-body">{children}</div>;
}
