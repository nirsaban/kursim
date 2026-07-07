export default function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      {icon ? (
        <div className="w-12 h-12 rounded-2xl bg-paper text-ink flex items-center justify-center text-xl mb-4">
          {icon}
        </div>
      ) : (
        <div className="inline-flex gap-1.5 mb-3">
          <span className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-seat" />
          <span className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-seat" />
          <span className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-seat" />
        </div>
      )}
      <p className="font-semibold text-ink">{title}</p>
      {hint && <p className="text-sm text-muted mt-1 max-w-sm">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
