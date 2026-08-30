-- 20260830000100_add_indexes.sql
-- Performance Indexes for Advanced Expense Splitter

-- Group Members indexes
create index if not exists idx_group_members_user_id on public.group_members(user_id);
create index if not exists idx_group_members_group_id on public.group_members(group_id);

-- Expenses indexes
create index if not exists idx_expenses_group_id on public.expenses(group_id);
create index if not exists idx_expenses_added_by on public.expenses(added_by);
create index if not exists idx_expenses_date on public.expenses(date desc);

-- Splits indexes
create index if not exists idx_expense_splits_expense_id on public.expense_splits(expense_id);
create index if not exists idx_expense_splits_user_id on public.expense_splits(user_id);

-- Settlements indexes
create index if not exists idx_settlements_group_id on public.settlements(group_id);
create index if not exists idx_settlements_from_user on public.settlements(from_user);
create index if not exists idx_settlements_to_user on public.settlements(to_user);

-- Personal Expenses indexes
create index if not exists idx_personal_expenses_user_id on public.personal_expenses(user_id);
create index if not exists idx_personal_expenses_date on public.personal_expenses(date desc);

-- Borrow Records indexes
create index if not exists idx_borrow_records_lender_id on public.borrow_records(lender_id);
create index if not exists idx_borrow_records_borrower_id on public.borrow_records(borrower_id);

-- Recurring Expenses indexes
create index if not exists idx_recurring_expenses_group_id on public.recurring_expenses(group_id);
create index if not exists idx_recurring_expenses_next_due_date on public.recurring_expenses(next_due_date);

-- Notifications indexes (composite index for rapid read status + chronological fetching)
create index if not exists idx_notifications_user_read_created on public.notifications(user_id, read, created_at desc);
