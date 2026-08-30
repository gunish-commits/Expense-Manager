-- 20260830000000_init_schema.sql
-- Database Schema for Advanced Expense Splitter

-- Enable necessary Extensions
create extension if not exists "uuid-ossp";

-- =========================================================================
-- 1. TABLES DEFINITIONS
-- =========================================================================

-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Groups table
create table if not exists public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Group Members table (many-to-many relationship)
create table if not exists public.group_members (
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (group_id, user_id)
);

-- Expenses table
create table if not exists public.expenses (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  added_by uuid references public.profiles(id) on delete set null not null,
  amount numeric(12, 2) not null check (amount > 0),
  description text not null,
  category text not null,
  date date not null default current_date,
  receipt_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Expense Splits table (who owes what for each expense)
create table if not exists public.expense_splits (
  id uuid default gen_random_uuid() primary key,
  expense_id uuid references public.expenses(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  share_amount numeric(12, 2) not null check (share_amount >= 0),
  settled boolean default false not null
);

-- Settlements table (who paid whom to settle up)
create table if not exists public.settlements (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  from_user uuid references public.profiles(id) on delete set null not null,
  to_user uuid references public.profiles(id) on delete set null not null,
  amount numeric(12, 2) not null check (amount > 0),
  date date not null default current_date,
  note text
);

-- Personal Expenses table (private logs)
create table if not exists public.personal_expenses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  date date not null default current_date,
  note text,
  receipt_url text
);

-- Borrow Records table (un-grouped bidirectional lend/borrow)
create table if not exists public.borrow_records (
  id uuid default gen_random_uuid() primary key,
  lender_id uuid references public.profiles(id) on delete set null not null,
  borrower_id uuid references public.profiles(id) on delete set null not null,
  amount numeric(12, 2) not null check (amount > 0),
  reason text not null,
  date date not null default current_date,
  settled boolean default false not null,
  created_by uuid references public.profiles(id) on delete set null not null
);

-- Recurring Expenses table
create table if not exists public.recurring_expenses (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  split_between uuid[] not null,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  next_due_date date not null,
  created_by uuid references public.profiles(id) on delete set null not null
);

-- Notifications table
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null,
  message text not null,
  related_group_id uuid references public.groups(id) on delete set null,
  related_expense_id uuid references public.expenses(id) on delete set null,
  read boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =========================================================================
-- 2. PROFILE TRIGGER DEFINITION
-- =========================================================================

-- Trigger to automatically create profile on sign up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;
alter table public.personal_expenses enable row level security;
alter table public.borrow_records enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.notifications enable row level security;

-- Profiles Policies
create policy "Profiles are viewable by authenticated users" on public.profiles
  for select to authenticated using (true);

create policy "Profiles can be updated by owner" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- Groups Policies
create policy "Groups are viewable by members" on public.groups
  for select to authenticated using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = groups.id and group_members.user_id = auth.uid()
    )
  );

create policy "Groups can be created by authenticated users" on public.groups
  for insert to authenticated with check (auth.uid() = created_by);

create policy "Groups can be updated by creator" on public.groups
  for update to authenticated using (auth.uid() = created_by);

create policy "Groups can be deleted by creator" on public.groups
  for delete to authenticated using (auth.uid() = created_by);

-- Group Members Policies
create policy "Members are viewable by group members" on public.group_members
  for select to authenticated using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id and gm.user_id = auth.uid()
    )
  );

create policy "Members can be inserted by group members or self-invited" on public.group_members
  for insert to authenticated with check (
    auth.uid() = user_id or
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id and gm.user_id = auth.uid()
    )
  );

create policy "Members can leave or creator can remove" on public.group_members
  for delete to authenticated using (
    auth.uid() = user_id or
    exists (
      select 1 from public.groups g
      where g.id = group_members.group_id and g.created_by = auth.uid()
    )
  );

-- Expenses Policies
create policy "Expenses are viewable by group members" on public.expenses
  for select to authenticated using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = expenses.group_id and group_members.user_id = auth.uid()
    )
  );

create policy "Expenses can be inserted by group members" on public.expenses
  for insert to authenticated with check (
    auth.uid() = added_by and
    exists (
      select 1 from public.group_members
      where group_members.group_id = expenses.group_id and group_members.user_id = auth.uid()
    )
  );

create policy "Expenses can be updated by creator" on public.expenses
  for update to authenticated using (auth.uid() = added_by);

create policy "Expenses can be deleted by creator" on public.expenses
  for delete to authenticated using (auth.uid() = added_by);

-- Expense Splits Policies
create policy "Splits are viewable by group members" on public.expense_splits
  for select to authenticated using (
    exists (
      select 1 from public.expenses e
      join public.group_members gm on gm.group_id = e.group_id
      where e.id = expense_splits.expense_id and gm.user_id = auth.uid()
    )
  );

create policy "Splits can be managed by expense creator" on public.expense_splits
  for all to authenticated using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id and e.added_by = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id and e.added_by = auth.uid()
    )
  );

-- Settlements Policies
create policy "Settlements are viewable by group members" on public.settlements
  for select to authenticated using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = settlements.group_id and group_members.user_id = auth.uid()
    )
  );

create policy "Settlements can be inserted by group members" on public.settlements
  for insert to authenticated with check (
    exists (
      select 1 from public.group_members
      where group_members.group_id = settlements.group_id and group_members.user_id = auth.uid()
    )
  );

create policy "Settlements can be updated/deleted by involved members" on public.settlements
  for all to authenticated using (
    auth.uid() = from_user or auth.uid() = to_user
  );

-- Personal Expenses Policies (Private)
create policy "Personal expenses are private to owner" on public.personal_expenses
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Borrow Records Policies (Lender & Borrower accessible)
create policy "Borrow records are viewable by lender and borrower" on public.borrow_records
  for select to authenticated using (auth.uid() = lender_id or auth.uid() = borrower_id);

-- Borrow Records Writable by creator
create policy "Borrow records are writable by creator" on public.borrow_records
  for all to authenticated using (auth.uid() = created_by) with check (auth.uid() = created_by);

-- Recurring Expenses Policies
create policy "Recurring expenses are readable by group members" on public.recurring_expenses
  for select to authenticated using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = recurring_expenses.group_id and group_members.user_id = auth.uid()
    )
  );

create policy "Recurring expenses managed by creator" on public.recurring_expenses
  for all to authenticated using (auth.uid() = created_by) with check (auth.uid() = created_by);

-- Notifications Policies (Private to owner)
create policy "Notifications are private to owner" on public.notifications
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================================
-- 4. REALTIME ENABLEMENT
-- =========================================================================

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

alter publication supabase_realtime add table public.expenses;
alter publication supabase_realtime add table public.expense_splits;
alter publication supabase_realtime add table public.settlements;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.groups;
alter publication supabase_realtime add table public.group_members;

-- =========================================================================
-- 5. STORAGE BUCKETS CONFIGURATION
-- =========================================================================

-- Note: We run these in a block that ignores duplicate bucket conflicts.
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

-- Enable storage policies (assuming policy checks are enabled on storage.objects)
-- Receipts policies
create policy "Authenticated users can upload receipts" on storage.objects
  for insert to authenticated with check (bucket_id = 'receipts');

create policy "Authenticated users can view receipts" on storage.objects
  for select to authenticated using (bucket_id = 'receipts');

create policy "Authenticated users can delete their own receipts" on storage.objects
  for delete to authenticated using (bucket_id = 'receipts' and owner = auth.uid());

-- Documents policies
create policy "Users can upload their own documents" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents' and owner = auth.uid());

create policy "Users can view their own documents" on storage.objects
  for select to authenticated using (bucket_id = 'documents' and owner = auth.uid());

create policy "Users can delete their own documents" on storage.objects
  for delete to authenticated using (bucket_id = 'documents' and owner = auth.uid());
