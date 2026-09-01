-- 20260901000000_performance_indexes.sql
-- Comprehensive Performance & Filtering Indexes for Expense Manager

-- 1. Group Members & Groups
CREATE INDEX IF NOT EXISTS idx_group_members_group_user ON public.group_members(group_id, user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_group ON public.group_members(user_id, group_id);
CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON public.groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_groups_status ON public.groups(status);
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON public.groups(created_by);

-- 2. Expenses & Splits (Composite Indexes for timeline ordering & RLS checks)
CREATE INDEX IF NOT EXISTS idx_expenses_group_date ON public.expenses(group_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_added_by_date ON public.expenses(added_by, date DESC);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_user ON public.expense_splits(expense_id, user_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_user_expense ON public.expense_splits(user_id, expense_id);

-- 3. Settlements (Composite Indexes for group settlement timeline)
CREATE INDEX IF NOT EXISTS idx_settlements_group_date ON public.settlements(group_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_settlements_from_user ON public.settlements(from_user, date DESC);
CREATE INDEX IF NOT EXISTS idx_settlements_to_user ON public.settlements(to_user, date DESC);

-- 4. Personal Expenses (Composite Indexes for user logs and categories)
CREATE INDEX IF NOT EXISTS idx_personal_expenses_user_date ON public.personal_expenses(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_personal_expenses_user_cat ON public.personal_expenses(user_id, category);

-- 5. Borrow Records (Composite Indexes for borrower & lender dues queries)
CREATE INDEX IF NOT EXISTS idx_borrow_records_lender_settled ON public.borrow_records(lender_id, settled, date DESC);
CREATE INDEX IF NOT EXISTS idx_borrow_records_borrower_settled ON public.borrow_records(borrower_id, settled, date DESC);
CREATE INDEX IF NOT EXISTS idx_borrow_records_created_by ON public.borrow_records(created_by);

-- 6. Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = false;
