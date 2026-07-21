import type { ReactNode } from "react";

type MetricCardProps = {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
};

export function MetricCard({ title, value, detail, icon }: MetricCardProps) {
  return (
    <section className="rounded border border-borderColor bg-bgSecondary p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-textMuted">{title}</p>
          <p className="mt-2 text-2xl font-bold text-textPrimary">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded bg-kolia-mint dark:bg-emerald-900/40 text-kolia-green">{icon}</div>
      </div>
      <p className="mt-4 text-sm leading-6 text-textSecondary">{detail}</p>
    </section>
  );
}
