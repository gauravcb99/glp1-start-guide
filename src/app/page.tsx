import { ConnectionStatus } from "@/components/ConnectionStatus";
import { strings } from "@/copy/strings";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{strings.appName}</h1>
      <ConnectionStatus />
    </main>
  );
}
