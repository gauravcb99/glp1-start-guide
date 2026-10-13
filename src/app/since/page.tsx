import { Suspense } from "react";
import { Loading } from "@/components/Notice";
import { strings } from "@/copy/strings";
import { SinceView } from "./SinceView";

export default function SincePage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <Suspense fallback={<Loading label={strings.notices.loading} />}>
        <SinceView />
      </Suspense>
    </main>
  );
}
