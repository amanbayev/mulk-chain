export function PageHeader({
  kicker,
  title,
  description,
}: {
  kicker?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-8">
      {kicker ? <p className="label-caps">{kicker}</p> : null}
      <h1 className="mt-1 text-2xl font-medium tracking-tight">{title}</h1>
      {description ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
