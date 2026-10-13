import Link from "next/link";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { strings } from "@/copy/strings";

const l = strings.landing;

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-16">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{strings.appName}</h1>
        <p className="max-w-2xl text-lg text-secondary">{l.oneLiner}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/demo"
          className="rounded-full bg-foreground px-5 py-2.5 text-center font-medium text-background hover:opacity-90"
        >
          {l.tryDemo}
        </Link>
        {/* Plain <a>, not <Link>, so nothing prefetches the login route. */}
        <a
          href="/api/auth/login"
          className="rounded-full border border-border px-5 py-2.5 text-center font-medium hover:bg-surface"
        >
          {l.connect}
        </a>
      </div>
      <ConnectionStatus showConnect={false} />
      <Link href="/method" className="text-sm text-muted underline hover:text-foreground">
        {l.howItWorks}
      </Link>
    </main>
  );
}
