"use client";

import { cn } from "@/lib/cn";
import { Search } from "lucide-react";
import { ReactNode } from "react";

type SearchConfig = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
};

type ListFiltersProps = {
  search?: SearchConfig;
  children: ReactNode;
};

export function ListFilters({ search, children }: ListFiltersProps) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {search ? (
        <label className="md:col-span-2">
          <span className="sr-only">{search.label}</span>
          <span className="flex items-center gap-2 rounded-xl border bg-[var(--surface)] px-3 py-2">
            <Search className="h-4 w-4 text-[var(--foreground-muted)]" />
            <input
              placeholder={search.placeholder}
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--foreground-muted)]"
              value={search.value}
              onChange={(event) => search.onChange(event.target.value)}
            />
          </span>
        </label>
      ) : (
        <div className="hidden md:block md:col-span-2" />
      )}
      <div className={cn("min-w-0", !search && "md:col-start-3")}>{children}</div>
    </div>
  );
}
