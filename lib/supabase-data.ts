import { requireAuthenticatedUser } from "@/lib/auth";
import { calculateBalances, round } from "@/lib/finance";
import { createSupabaseUserClient } from "@/lib/supabaseClient";
import type {
  DashboardData,
  ExpenseRecord,
  ExpenseShareRecord,
  ExpenseView,
  GroupInvitationRecord,
  GroupInvitationView,
  GroupRecord,
  GroupSummary,
  InvitationTokenView,
  PendingInvitationView,
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

export async function getDashboardData(): Promise<QueryResult<DashboardData>> {
  try {
    const user = await requireAuthenticatedUser();
    const accessibleGroupIds = await fetchAccessibleGroupIds(user.id);
    const groupsResult = await fetchGroups(accessibleGroupIds);

    if (groupsResult.error) {
      return { data: null, error: explainSupabaseError(groupsResult.error.message) };
    }

    const visibleGroupIds = (groupsResult.data ?? []).map((group) => group.id);
    const [participantsResult, advancedData, pendingInvitations] = await Promise.all([
      fetchParticipants(visibleGroupIds),
      fetchAdvancedData(visibleGroupIds),
      fetchPendingInvitations(user.email),
    ]);

    if (participantsResult.error) {
      return { data: null, error: explainSupabaseError(participantsResult.error.message) };
    }

    if (advancedData.error) {
      return { data: null, error: advancedData.error };
    }

    const groups = buildGroupSummaries(
      groupsResult.data ?? [],
      participantsResult.data ?? [],
      [],
      advancedData.expenses,
      advancedData.shares,
      advancedData.payments,
      advancedData.schemaMode,
      advancedData.paymentsEnabled,
    );

    return {
      data: {
        groups,
        pendingInvitations,
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
}

export async function getGroupData(groupId: string): Promise<QueryResult<GroupSummary | null>> {
  try {
    const user = await requireAuthenticatedUser();
    const accessibleGroupIds = await fetchAccessibleGroupIds(user.id);

    if (!accessibleGroupIds.includes(groupId)) {
      return { data: null, error: null };
    }

    const [groupResult, participantsResult, advancedData, invitations] = await Promise.all([
      fetchGroup(groupId),
      fetchParticipants([groupId]),
      fetchAdvancedData([groupId]),
      fetchGroupInvitations(groupId),
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
      invitations,
      advancedData.expenses,
      advancedData.shares,
      advancedData.payments,
      advancedData.schemaMode,
      advancedData.paymentsEnabled,
    )[0];

    return { data: group ?? null, error: null };
  } catch (error) {
    return { data: null, error: toErrorMessage(error) };
  }
}

export async function getInvitationByToken(token: string): Promise<QueryResult<InvitationTokenView | null>> {
  try {
    await requireAuthenticatedUser();
    const supabase = await createScopedSupabaseClient();
    const { data, error } = await supabase
      .from("group_invitations")
      .select("id,group_id,group_name_snapshot,invited_email,invited_by_user_id,invited_by_name_snapshot,token,status,created_at,accepted_at,accepted_user_id,accepted_name_snapshot,revoked_at")
      .eq("token", token)
      .maybeSingle();

    if (error) {
      return { data: null, error: explainSupabaseError(error.message) };
    }

    if (!data) {
      return { data: null, error: null };
    }

    const invitation = data as GroupInvitationRecord;

    return {
      data: {
        id: invitation.id,
        token: invitation.token,
        invitePath: `/invitations/${invitation.token}`,
        status: invitation.status,
        invitedEmail: invitation.invited_email,
        invitedByUserId: invitation.invited_by_user_id,
        createdAt: invitation.created_at,
        acceptedAt: invitation.accepted_at,
        acceptedUserId: invitation.accepted_user_id,
        revokedAt: invitation.revoked_at,
        groupId: invitation.group_id,
        groupName: invitation.group_name_snapshot,
        invitedByName: invitation.invited_by_name_snapshot,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: toErrorMessage(error) };
  }
}

async function fetchAdvancedData(groupIds: string[]) {
  if (groupIds.length === 0) {
    return {
      schemaMode: "advanced" as SchemaMode,
      expenses: [] as ExpenseRecord[],
      shares: [] as ExpenseShareRecord[],
      payments: [] as PaymentRecord[],
      paymentsEnabled: true,
      error: null,
    };
  }

  const supabase = await createScopedSupabaseClient();

  const advancedExpenses = await supabase
    .from("expenses")
    .select("id,group_id,description,amount,created_at,paid_by_participant_id")
    .in("group_id", groupIds)
    .order("created_at", { ascending: false });

  if (advancedExpenses.error && isAdvancedSchemaMissing(advancedExpenses.error.code)) {
    return fetchLegacyData(groupIds);
  }

  if (advancedExpenses.error) {
    return {
      schemaMode: "advanced" as SchemaMode,
      expenses: [] as ExpenseRecord[],
      shares: [] as ExpenseShareRecord[],
      payments: [] as PaymentRecord[],
      paymentsEnabled: false,
      error: explainSupabaseError(advancedExpenses.error.message),
    };
  }

  const expenseIds = (advancedExpenses.data ?? []).map((expense) => expense.id);

  let sharesQuery = supabase.from("expense_shares").select("expense_id,participant_id,amount");
  if (expenseIds.length) {
    sharesQuery = sharesQuery.in("expense_id", expenseIds);
  }

  const paymentsQuery = supabase
    .from("payments")
    .select("id,group_id,from_participant_id,to_participant_id,amount,created_at")
    .in("group_id", groupIds)
    .order("created_at", { ascending: false });

  const [sharesResult, paymentsResult] = await Promise.all([sharesQuery, paymentsQuery]);

  if (sharesResult.error && isAdvancedSchemaMissing(sharesResult.error.code)) {
    return fetchLegacyData(groupIds);
  }

  if (sharesResult.error) {
    return {
      schemaMode: "advanced" as SchemaMode,
      expenses: [] as ExpenseRecord[],
      shares: [] as ExpenseShareRecord[],
      payments: [] as PaymentRecord[],
      paymentsEnabled: false,
      error: explainSupabaseError(sharesResult.error.message),
    };
  }

  if (paymentsResult.error && !isAdvancedSchemaMissing(paymentsResult.error.code)) {
    return {
      schemaMode: "advanced" as SchemaMode,
      expenses: [] as ExpenseRecord[],
      shares: [] as ExpenseShareRecord[],
      payments: [] as PaymentRecord[],
      paymentsEnabled: false,
      error: explainSupabaseError(paymentsResult.error.message),
    };
  }

  return {
    schemaMode: "advanced" as SchemaMode,
    expenses: (advancedExpenses.data ?? []) as ExpenseRecord[],
    shares: (sharesResult.data ?? []) as ExpenseShareRecord[],
    payments:
      paymentsResult.error && isAdvancedSchemaMissing(paymentsResult.error.code)
        ? ([] as PaymentRecord[])
        : ((paymentsResult.data ?? []) as PaymentRecord[]),
    paymentsEnabled: !paymentsResult.error,
    error: null,
  };
}

async function fetchGroups(groupIds: string[]) {
  if (groupIds.length === 0) {
    return { data: [] as GroupRecord[], error: null };
  }

  const supabase = await createScopedSupabaseClient();
  const advancedResult = await supabase
    .from("groups")
    .select("id,name,created_at,deleted_at")
    .in("id", groupIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (advancedResult.error && isAdvancedSchemaMissing(advancedResult.error.code)) {
    const legacyResult = await supabase
      .from("groups")
      .select("id,name,created_at")
      .in("id", groupIds)
      .order("created_at", { ascending: false });

    if (legacyResult.error) {
      return legacyResult;
    }

    return {
      ...legacyResult,
      data: (legacyResult.data ?? []).map((group) => ({
        ...group,
        deleted_at: null,
      })),
    };
  }

  return advancedResult;
}

async function fetchGroup(groupId: string) {
  const supabase = await createScopedSupabaseClient();
  const advancedResult = await supabase
    .from("groups")
    .select("id,name,created_at,deleted_at")
    .eq("id", groupId)
    .is("deleted_at", null)
    .single();

  if (advancedResult.error && isAdvancedSchemaMissing(advancedResult.error.code)) {
    const legacyResult = await supabase
      .from("groups")
      .select("id,name,created_at")
      .eq("id", groupId)
      .single();

    if (legacyResult.error) {
      return legacyResult;
    }

    return {
      ...legacyResult,
      data: legacyResult.data
        ? {
            ...legacyResult.data,
            deleted_at: null,
          }
        : null,
    };
  }

  return advancedResult;
}

async function fetchParticipants(groupIds: string[]) {
  if (groupIds.length === 0) {
    return { data: [] as ParticipantRecord[], error: null };
  }

  const supabase = await createScopedSupabaseClient();
  const advancedResult = await supabase
    .from("participants")
    .select("id,group_id,name,user_id,contact_email,deleted_at")
    .in("group_id", groupIds);

  if (advancedResult.error && isAdvancedSchemaMissing(advancedResult.error.code)) {
    const legacyResult = await supabase
      .from("participants")
      .select("id,group_id,name")
      .in("group_id", groupIds);
    if (legacyResult.error) {
      return legacyResult;
    }

    return {
      ...legacyResult,
      data: (legacyResult.data ?? []).map((participant) => ({
        ...participant,
        user_id: null,
        contact_email: null,
        deleted_at: null,
      })),
    };
  }

  return advancedResult;
}

async function fetchLegacyData(groupIds: string[]) {
  if (groupIds.length === 0) {
    return {
      schemaMode: "legacy" as SchemaMode,
      expenses: [] as ExpenseRecord[],
      shares: [] as ExpenseShareRecord[],
      payments: [] as PaymentRecord[],
      paymentsEnabled: false,
      error: null,
    };
  }

  const supabase = await createScopedSupabaseClient();
  const legacyExpenses = await supabase
    .from("expenses")
    .select("id,group_id,description,amount,created_at")
    .in("group_id", groupIds)
    .order("created_at", { ascending: false });

  if (legacyExpenses.error) {
    return {
      schemaMode: "legacy" as SchemaMode,
      expenses: [] as ExpenseRecord[],
      shares: [] as ExpenseShareRecord[],
      payments: [] as PaymentRecord[],
      paymentsEnabled: false,
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
    paymentsEnabled: false,
    error: null,
  };
}

function buildGroupSummaries(
  groups: GroupRecord[],
  participants: ParticipantRecord[],
  invitations: GroupInvitationView[],
  expenses: ExpenseRecord[],
  shares: ExpenseShareRecord[],
  payments: PaymentRecord[],
  schemaMode: SchemaMode,
  paymentsEnabled: boolean,
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
    const groupInvitations = invitations.filter((invitation) => invitation.groupId === group.id);
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
      invitations: groupInvitations,
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
        expenseViews.every((expense) => expense.isComplete || schemaMode === "legacy"),
      paymentsEnabled,
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

async function createScopedSupabaseClient() {
  const user = await requireAuthenticatedUser();
  return createSupabaseUserClient(user.accessToken);
}

async function fetchAccessibleGroupIds(userId: string): Promise<string[]> {
  const supabase = await createScopedSupabaseClient();
  const [ownedGroupsResult, membershipsResult] = await Promise.all([
    supabase.from("groups").select("id").eq("owner_user_id", userId).is("deleted_at", null),
    supabase.from("group_members").select("group_id").eq("user_id", userId),
  ]);

  const accessibleGroupIds = new Set<string>();

  for (const group of ownedGroupsResult.data ?? []) {
    accessibleGroupIds.add(group.id);
  }

  for (const membership of membershipsResult.data ?? []) {
    accessibleGroupIds.add(membership.group_id);
  }

  return [...accessibleGroupIds];
}

async function fetchGroupInvitations(groupId: string): Promise<GroupInvitationView[]> {
  const supabase = await createScopedSupabaseClient();
  const { data, error } = await supabase
    .from("group_invitations")
    .select("id,group_id,group_name_snapshot,invited_email,invited_by_user_id,invited_by_name_snapshot,token,status,created_at,accepted_at,accepted_user_id,accepted_name_snapshot,revoked_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) {
    return [];
  }

  return ((data ?? []) as GroupInvitationRecord[]).map(toGroupInvitationView);
}

async function fetchPendingInvitations(email: string): Promise<PendingInvitationView[]> {
  const supabase = await createScopedSupabaseClient();
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("group_invitations")
    .select("id,group_id,group_name_snapshot,invited_email,invited_by_user_id,invited_by_name_snapshot,token,status,created_at,accepted_at,accepted_user_id,accepted_name_snapshot,revoked_at")
    .eq("status", "pending")
    .eq("invited_email", normalizedEmail)
    .order("created_at", { ascending: false });

  if (error || !(data ?? []).length) {
    return [];
  }

  const invitations = (data ?? []) as GroupInvitationRecord[];

  return invitations.map((invitation) => ({
    id: invitation.id,
    token: invitation.token,
    invitePath: `/invitations/${invitation.token}`,
    invitedEmail: invitation.invited_email,
    createdAt: invitation.created_at,
    status: invitation.status,
    groupId: invitation.group_id,
    groupName: invitation.group_name_snapshot,
    invitedByName: invitation.invited_by_name_snapshot,
  }));
}

function toGroupInvitationView(invitation: GroupInvitationRecord): GroupInvitationView {
  return {
    id: invitation.id,
    groupId: invitation.group_id,
    groupNameSnapshot: invitation.group_name_snapshot,
    invitedEmail: invitation.invited_email,
    invitedByUserId: invitation.invited_by_user_id,
    invitedByNameSnapshot: invitation.invited_by_name_snapshot,
    token: invitation.token,
    status: invitation.status,
    createdAt: invitation.created_at,
    acceptedAt: invitation.accepted_at,
    acceptedUserId: invitation.accepted_user_id,
    acceptedNameSnapshot: invitation.accepted_name_snapshot,
    revokedAt: invitation.revoked_at,
    invitePath: `/invitations/${invitation.token}`,
  };
}
