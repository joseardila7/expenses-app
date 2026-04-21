import { CreateGroupForm } from "@/components/forms";
import { GroupCard } from "@/components/group-card";
import { EmptyPanel } from "@/components/empty-panel";
import { ErrorPanel } from "@/components/error-panel";
import { UpgradeNotice } from "@/components/upgrade-notice";
import { UserSession } from "@/components/user-session";
import { requireAuthenticatedProfile } from "@/lib/auth";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { getDashboardData } from "@/lib/supabase-data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireAuthenticatedProfile();
  const result = await getDashboardData();

  if (result.error) {
    return (
      <main className="shell">
        <ErrorPanel
          title="No se pudo leer Supabase"
          description="La interfaz ya está conectada al backend, pero el proyecto no responde desde este entorno."
          detail={result.error}
        />
      </main>
    );
  }

  if (!result.data) {
    return (
      <main className="shell">
        <EmptyPanel
          title="Todavía no hay datos"
          description="Cuando crees el primer grupo, aparecerá aquí con sus gastos y participantes."
        />
      </main>
    );
  }

  const { groups, totals, schemaMode } = result.data;
  const recentExpenses = groups.flatMap((group) => group.expenses).slice(0, 4);

  return (
    <main className="shell">
      <header className="app-bar">
        <div>
          <p className="app-bar__kicker">Gastos App</p>
          <strong>Hola, {user.displayName}. Este es tu espacio privado.</strong>
        </div>
        <div className="app-bar__actions">
          <span className="app-bar__status">
            {schemaMode === "advanced" ? "Balances activados" : "Modo básico activo"}
          </span>
          <UserSession displayName={user.displayName} email={user.email} />
        </div>
      </header>

      {schemaMode === "legacy" ? <UpgradeNotice /> : null}

      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow">Control de gastos compartidos</p>
          <h1>La forma profesional de ordenar grupos, personas y gastos.</h1>
          <p className="hero__lede">
            Esta versión trabaja con tu backend real y está lista para crecer hacia una app completa de
            gastos compartidos con balances y liquidaciones.
          </p>

          <div className="hero__chips">
            <span>Panel en tiempo real</span>
            <span>Alta rápida de grupos</span>
            <span>Reparto de gastos</span>
          </div>

          <div className="hero__actions">
            <a href="#nuevo-grupo" className="button button--primary">
              Crear grupo
            </a>
            <a href="#grupos" className="button button--ghost">
              Explorar panel
            </a>
          </div>
        </div>

        <div className="hero__spotlight">
          <div className="spotlight-card">
            <span className="spotlight-card__label">Resumen global</span>
            <strong>{formatCurrency(totals.spent)}</strong>
            <p>Movidos en {totals.groups} grupos activos</p>
          </div>

          <div className="spotlight-grid">
            <div className="spotlight-mini">
              <span>Participantes</span>
              <strong>{totals.participants}</strong>
            </div>
            <div className="spotlight-mini">
              <span>Último gasto</span>
              <strong>{recentExpenses[0] ? formatShortDate(recentExpenses[0].createdAt) : "--"}</strong>
            </div>
          </div>

          <div className="spotlight-note">
            <p>
              Un espacio pensado para ver el estado del grupo de un vistazo, sin perder legibilidad ni ritmo visual.
            </p>
          </div>
        </div>
      </section>

      <section className="stats-strip">
        <article>
          <span>Total registrado</span>
          <strong>{formatCurrency(totals.spent)}</strong>
        </article>
        <article>
          <span>Participantes activos</span>
          <strong>{totals.participants}</strong>
        </article>
        <article>
          <span>Gastos guardados</span>
          <strong>{totals.expenses}</strong>
        </article>
      </section>

      <section className="dashboard-grid" id="grupos">
        <div className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Tus grupos</p>
              <h2>Panorama rápido</h2>
              <p className="panel__subcopy">
                Accede al detalle de cada grupo y mantén el contexto financiero bien ordenado.
              </p>
            </div>
          </div>

          {groups.length ? (
            <div className="group-grid">
              {groups.map((group) => (
                <GroupCard key={group.group.id} summary={group} />
              ))}
            </div>
          ) : (
            <p className="empty-state">Aún no hay grupos guardados en tu cuenta.</p>
          )}
        </div>

        <aside className="panel accent-panel panel--form">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Nuevo grupo</p>
              <h2>Crea desde aquí</h2>
              <p className="panel__subcopy">
                Empieza con un nombre claro y después añade personas y gastos dentro del grupo.
              </p>
            </div>
          </div>

          <div id="nuevo-grupo">
            <CreateGroupForm />
          </div>
        </aside>
      </section>

      <section className="panel section-space">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Actividad reciente</p>
            <h2>Últimos gastos registrados</h2>
            <p className="panel__subcopy">
              Los movimientos más recientes quedan visibles para que el seguimiento diario sea inmediato.
            </p>
          </div>
        </div>

        {recentExpenses.length ? (
          <div className="recent-list">
            {recentExpenses.map((expense) => (
              <article key={expense.id} className="recent-row">
                <div>
                  <h3>{expense.description}</h3>
                  <p>{formatShortDate(expense.createdAt)}</p>
                </div>
                <strong>{formatCurrency(Number(expense.amount))}</strong>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">Cuando registres gastos, aparecerán aquí.</p>
        )}
      </section>
    </main>
  );
}
