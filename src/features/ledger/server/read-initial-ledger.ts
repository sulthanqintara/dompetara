import "server-only";
import { cache } from "react";
import { readLedger } from "../read-ledger";

// The layout and route share admission, initialization, and bootstrap within one SSR request.
export const readInitialLedger = cache((userId: string) => readLedger(userId));
