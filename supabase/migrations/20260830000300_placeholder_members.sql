-- Remove foreign key constraint from profiles to auth.users to allow placeholder profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Add placeholder columns to group_members
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS is_placeholder boolean DEFAULT false;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS display_name text;
