import { notFound } from "next/navigation";

// Dev only. Lists DailyRows in Phase 2.
export default function DebugPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <main className="flex-1" />;
}
