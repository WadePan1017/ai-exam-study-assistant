export default function Loading() {
  return (
    <div aria-label="正在加载" className="space-y-4" role="status">
      <div className="h-8 w-48 animate-pulse rounded-xl bg-slate-200" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded-lg bg-slate-200" />
      <div className="mt-8 h-64 animate-pulse rounded-3xl bg-slate-200" />
    </div>
  );
}
