type ErrorPanelProps = {
  title: string;
  description: string;
  detail?: string | null;
};

export function ErrorPanel({ title, description, detail }: ErrorPanelProps) {
  return (
    <section className="panel error-panel">
      <p className="eyebrow">Conexión</p>
      <h2>{title}</h2>
      <p>{description}</p>
      {detail ? <pre className="error-panel__detail">{detail}</pre> : null}
    </section>
  );
}
