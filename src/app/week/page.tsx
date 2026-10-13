import { Suspense } from "react";
import { Loading } from "@/components/Notice";
import { strings } from "@/copy/strings";
import { WeekView } from "./WeekView";

export default function WeekPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <Suspense fallback={<Loading label={strings.notices.loading} />}>
        <WeekView />
      </Suspense>
    </main>
  );
}
