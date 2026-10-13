"use client";

import { ConnectionStatus } from "@/components/ConnectionStatus";

// Member inputs form comes in Phase 5 (reads localStorage inside useEffect with try/catch).
export default function SetupPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <ConnectionStatus />
    </main>
  );
}
