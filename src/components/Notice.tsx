import Link from "next/link";

/** Friendly state card: a title, one line, and an optional action. */
export function Notice({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: { href: string; label: string; external?: boolean };
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-4">
      <p className="font-medium">{title}</p>
      {body && <p className="mt-1 text-sm text-secondary">{body}</p>}
      {action &&
        (action.external ? (
          <a href={action.href} className="mt-3 inline-block text-sm font-medium text-series underline">
            {action.label}
          </a>
        ) : (
          <Link href={action.href} className="mt-3 inline-block text-sm font-medium text-series underline">
            {action.label}
          </Link>
        ))}
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return <p className="text-sm text-muted">{label}</p>;
}
