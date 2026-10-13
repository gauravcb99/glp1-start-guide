import { Suspense } from "react";
import { Loading } from "@/components/Notice";
import { strings } from "@/copy/strings";
import { SetupForm } from "./SetupForm";

export default function SetupPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{strings.setup.title}</h1>
        <p className="text-secondary">{strings.setup.intro}</p>
      </header>
      <Suspense fallback={<Loading label={strings.notices.loading} />}>
        <SetupForm />
      </Suspense>
    </main>
  );
}
