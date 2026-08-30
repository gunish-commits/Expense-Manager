-- Drop old creator-only edit and delete policies
DROP POLICY IF EXISTS "Expenses can be updated by creator" ON public.expenses;
DROP POLICY IF EXISTS "Expenses can be deleted by creator" ON public.expenses;
DROP POLICY IF EXISTS "Splits can be managed by expense creator" ON public.expense_splits;

-- Create group-member-wide update and delete policies
CREATE POLICY "Expenses can be updated by group members" ON public.expenses
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = expenses.group_id AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Expenses can be deleted by group members" ON public.expenses
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = expenses.group_id AND group_members.user_id = auth.uid()
    )
  );

-- Create group-member-wide splits management policy
CREATE POLICY "Splits can be managed by group members" ON public.expense_splits
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE e.id = expense_splits.expense_id AND gm.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE e.id = expense_splits.expense_id AND gm.user_id = auth.uid()
    )
  );
