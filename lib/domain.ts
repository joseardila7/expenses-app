export type SchemaMode = "legacy" | "advanced";

export type GroupRecord = {
  id: string;
  name: string;
  created_at: string;
};

export type ParticipantRecord = {
  id: string;
  group_id: string;
  name: string;
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
};

export type DashboardData = {
  groups: GroupSummary[];
  schemaMode: SchemaMode;
  totals: {
    groups: number;
    participants: number;
    expenses: number;
    spent: number;
    paidBack: number;
  };
};
