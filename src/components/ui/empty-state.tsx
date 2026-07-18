import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <section className="grid min-h-72 place-items-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div>
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-teal-50 text-teal-800">
          <Icon aria-hidden="true" className="size-6" />
        </span>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
          {description}
        </p>
      </div>
    </section>
  );
}
