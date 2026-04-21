import { markSettlementPaid } from "@/app/actions";
import { ConfirmAction } from "@/components/confirm-action";
import { formatCurrency } from "@/lib/format";
import type { ParticipantBalance, Settlement } from "@/lib/domain";

type BalanceSummaryProps = {
  balances: ParticipantBalance[];
  settlements: Settlement[];
  incompleteExpenseCount: number;
  groupId: string;
};

export function BalanceSummary({
  balances,
  settlements,
  incompleteExpenseCount,
  groupId,
}: BalanceSummaryProps) {
  return (
    <section className="panel accent-panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Balances</p>
          <h2>Quién debe a quién</h2>
          <p className="panel__subcopy">
            Calculado a partir de quién pagó y del reparto definido en cada gasto.
          </p>
        </div>
      </div>

      {balances.length ? (
        <>
          <div className="balance-list">
            {balances.map((balance) => (
              <article key={balance.participantId} className="balance-row">
                <div>
                  <h3>{balance.participantName}</h3>
                  <p>
                    Pagó {formatCurrency(balance.paid)} · Le corresponde{" "}
                    {formatCurrency(balance.owes)}
                  </p>
                </div>

                <strong
                  className={
                    balance.net >= 0
                      ? "balance-row__amount balance-row__amount--positive"
                      : "balance-row__amount balance-row__amount--negative"
                  }
                >
                  {balance.net > 0 ? "+" : ""}
                  {formatCurrency(balance.net)}
                </strong>
              </article>
            ))}
          </div>

          <div className="settlement-list settlement-list--spaced">
            <h3 className="section-title">Liquidación sugerida</h3>
            {settlements.length ? (
              settlements.map((settlement, index) => (
                <article
                  key={`${settlement.fromParticipantId}-${settlement.toParticipantId}-${index}`}
                  className="settlement-row"
                >
                  <div>
                    <p>
                      <strong>{settlement.fromParticipantName}</strong> debe pagar a{" "}
                      <strong>{settlement.toParticipantName}</strong>
                    </p>
                    <p>{formatCurrency(settlement.amount)}</p>
                  </div>

                  <ConfirmAction
                    action={markSettlementPaid}
                    title="Marcar liquidación como pagada"
                    description={`Se registrará un pago de ${settlement.fromParticipantName} a ${settlement.toParticipantName}.`}
                    confirmLabel="Marcar como pagado"
                    triggerLabel="Pagado"
                    triggerVariant="primary"
                    hiddenFields={{
                      groupId,
                      fromParticipantId: settlement.fromParticipantId,
                      toParticipantId: settlement.toParticipantId,
                      amount: String(settlement.amount),
                    }}
                    successMessage="Pago registrado y balances actualizados."
                  />
                </article>
              ))
            ) : (
              <p className="empty-state">No hay liquidaciones pendientes.</p>
            )}
          </div>
        </>
      ) : (
        <p className="empty-state">
          Aún no hay suficientes gastos completos para calcular balances reales.
        </p>
      )}

      {incompleteExpenseCount > 0 ? (
        <p className="notice-inline">
          Hay {incompleteExpenseCount} gasto(s) antiguos sin pagador o reparto. No se usan en el cálculo.
        </p>
      ) : null}
    </section>
  );
}
