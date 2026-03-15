import { cn } from "@/lib/cn";
import { ReactNode } from "react";

export function Panel({
  children,
  className,
  delay,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <article
      className={cn("animate-fade-up rounded-2xl border bg-[var(--surface)] p-4 shadow-[0_2px_12px_rgba(14,30,55,0.04)] md:p-5", className)}
      style={delay !== undefined ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </article>
  );
}
