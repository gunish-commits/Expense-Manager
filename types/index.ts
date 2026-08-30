// types/index.ts
// TypeScript interfaces for all DB entities

export interface Profile {
  id: string;
  name: string;
  avatar_url: string;
  created_at: string;
  is_placeholder?: boolean;
  display_name?: string | null;
}

export interface Group {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  status: 'active' | 'settled';
  invite_code: string;
  // Join helper
  members?: Profile[];
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  joined_at: string;
  is_placeholder?: boolean;
  display_name?: string | null;
  // Optional join helper
  profile?: Profile;
}

export interface Expense {
  id: string;
  group_id: string;
  added_by: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  receipt_url: string | null;
  created_at: string;
  // Join helpers
  splits?: ExpenseSplit[];
  added_by_profile?: Profile;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  share_amount: number;
  settled: boolean;
  // Join helper
  profile?: Profile;
}

export interface Settlement {
  id: string;
  group_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  date: string;
  note: string | null;
  // Join helpers
  from_profile?: Profile;
  to_profile?: Profile;
}

export interface PersonalExpense {
  id: string;
  user_id: string;
  amount: number;
  category: string;
  date: string;
  note: string | null;
  receipt_url: string | null;
}

export interface BorrowRecord {
  id: string;
  lender_id: string;
  borrower_id: string;
  amount: number;
  reason: string;
  date: string;
  settled: boolean;
  created_by: string;
  // Join helpers
  lender_profile?: Profile;
  borrower_profile?: Profile;
}

export interface RecurringExpense {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  category: string;
  split_between: string[]; // user_ids
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  next_due_date: string;
  created_by: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string; // 'expense_added' | 'settlement_made' | 'group_invited' | 'general'
  message: string;
  related_group_id: string | null;
  related_expense_id: string | null;
  read: boolean;
  created_at: string;
}

export interface SettleUpPayment {
  from: string;        // User ID
  from_name: string;   // User Name
  to: string;          // User ID
  to_name: string;     // User Name
  amount: number;
}
