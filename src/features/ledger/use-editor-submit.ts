import { useState, type FormEvent } from "react";
import type { EditorFormProps } from "./editor";

export function useEditorSubmit(buildPayload: (values: Record<string, FormDataEntryValue>) => Record<string, unknown>, save: EditorFormProps["save"]) {
  const [formError, setFormError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setFormError("");
    try {
      await save(buildPayload(values));
    } catch (error) {
      setFormError(error instanceof Error && error.name !== "ZodError" ? error.message : "Check the item names, amounts and quantities.");
    }
  }
  return { formError, setFormError, submit };
}
