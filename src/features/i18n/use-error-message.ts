import { useTranslations } from "next-intl";
import messages from "../../../messages/en.json";

const keys = new Map(Object.entries(messages.Errors).map(([key, value]) => [value, key]));

export function useErrorMessage() {
  const t = useTranslations("Errors");
  return (message: string) => message ? t(keys.get(message) ?? "somethingWentWrongPleaseTryAgain") : "";
}
