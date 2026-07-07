export default function PageHeader({
  kicker,
  title,
  subtitle,
  actions,
}: {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8 animate-rise">
      <div>
        {kicker && <p className="kicker mb-1">{kicker}</p>}
        <h1 className="font-display text-2xl sm:text-3xl font-black text-ink">{title}</h1>
        {subtitle && <p className="text-muted mt-1.5 max-w-xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
