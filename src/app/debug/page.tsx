import { notFound } from "next/navigation";
import { DebugTable } from "./DebugTable";

// Dev only: lists DailyRows from /api/whoop/days. 404 in production builds.
export default function DebugPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="flex-1 px-6 py-8">
      <DebugTable />
    </main>
  );
}
