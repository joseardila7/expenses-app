import { formatCurrency, formatShortDate } from "@/lib/format";
import type { ExpenseView, SchemaMode } from "@/lib/domain";

type ExpenseListProps = {
  expenses: ExpenseView[];
  schemaMode: SchemaMode;
};

export function ExpenseList({ expenses, schemaMode }: ExpenseListProps) {
  return (
    <div className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Movimientos</p>
          <h2>Gastos del grupo</h2>
          <p className="panel__subcopy">
            Consulta el histórico de movimientos con una lectura limpia y rápida.
          </p>
        </div>
      </div>

      {expenses.length ? (
        <div className="expense-list">
          {expenses.map((expense) => (
            <article key={expense.id} className="expense-row">
              <div className="expense-row__meta">
                <span className="expense-row__badge">{formatShortDate(expense.createdAt)}</span>
                <span>{expense.isComplete ? "Completo" : schemaMode === "advanced" ? "Pendiente de reparto" : "Modo básico"}</span>
              </div>

              <div className="expense-row__content">
                <div>
                  <h3>{expense.description}</h3>
                  <p>
                    {expense.paidByParticipantName
                      ? `Pagó ${expense.paidByParticipantName}`
                      : "Sin pagador definido"}
                    {expense.shares.length
                      ? ` · Repartido entre ${expense.shares.map((share) => share.participantName).join(", ")}`
                      : ""}
                  </p>
                </div>

                <strong>{formatCurrency(expense.amount)}</strong>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">Todavía no hay gastos en este grupo.</p>
      )}
    </div>
  );
}
