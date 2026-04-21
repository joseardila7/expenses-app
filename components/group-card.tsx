import Link from "next/link";

import { formatCurrency, formatShortDate } from "@/lib/format";
import type { GroupSummary } from "@/lib/domain";

type GroupCardProps = {
  summary: GroupSummary;
};

export function GroupCard({ summary }: GroupCardProps) {
  const lastExpense = summary.expenses[0];
  const firstSettlement = summary.settlements[0];

  return (
    <Link href={`/groups/${summary.group.id}`} className="group-card">
      <div className="group-card__topline">
        <span>{summary.participants.length} personas</span>
        <span>{summary.expenses.length} gastos</span>
      </div>

      <div className="group-card__title-wrap">
        <h3>{summary.group.name}</h3>
        <p>
          {summary.schemaMode === "advanced" && firstSettlement
            ? `${firstSettlement.fromParticipantName} debe ${formatCurrency(firstSettlement.amount)} a ${firstSettlement.toParticipantName}`
            : lastExpense
              ? `Último movimiento el ${formatShortDate(lastExpense.createdAt)}`
              : "Todavía no hay gastos registrados"}
        </p>
      </div>

      <div className="group-card__stats">
        <div>
          <span>Total</span>
          <strong>{formatCurrency(summary.totalSpent)}</strong>
        </div>
        <div>
          <span>Por persona</span>
          <strong>{formatCurrency(summary.averagePerParticipant)}</strong>
        </div>
      </div>

      <div className="group-card__footer">
        <span>Entrar al grupo</span>
        <span aria-hidden="true">{"->"}</span>
      </div>
    </Link>
  );
}
