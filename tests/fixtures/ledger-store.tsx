import { useState } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { LedgerStoreWorkspace } from "./ledger-store/ledger-store-workspace";
import { renders } from "./ledger-store/renders";

export function LedgerStoreFixture() {
  const [account, setAccount] = useState("first");
  return <><button id="switch" onClick={() => setAccount("second")}>Switch</button><LedgerStoreWorkspace key={account} account={account} /></>;
}
const container = document.getElementById("root")!;
container.innerHTML = renderToString(<LedgerStoreFixture />);
const errors: unknown[] = [];
hydrateRoot(container, <LedgerStoreFixture />, { onRecoverableError: (error) => errors.push(String(error)) });
Object.assign(window, { storeTest: { renders, errors, mountSecond: () => {
  const element = document.createElement("div"); element.id = "other"; document.body.append(element);
  createRoot(element).render(<LedgerStoreWorkspace account="independent" />);
} } });
