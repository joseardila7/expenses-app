import { cache } from "react";

import { calculateBalances, round } from "@/lib/finance";
import { createSupabaseReadClient } from "@/lib/supabaseClient";
import type {
  DashboardData,
  ExpenseRecord,
  ExpenseShareRecord,
  ExpenseView,
  GroupRecord,
  GroupSummary,
  ParticipantRecord,
  PaymentRecord,
  PaymentView,
  SchemaMode,
} from "@/lib/domain";

export const dynamic = "force-dynamic";

type QueryResult<T> = {
  data: T | null;
  error: string | null;
};

export const getDashboardData = cache(async (): Promise<QueryResult<DashboardData>> => {
  try {
    const supabase = createSupabaseReadClient();
    const [groupsResult, participantsResult, advancedData] = await Promise.all([
      supabase.from("groups").select("id,name,created_at").order("created_at", { ascending: false }),
      fetchParticipants(),
      fetchAdvancedData(),
    ]);

    if (groupsResult.error) {
      return { data: null, error: explainSupabaseError(groupsResult.error.message) };
    }

    if (participantsResult.error) {
      return { data: null, error: explainSupabaseError(participantsResult.error.message) };
    }

    if (advancedData.error) {
      return { data: null, error: advancedData.error };
    }

    const groups = buildGroupSummaries(
      groupsResult.data ?? [],
      participantsResult.data ?? [],
      advancedData.expenses,
      advancedData.shares,
      advancedData.payments,
      advancedData.schemaMode,
    );

    return {
      data: {
        groups,
        schemaMode: advancedData.schemaMode,
        totals: {
          groups: groups.length,
          participants:
            participantsResult.data?.filter((participant) => !participant.deleted_at).length ?? 0,
          expenses: advancedData.expenses.length,
          spent: round(groups.reduce((sum, group) => sum + group.totalSpent, 0)),
          paidBack: round(groups.reduce((sum, group) => sum + group.totalPaidBack, 0)),
        },
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: toErrorMessage(error) };
  }
});

export const getGroupData = cache(async (groupId: string): Promise<QueryResult<GroupSummary | null>> => {
  try {
    const supabase = createSupabaseReadClient();
    const [groupResult, participantsResult, advancedData] = await Promise.all([
      supabase.from("groups").select("id,name,created_at").eq("id", groupId).single(),
      fetchParticipants(groupId),
      fetchAdvancedData(groupId),
    ]);

    if (groupResult.error) {
      if (groupResult.error.code === "PGRST116") {
        return { data: null, error: null };
      }
      return { data: null, error: explainSupabaseError(groupResult.error.message) };
    }

    if (participantsResult.error) {
      return { data: null, error: explainSupabaseError(participantsResult.error.message) };
    }

    if (advancedData.error) {
      return { data: null, error: advancedData.error };
    }

    const group = buildGroupSummaries(
      [groupResult.data as GroupRecord],
      participantsResult.data ?? [],
      advancedData.expenses,
      advancedData.shares,
      advancedData.payments,
      advancedData.schemaMode,
    )[0];

    return { data: group ?? null, error: null };
  } catch (error) {
    return { data: null, error: toErrorMessage(error) };
  }
});

async function fetchAdvancedData(groupId?: string) {
  const supabase = createSupabaseReadClient();

  let advancedQuery = supabase
    .from("expenses")
    .select("id,group_id,description,amount,created_at,paid_by_participant_id")
    .order("created_at", { ascending: false });

  if (groupId) {
    advancedQuery = advancedQuery.eq("group_id", groupId);
  }

  const advancedExpenses = await advancedQuery;

  if (advancedExpenses.error && isAdvancedSchemaMissing(advancedExpenses.error.code)) {
    return fetchLegacyData(groupId);
  }

  if (advancedExpenses.error) {
    return {
      schemaMode: "advanced" as SchemaMode,
      expenses: [] as ExpenseRecord[],
      shares: [] as ExpenseShareRecord[],
      payments: [] as PaymentRecord[],
      error: explainSupabaseError(advancedExpenses.error.message),
    };
  }

  const expenseIds = (advancedExpenses.data ?? []).map((expense) => expense.id);

  let sharesQuery = supabase.from("expense_shares").select("expense_id,participant_id,amount");
  if (expenseIds.length) {
    sharesQuery = sharesQuery.in("expense_id", expenseIds);
  }

  let paymentsQuery = supabase
    .from("payments")
    .select("id,group_id,from_participant_id,to_participant_id,amount,created_at")
    .order("created_at", { ascending: false });
  if (groupId) {
    paymentsQuery = paymentsQuery.eq("group_id", groupId);
  }

  const [sharesResult, paymentsResult] = await Promise.all([sharesQuery, paymentsQuery]);

  if (
    (sharesResult.error && isAdvancedSchemaMissing(sharesResult.error.code)) ||
    (paymentsResult.error && isAdvancedSchemaMissing(paymentsResult.error.code))
  ) {
    return fetchLegacyData(groupId);
  }

  if (sharesResult.error) {
    return {
      schemaMode: "advanced" as SchemaMode,
      expenses: [] as ExpenseRecord[],
      shares: [] as ExpenseShareRecord[],
      payments: [] as PaymentRecord[],
      error: explainSupabaseError(sharesResult.error.message),
    };
  }

  if (paymentsResult.error) {
    return {
      schemaMode: "advanced" as SchemaMode,
      expenses: [] as ExpenseRecord[],
      shares: [] as ExpenseShareRecord[],
      payments: [] as PaymentRecord[],
      error: explainSupabaseError(paymentsResult.error.message),
    };
  }

  return {
    schemaMode: "advanced" as SchemaMode,
    expenses: (advancedExpenses.data ?? []) as ExpenseRecord[],
    shares: (sharesResult.data ?? []) as ExpenseShareRecord[],
    payments: (paymentsResult.data ?? []) as PaymentRecord[],
    error: null,
  };
}

async function fetchParticipants(groupId?: string) {
  const supabase = createSupabaseReadClient();

  let advancedQuery = supabase.from("participants").select("id,group_id,name,deleted_at");
  if (groupId) {
    advancedQuery = advancedQuery.eq("group_id", groupId);
  }

  const advancedResult = await advancedQuery;

  if (advancedResult.error && isAdvancedSchemaMissing(advancedResult.error.code)) {
    let legacyQuery = supabase.from("participants").select("id,group_id,name");
    if (groupId) {
      legacyQuery = legacyQuery.eq("group_id", groupId);
    }

    const legacyResult = await legacyQuery;
    if (legacyResult.error) {
      return legacyResult;
    }

    return {
      ...legacyResult,
      data: (legacyResult.data ?? []).map((participant) => ({
        ...participant,
        deleted_at: null,
      })),
    };
  }

  return advancedResult;
}

async function fetchLegacyData(groupId?: string) {
  const supabase = createSupabaseReadClient();
  let legacyQuery = supabase
    .from("expenses")
    .select("id,group_id,description,amount,created_at")
    .order("created_at", { ascending: false });

  if (groupId) {
    legacyQuery = legacyQuery.eq("group_id", groupId);
  }

  const legacyExpenses = await legacyQuery;

  if (legacyExpenses.error) {
    return {
      schemaMode: "legacy" as SchemaMode,
      expenses: [] as ExpenseRecord[],
      shares: [] as ExpenseShareRecord[],
      payments: [] as PaymentRecord[],
      error: explainSupabaseError(legacyExpenses.error.message),
    };
  }

  return {
    schemaMode: "legacy" as SchemaMode,
    expenses: (legacyExpenses.data ?? []).map((expense) => ({
      ...expense,
      paid_by_participant_id: null,
    })) as ExpenseRecord[],
    shares: [] as ExpenseShareRecord[],
    payments: [] as PaymentRecord[],
    error: null,
  };
}

function buildGroupSummaries(
  groups: GroupRecord[],
  participants: ParticipantRecord[],
  expenses: ExpenseRecord[],
  shares: ExpenseShareRecord[],
  payments: PaymentRecord[],
  schemaMode: SchemaMode,
) {
  const participantsById = new Map(participants.map((participant) => [participant.id, participant]));
  const sharesByExpenseId = new Map<string, ExpenseShareRecord[]>();

  for (const share of shares) {
    const list = sharesByExpenseId.get(share.expense_id) ?? [];
    list.push(share);
    sharesByExpenseId.set(share.expense_id, list);
  }

  return groups.map((group) => {
    const groupParticipants = participants.filter(
      (participant) => participant.group_id === group.id && !participant.deleted_at,
    );
    const groupExpenses = expenses.filter((expense) => expense.group_id === group.id);
    const groupPayments = payments.filter((payment) => payment.group_id === group.id);
    const expenseViews = groupExpenses.map((expense) =>
      toExpenseView(expense, sharesByExpenseId.get(expense.id) ?? [], participantsById),
    );
    const completeExpenses = groupExpenses.filter((expense) => {
      const relatedShares = sharesByExpenseId.get(expense.id) ?? [];
      return Boolean(expense.paid_by_participant_id) && relatedShares.length > 0;
    });
    const completeShares = shares.filter((share) =>
      completeExpenses.some((expense) => expense.id === share.expense_id),
    );
    const totalSpent = round(groupExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0));
    const totalPaidBack = round(groupPayments.reduce((sum, payment) => sum + Number(payment.amount), 0));
    const balancesData =
      schemaMode === "advanced"
        ? calculateBalances(groupParticipants, completeExpenses, completeShares, groupPayments)
        : { balances: [], settlements: [] };

    return {
      group,
      participants: groupParticipants,
      expenses: expenseViews,
      payments: groupPayments.map((payment) => toPaymentView(payment, participantsById)),
      totalSpent,
      totalPaidBack,
      averageExpense: groupExpenses.length ? round(totalSpent / groupExpenses.length) : 0,
      averagePerParticipant: groupParticipants.length ? round(totalSpent / groupParticipants.length) : 0,
      schemaMode,
      incompleteExpenseCount: expenseViews.filter((expense) => !expense.isComplete).length,
      balances: balancesData.balances,
      settlements: balancesData.settlements,
      canDeleteGroup:
        balancesData.settlements.length === 0 &&
        groupExpenses.length === 0 &&
        groupPayments.length === 0,
    };
  });
}

function toExpenseView(
  expense: ExpenseRecord,
  shares: ExpenseShareRecord[],
  participantsById: Map<string, ParticipantRecord>,
): ExpenseView {
  const payer = expense.paid_by_participant_id
    ? participantsById.get(expense.paid_by_participant_id) ?? null
    : null;

  return {
    id: expense.id,
    groupId: expense.group_id,
    description: expense.description,
    amount: Number(expense.amount),
    createdAt: expense.created_at,
    paidByParticipantId: expense.paid_by_participant_id,
    paidByParticipantName: payer?.name ?? null,
    shares: shares.map((share) => ({
      participantId: share.participant_id,
      participantName: participantsById.get(share.participant_id)?.name ?? "Sin nombre",
      amount: Number(share.amount),
    })),
    isComplete: Boolean(expense.paid_by_participant_id) && shares.length > 0,
  };
}

function toPaymentView(
  payment: PaymentRecord,
  participantsById: Map<string, ParticipantRecord>,
): PaymentView {
  return {
    id: payment.id,
    groupId: payment.group_id,
    fromParticipantId: payment.from_participant_id,
    fromParticipantName: participantsById.get(payment.from_participant_id)?.name ?? "Sin nombre",
    toParticipantId: payment.to_participant_id,
    toParticipantName: participantsById.get(payment.to_participant_id)?.name ?? "Sin nombre",
    amount: Number(payment.amount),
    createdAt: payment.created_at,
  };
}

function isAdvancedSchemaMissing(code?: string) {
  return code === "42703" || code === "PGRST205";
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return explainSupabaseError(error.message);
  }

  return "No se pudo conectar con Supabase.";
}

function explainSupabaseError(message: string) {
  if (message.includes("fetch failed")) {
    return "No se pudo conectar con Supabase. Revisa la URL del proyecto y tu conexión.";
  }

  return message;
}
