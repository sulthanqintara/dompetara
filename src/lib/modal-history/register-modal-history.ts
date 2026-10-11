import { createModalHistory } from "./create-modal-history";

const modalHistory = createModalHistory();

/** Register an open modal without changing the URL or discarding router state. */
export function registerModalHistory(close: () => void) {
  return modalHistory.register(close);
}
