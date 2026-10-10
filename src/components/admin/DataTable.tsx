import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui";

export type Column<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
};

/** Generic, responsive admin table. Server component — cells are rendered on the server. */
export function DataTable<T>({
  columns,
  rows,
  emptyTitle = "Nothing here yet",
  emptyMessage,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyTitle?: string;
  emptyMessage?: string;
  rowKey: (row: T, index: number) => string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 ${c.className ?? ""}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)} className="align-middle hover:bg-slate-50/70">
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-3 text-slate-700 ${c.className ?? ""}`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Page heading used by every admin section. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{eyebrow}</p>
        )}
        <h1 className="font-display text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
