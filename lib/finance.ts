import type {
  ExpenseRecord,
  ExpenseShareRecord,
  ParticipantBalance,
  ParticipantRecord,
  PaymentRecord,
  Settlement,
} from "@/lib/domain";

export function round(value: number) {
  return Math.round(value * 100) / 100;
}

export function splitAmount(amount: number, participantIds: string[]) {
  const cleanIds = participantIds.filter(Boolean);
  if (!cleanIds.length) {
    return [];
  }

  const totalCents = Math.round(amount * 100);
  const base = Math.floor(totalCents / cleanIds.length);
  const remainder = totalCents - base * cleanIds.length;

  return cleanIds.map((participantId, index) => ({
    participantId,
    amount: (base + (index < remainder ? 1 : 0)) / 100,
  }));
}

export function calculateBalances(
  participants: ParticipantRecord[],
  expenses: ExpenseRecord[],
  shares: ExpenseShareRecord[],
  payments: PaymentRecord[],
) {
  const byParticipant = new Map<string, ParticipantBalance>();

  for (const participant of participants) {
    byParticipant.set(participant.id, {
      participantId: participant.id,
      participantName: participant.name,
      paid: 0,
      owes: 0,
      net: 0,
      canDelete: true,
    });
  }

  const sharesByExpense = new Map<string, ExpenseShareRecord[]>();
  for (const share of shares) {
    const list = sharesByExpense.get(share.expense_id) ?? [];
    list.push(share);
    sharesByExpense.set(share.expense_id, list);
  }

  for (const expense of expenses) {
    if (!expense.paid_by_participant_id) {
      continue;
    }

    const payer = byParticipant.get(expense.paid_by_participant_id);
    if (payer) {
      payer.paid = round(payer.paid + Number(expense.amount));
      payer.canDelete = false;
    }

    const expenseShares = sharesByExpense.get(expense.id) ?? [];
    for (const share of expenseShares) {
      const participant = byParticipant.get(share.participant_id);
      if (participant) {
        participant.owes = round(participant.owes + Number(share.amount));
        participant.canDelete = false;
      }
    }
  }

  for (const payment of payments) {
    const from = byParticipant.get(payment.from_participant_id);
    const to = byParticipant.get(payment.to_participant_id);

    if (from) {
      from.paid = round(from.paid + Number(payment.amount));
      from.canDelete = false;
    }

    if (to) {
      to.owes = round(to.owes + Number(payment.amount));
      to.canDelete = false;
    }
  }

  const balances = Array.from(byParticipant.values())
    .map((participant) => ({
      ...participant,
      net: round(participant.paid - participant.owes),
      canDelete: Math.abs(round(participant.paid - participant.owes)) < 0.01,
    }))
    .sort((left, right) => right.net - left.net);

  return {
    balances,
    settlements: calculateSettlements(balances),
  };
}

function calculateSettlements(balances: ParticipantBalance[]) {
  const creditors = balances
    .filter((participant) => participant.net > 0.01)
    .map((participant) => ({ ...participant }));

  const debtors = balances
    .filter((participant) => participant.net < -0.01)
    .map((participant) => ({ ...participant, net: Math.abs(participant.net) }));

  const settlements: Settlement[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = round(Math.min(creditor.net, debtor.net));

    settlements.push({
      fromParticipantId: debtor.participantId,
      fromParticipantName: debtor.participantName,
      toParticipantId: creditor.participantId,
      toParticipantName: creditor.participantName,
      amount,
    });

    creditor.net = round(creditor.net - amount);
    debtor.net = round(debtor.net - amount);

    if (creditor.net <= 0.01) {
      creditorIndex += 1;
    }

    if (debtor.net <= 0.01) {
      debtorIndex += 1;
    }
  }

  return settlements;
}
