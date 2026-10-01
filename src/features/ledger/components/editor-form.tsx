import { useEffect, useRef, useState, type FormEvent } from "react";
import { Trash2, X } from "lucide-react";
import { localDate } from "../format";
import {
  balance,
  currencies,
  type Currency,
  type Entry,
  type Ledger,
  type Wallet,
} from "../ledger";

export type Editor =
  | { type: "entry"; entry?: Entry }
  | { type: "wallet"; wallet?: Wallet; currency?: Currency };

export function EditorForm({
  editor,
  data,
  pending,
  error,
  close,
  save,
}: {
  editor: Editor;
  data: Ledger;
  pending: boolean;
  error: string;
  close: () => void;
  save: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const node = dialog.current;
    document.body.style.overflow = "hidden";
    node?.showModal();
    return () => {
      node?.close();
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);
  const entry = editor.type === "entry" ? editor.entry : undefined;
  const w = editor.type === "wallet" ? editor.wallet : undefined;
  const [kind, setKind] = useState(entry?.kind ?? "expense");
  const [cur, setCur] = useState<Currency>(
    entry?.currency ??
      (editor.type === "wallet"
        ? (editor.currency ?? w?.currencies[0])
        : data.wallets[0]?.currencies[0]) ??
      "IDR",
  );
  const [toCur, setToCur] = useState<Currency>(entry?.toCurrency ?? cur);
  const [walletId, setWalletId] = useState(
    entry?.wallet ??
      data.wallets.find((w) => w.currencies.includes(cur))?.id ??
      "",
  );
  const [toWalletId, setToWalletId] = useState(entry?.toWallet ?? "");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    await save({
      ...values,
      action: editor.type,
      id: entry?.id ?? w?.id,
      ...(editor.type === "entry"
        ? { date: new Date(String(values.date)).toISOString() }
        : {}),
    });
  }
  return (
    <dialog
      ref={dialog}
      aria-modal="true"
      aria-labelledby="editor-title"
      className="editor"
      onClick={(e) => {
        if (e.target !== e.currentTarget || pending) return;
        const bounds = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < bounds.left ||
          e.clientX > bounds.right ||
          e.clientY < bounds.top ||
          e.clientY > bounds.bottom
        ) {
          close();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) close();
      }}
    >
      <div className="panel-heading">
        <div>
          <span className="eyebrow">KEEP YOUR LEDGER UP TO DATE</span>
          <h2 id="editor-title">
            {editor.type === "wallet"
              ? w
                ? "Edit wallet"
                : "Add a wallet"
              : entry
                ? "Edit transaction"
                : "Add transaction"}
          </h2>
        </div>
        <button aria-label="Close" onClick={close} disabled={pending}>
          <X />
        </button>
      </div>
      <form onSubmit={submit}>
        {editor.type === "wallet" ? (
          <>
            <label>
              Wallet name
              <input
                autoComplete="off"
                name="name"
                required
                maxLength={1000}
                defaultValue={w?.name}
                placeholder="e.g. BCA"
              />
            </label>
            <label>
              Currency
              <select
                name="currency"
                value={cur}
                onChange={(e) => setCur(e.target.value as Currency)}
              >
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              {w?.currencies.includes(cur)
                ? "Current balance"
                : "Opening balance"}
              <input
                key={cur}
                type="number"
                step="0.01"
                name="amount"
                required
                defaultValue={w ? balance(data, w.id, cur) / 100 : 0}
              />
            </label>
            <p className="hint">
              {w
                ? "A balance change adds a correction to your history. Select a new currency to add another balance to this wallet."
                : "You can add more currencies to this wallet later."}
            </p>
          </>
        ) : (
          <>
            <div className="segmented">
              {["income", "expense", "transfer"].map((k) => (
                <button
                  key={k}
                  type="button"
                  className={kind === k ? "selected" : ""}
                  onClick={() => setKind(k as Entry["kind"])}
                >
                  {k}
                </button>
              ))}
            </div>
            <input type="hidden" name="kind" value={kind} />
            <label>
              Date & time
              <input
                name="date"
                type="datetime-local"
                required
                defaultValue={localDate(
                  entry ? new Date(entry.date) : new Date(),
                )}
              />
            </label>
            <div className="form-row">
              <label>
                Currency
                <select
                  name="currency"
                  value={cur}
                  onChange={(e) => {
                    const c = e.target.value as Currency;
                    setCur(c);
                    setWalletId(
                      data.wallets.find((w) => w.currencies.includes(c))
                        ?.id ?? "",
                    );
                  }}
                >
                  {currencies.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                {kind === "transfer" ? "From wallet" : "Wallet"}
                <select
                  name="wallet"
                  required
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                >
                  <option value="" disabled>
                    Choose wallet
                  </option>
                  {data.wallets
                    .filter((w) => w.currencies.includes(cur))
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <label>
              {kind === "transfer" ? "Amount sent" : "Amount"}
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                max="999999999999.99"
                required
                defaultValue={entry ? entry.amount / 100 : ""}
                placeholder="0.00"
              />
            </label>
            {kind === "transfer" ? (
              <>
                <div className="form-row">
                  <label>
                    Destination currency
                    <select
                      name="toCurrency"
                      value={toCur}
                      onChange={(e) => {
                        setToCur(e.target.value as Currency);
                        setToWalletId("");
                      }}
                    >
                      {currencies.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    To wallet
                    <select
                      name="toWallet"
                      required
                      value={toWalletId}
                      onChange={(e) => setToWalletId(e.target.value)}
                    >
                      <option value="" disabled>
                        Choose wallet
                      </option>
                      {data.wallets
                        .filter(
                          (w) =>
                            w.currencies.includes(toCur) &&
                            !(w.id === walletId && cur === toCur),
                        )
                        .map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                {cur !== toCur && (
                  <label>
                    Amount received ({toCur})
                    <input
                      name="received"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      defaultValue={
                        entry?.received ? entry.received / 100 : ""
                      }
                    />
                    <small>
                      Enter the actual converted amount credited to the
                      destination.
                    </small>
                  </label>
                )}
              </>
            ) : (
              <>
                <label>
                  Title
                  <input
                    name="title"
                    required
                    maxLength={1000}
                    defaultValue={entry?.title}
                    placeholder="e.g. Karaokean"
                  />
                </label>
                <label>
                  Category
                  <select
                    key={kind}
                    name="category"
                    required
                    defaultValue={entry?.kind === kind ? entry.category : ""}
                  >
                    <option value="" disabled>
                      Choose category
                    </option>
                    {entry?.kind === kind &&
                      !data.categories.some(
                        (c) => c.kind === kind && c.name === entry.category,
                      ) && <option>{entry.category}</option>}
                    {data.categories
                      .filter((c) => c.kind === kind)
                      .map((c) => (
                        <option key={c.id}>{c.name}</option>
                      ))}
                  </select>
                  <small>Manage categories in Settings.</small>
                </label>
              </>
            )}
            <label>
              Description <span className="optional">optional</span>
              <textarea
                name="description"
                maxLength={1000}
                defaultValue={entry?.description}
                placeholder="Anything you’d like to remember"
              />
            </label>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          {entry && (
            <button
              type="button"
              className="danger"
              disabled={pending}
              onClick={() => {
                if (
                  confirm(
                    "Delete this transaction? Wallet balances will be adjusted.",
                  )
                )
                  void save({ action: "deleteEntry", id: entry.id });
              }}
            >
              <Trash2 size={16} />
              Delete
            </button>
          )}
          <button
            type="button"
            className="secondary"
            onClick={close}
            disabled={pending}
          >
            Cancel
          </button>
          <button className="primary" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
