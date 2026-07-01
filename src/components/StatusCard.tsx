export function StatusCard({
  title,
  value,
  description,
  className = ""
}: {
  title: string;
  value: string;
  description: string;
  className?: string;
}): React.ReactElement {
  return (
    <section className={`status-card ${className}`}>
      <h2>{title}</h2>
      <strong>{value}</strong>
      <p>{description}</p>
    </section>
  );
}
