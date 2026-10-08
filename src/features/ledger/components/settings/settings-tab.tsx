import { LanguageSettings } from "@/features/i18n/components/language-settings";
import type { Ledger } from "../../ledger";
import { ExportSettings } from "./export-settings";
import { AccountSettings } from "./account-settings";
import { CategoriesSettings } from "./categories-settings";

export function SettingsTab({
  name,
  email,
  data,
  pending,
  error,
  setPending,
  setError,
  save,
}: {
  name: string;
  email: string;
  data: Ledger;
  pending: boolean;
  error: string;
  setPending: (pending: boolean) => void;
  setError: (error: string) => void;
  save: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  return (
    <>
      <AccountSettings
        name={name}
        email={email}
        pending={pending}
        setPending={setPending}
        setError={setError}
      />
      <LanguageSettings />
      <ExportSettings pending={pending} />
      <CategoriesSettings
        data={data}
        pending={pending}
        error={error}
        save={save}
      />
    </>
  );
}
