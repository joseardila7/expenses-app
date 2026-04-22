export type SchemaMode = "legacy" | "advanced";

export type GroupRecord = {
  id: string;
  name: string;
  created_at: string;
  deleted_at: string | null;
};

export type ParticipantRecord = {
  id: string;
  group_id: string;
  name: string;
  user_id: string | null;
  contact_email: string | null;
  deleted_at: string | null;
};

export type ExpenseRecord = {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  created_at: string;
  paid_by_participant_id: string | null;
};

export type ExpenseShareRecord = {
  expense_id: string;
  participant_id: string;
  amount: number;
};

export type PaymentRecord = {
  id: string;
  group_id: string;
  from_participant_id: string;
  to_participant_id: string;
  amount: number;
  created_at: string;
};

export type GroupInvitationRecord = {
  id: string;
  group_id: string;
  group_name_snapshot: string;
  invited_email: string;
  invited_by_user_id: string;
  invited_by_name_snapshot: string | null;
  token: string;
  status: "pending" | "accepted" | "revoked";
  created_at: string;
  accepted_at: string | null;
  accepted_user_id: string | null;
  accepted_name_snapshot: string | null;
  revoked_at: string | null;
};

export type GroupInvitationView = {
  id: string;
  groupId: string;
  groupNameSnapshot: string;
  invitedEmail: string;
  invitedByUserId: string;
  invitedByNameSnapshot: string | null;
  token: string;
  status: "pending" | "accepted" | "revoked";
  createdAt: string;
  acceptedAt: string | null;
  acceptedUserId: string | null;
  acceptedNameSnapshot: string | null;
  revokedAt: string | null;
  invitePath: string;
};

export type PendingInvitationView = {
  id: string;
  token: string;
  invitePath: string;
  invitedEmail: string;
  createdAt: string;
  status: "pending" | "accepted" | "revoked";
  groupId: string;
  groupName: string;
  invitedByName: string | null;
};

export type InvitationTokenView = {
  id: string;
  token: string;
  invitePath: string;
  status: "pending" | "accepted" | "revoked";
  invitedEmail: string;
  invitedByUserId: string;
  createdAt: string;
  acceptedAt: string | null;
  acceptedUserId: string | null;
  revokedAt: string | null;
  groupId: string;
  groupName: string;
  invitedByName: string | null;
};

export type ExpenseView = {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  createdAt: string;
  paidByParticipantId: string | null;
  paidByParticipantName: string | null;
  shares: {
    participantId: string;
    participantName: string;
    amount: number;
  }[];
  isComplete: boolean;
};

export type PaymentView = {
  id: string;
  groupId: string;
  fromParticipantId: string;
  fromParticipantName: string;
  toParticipantId: string;
  toParticipantName: string;
  amount: number;
  createdAt: string;
};

export type ParticipantBalance = {
  participantId: string;
  participantName: string;
  paid: number;
  owes: number;
  net: number;
  canDelete: boolean;
};

export type Settlement = {
  fromParticipantId: string;
  fromParticipantName: string;
  toParticipantId: string;
  toParticipantName: string;
  amount: number;
};

export type GroupSummary = {
  group: GroupRecord;
  participants: ParticipantRecord[];
  invitations: GroupInvitationView[];
  expenses: ExpenseView[];
  payments: PaymentView[];
  totalSpent: number;
  totalPaidBack: number;
  averageExpense: number;
  averagePerParticipant: number;
  schemaMode: SchemaMode;
  incompleteExpenseCount: number;
  balances: ParticipantBalance[];
  settlements: Settlement[];
  canDeleteGroup: boolean;
  paymentsEnabled: boolean;
};

export type DashboardData = {
  groups: GroupSummary[];
  pendingInvitations: PendingInvitationView[];
  schemaMode: SchemaMode;
  totals: {
    groups: number;
    participants: number;
    expenses: number;
    spent: number;
    paidBack: number;
  };
};
