type EmptyPanelProps = {
  title: string;
  description: string;
};

export function EmptyPanel({ title, description }: EmptyPanelProps) {
  return (
    <section className="panel empty-panel">
      <p className="eyebrow">Sin datos</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}
