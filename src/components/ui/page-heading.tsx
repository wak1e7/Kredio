import { ReactNode } from "react";

export function PageHeading({
  overline,
  title,
  description,
  actions,
}: {
  overline?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="animate-fade-up flex flex-wrap items-center justify-between gap-3 rounded-3xl px-1 py-1" style={{ animationDelay: "140ms" }}>
      <div>
        {overline ? (
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-muted)]">{overline}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-[var(--foreground-muted)]">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
