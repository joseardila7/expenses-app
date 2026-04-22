import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteGroup } from "@/app/actions";
import { BalanceSummary } from "@/components/balance-summary";
import { ConfirmAction } from "@/components/confirm-action";
import { CreateExpenseForm, CreateParticipantForm } from "@/components/forms";
import { ErrorPanel } from "@/components/error-panel";
import { ExpenseList } from "@/components/expense-list";
import { GroupInvitationsPanel } from "@/components/group-invitations-panel";
import { ParticipantsPanel } from "@/components/participants-panel";
import { PaymentsList } from "@/components/payments-list";
import { UpgradeNotice } from "@/components/upgrade-notice";
import { UserSession } from "@/components/user-session";
import { requireAuthenticatedProfile } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { getGroupData } from "@/lib/supabase-data";

type GroupPageProps = {
  params: Promise<{ groupId: string }>;
};

export default async function GroupPage({ params }: GroupPageProps) {
  const user = await requireAuthenticatedProfile();
  const { groupId } = await params;
  const result = await getGroupData(groupId);

  if (result.error) {
    return (
      <main className="shell shell--detail">
        <ErrorPanel
          title="No se pudo abrir el grupo"
          description="La página ya está conectada a Supabase, pero la consulta ha fallado."
          detail={result.error}
        />
      </main>
    );
  }

  const snapshot = result.data;

  if (!snapshot) {
    notFound();
  }

  return (
    <main className="shell shell--detail">
      <header className="app-bar app-bar--detail">
        <div>
          <p className="app-bar__kicker">Vista de grupo</p>
          <strong>{snapshot.group.name}</strong>
        </div>
        <div className="app-bar__actions">
          <span className="app-bar__status">
            {snapshot.schemaMode === "advanced" ? "Balances activos" : "Modo básico"}
          </span>
          <UserSession displayName={user.displayName} email={user.email} />
          <ConfirmAction
            action={deleteGroup}
            title={`Eliminar ${snapshot.group.name}`}
            description="Se borrará el grupo y todo su contenido. Solo debería hacerse cuando ya no queden deudas ni movimientos pendientes."
            confirmLabel="Eliminar grupo"
            triggerLabel="Borrar grupo"
            triggerVariant="ghost"
            hiddenFields={{ groupId: snapshot.group.id }}
            disabled={!snapshot.canDeleteGroup}
            successMessage={`Grupo ${snapshot.group.name} eliminado.`}
            redirectTo="/"
          />
        </div>
      </header>

      {snapshot.schemaMode === "legacy" ? (
        <UpgradeNotice
          title="Este grupo aún está en modo básico"
          description="Puedes seguir registrando gastos, pero para calcular quién debe a quién necesitas aplicar la migración avanzada de Supabase."
        />
      ) : null}

      <section className="detail-hero">
        <div>
          <Link href="/" className="back-link">
            {"<- Volver al panel"}
          </Link>
          <p className="eyebrow">Detalle de grupo</p>
          <h1>{snapshot.group.name}</h1>
          <p className="detail-hero__lede">
            Desde aquí puedes añadir personas, registrar gastos y, si ya has activado el reparto avanzado,
            ver los balances reales del grupo.
          </p>
        </div>

        <div className="detail-stats">
          <article>
            <span>Total gastado</span>
            <strong>{formatCurrency(snapshot.totalSpent)}</strong>
          </article>
          <article>
            <span>Media por participante</span>
            <strong>{formatCurrency(snapshot.averagePerParticipant)}</strong>
          </article>
          <article>
            <span>Pagado después</span>
            <strong>{formatCurrency(snapshot.totalPaidBack)}</strong>
          </article>
        </div>
      </section>

      <section className="detail-grid">
        <div className="detail-grid__main">
          <BalanceSummary
            balances={snapshot.balances}
            settlements={snapshot.settlements}
            incompleteExpenseCount={snapshot.incompleteExpenseCount}
            groupId={snapshot.group.id}
            paymentsEnabled={snapshot.paymentsEnabled}
          />
          <PaymentsList payments={snapshot.payments} />
          <ExpenseList expenses={snapshot.expenses} schemaMode={snapshot.schemaMode} />
        </div>

        <aside className="detail-grid__side">
          <ParticipantsPanel
            participants={snapshot.participants}
            balances={snapshot.balances}
            groupId={snapshot.group.id}
            compact
          />
          <GroupInvitationsPanel
            groupId={snapshot.group.id}
            groupName={snapshot.group.name}
            invitations={snapshot.invitations}
          />
          <section className="panel panel--form panel--compact">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Alta rápida</p>
                <h2>Añadir al grupo</h2>
                <p className="panel__subcopy">
                  Mantén el grupo al día con altas rápidas de participantes y nuevos movimientos.
                </p>
              </div>
            </div>

            <div className="stack-cluster stack-cluster--compact">
              <CreateParticipantForm groupId={snapshot.group.id} />
              <CreateExpenseForm
                groupId={snapshot.group.id}
                participants={snapshot.participants}
                schemaMode={snapshot.schemaMode}
              />
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
