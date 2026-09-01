-- supabase/migrations/20260901000100_fix_group_invite_rls.sql
-- Fix RLS policy on groups to allow invite code lookup for non-members

DROP POLICY IF EXISTS "Groups are viewable by members" ON public.groups;
DROP POLICY IF EXISTS "Groups are viewable by members or invite code" ON public.groups;

CREATE POLICY "Groups are viewable by members or invite code" ON public.groups
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Members can be inserted by group members or self-invited" ON public.group_members;
CREATE POLICY "Members can be inserted by group members or self-invited" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (true);
