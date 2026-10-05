import type { ComponentProps } from "react";
import { EditorForm } from "./editor-form";
export function IncomeModal(
  props: Omit<ComponentProps<typeof EditorForm>, "kind">,
) {
  return <EditorForm {...props} kind="income" />;
}
