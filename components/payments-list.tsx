import { formatCurrency, formatShortDate } from "@/lib/format";
import type { PaymentView } from "@/lib/domain";

type PaymentsListProps = {
  payments: PaymentView[];
};

export function PaymentsList({ payments }: PaymentsListProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Pagos</p>
          <h2>Liquidaciones registradas</h2>
          <p className="panel__subcopy">
            Aquí quedan guardados los pagos que ya se han marcado como resueltos.
          </p>
        </div>
      </div>

      {payments.length ? (
        <div className="settlement-list">
          {payments.map((payment) => (
            <article key={payment.id} className="settlement-row">
              <div>
                <p>
                  <strong>{payment.fromParticipantName}</strong> pagó a{" "}
                  <strong>{payment.toParticipantName}</strong>
                </p>
                <p>{formatShortDate(payment.createdAt)}</p>
              </div>
              <strong>{formatCurrency(payment.amount)}</strong>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">Todavía no hay liquidaciones registradas.</p>
      )}
    </section>
  );
}
