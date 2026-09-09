import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Personal Ledger</h1>
      <p className="text-muted-foreground max-w-md">
        Track your income and expenses, all in one place.
      </p>
      <Button render={<Link href="/sign-in" />}>Sign in</Button>
    </main>
  );
}
