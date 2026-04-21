type UpgradeNoticeProps = {
  title?: string;
  description?: string;
};

export function UpgradeNotice({
  title = "Activa los balances avanzados",
  description = "Tu proyecto sigue usando el esquema básico. Para calcular quién paga y cómo se reparte cada gasto, ejecuta la migración avanzada de Supabase.",
}: UpgradeNoticeProps) {
  return (
    <section className="panel upgrade-notice">
      <p className="eyebrow">Migración recomendada</p>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="upgrade-notice__code">
        <code>supabase/migrate-balances.sql</code>
        <code>supabase/setup.sql</code>
      </div>
    </section>
  );
}
