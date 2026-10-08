import "server-only";

type TimingContext = {
  requestId: string;
  source: "ledger-layout" | "ledger-read";
  prefetch?: boolean;
  rsc?: boolean;
};

// Log timings only: never accept request headers, user IDs, or operation results.
export async function measureServerStage<T>(
  context: TimingContext,
  stage: string,
  operation: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  let completed = false;
  try {
    const result = await operation();
    completed = true;
    return result;
  } finally {
    if (process.env.NODE_ENV !== "production" || process.env.LEDGER_PERFORMANCE_LOGS === "1") {
      console.info("[ledger performance]", JSON.stringify({
        ...context,
        stage,
        durationMs: Math.round((performance.now() - start) * 10) / 10,
        outcome: completed ? "completed" : "interrupted",
      }));
    }
  }
}
