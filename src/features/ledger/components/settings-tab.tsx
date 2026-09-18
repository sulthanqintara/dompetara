import { useRouter } from "next/navigation";
import { LogOut, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import type { Ledger } from "../ledger";

export function SettingsTab({
  name,
  email,
  data,
  pending,
  setPending,
  setError,
  save,
}: {
  name: string;
  email: string;
  data: Ledger;
  pending: boolean;
  setPending: (pending: boolean) => void;
  setError: (error: string) => void;
  save: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const router = useRouter();
  return (
    <>
      <section className="panel settings-panel">
        <h3>Your account</h3>
        <p>
          {name} · {email}
        </p>
        <p>
          Amounts are tracked in IDR, USD, and CAD. Dates use your device’s
          local timezone.
        </p>
        <button
          className="secondary"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              const result = await authClient.signOut();
              if (result.error) throw new Error(result.error.message);
              router.push("/sign-in");
              router.refresh();
            } catch {
              setError("Could not sign out. Please try again.");
              setPending(false);
            }
          }}
        >
          <LogOut size={16} />
          Sign out
        </button>
      </section>
      <section className="panel settings-panel">
        <h3>Categories</h3>
        <p>Removing a category keeps it on past transactions.</p>
        <form
          className="category-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            if (
              await save({
                action: "category",
                ...Object.fromEntries(new FormData(form)),
              })
            )
              form.reset();
          }}
        >
          <label>
            Category name
            <input
              required
              name="name"
              maxLength={1000}
              placeholder="e.g. Entertainment"
            />
          </label>
          <label>
            Type
            <select name="kind">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </label>
          <button className="primary" disabled={pending}>
            Add category
          </button>
        </form>
        {(["income", "expense"] as const).map((kind) => (
          <div key={kind} className="category-group">
            <h4>{kind} categories</h4>
            <div className="chips">
              {data.categories
                .filter((c) => c.kind === kind)
                .map((c) => (
                  <span className="chip" key={c.id}>
                    {c.name}
                    <button
                      aria-label={`Remove ${c.name}`}
                      disabled={pending}
                      onClick={() => {
                        if (
                          confirm(
                            `Remove ${c.name} from future transactions?`,
                          )
                        )
                          void save({
                            action: "deleteCategory",
                            id: c.id,
                          });
                      }}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
