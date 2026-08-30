-- supabase/migrations/20260830000200_group_status_invites.sql
-- Migration to add group status and invite codes

-- Add status column
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'settled'));

-- Add invite_code column
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;

-- Function to generate a random 6-character alphanumeric string
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i integer := 0;
  code_exists boolean;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    -- Check uniqueness
    SELECT EXISTS(SELECT 1 FROM public.groups WHERE invite_code = result) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Backfill existing groups with invite code
UPDATE public.groups SET invite_code = generate_invite_code() WHERE invite_code IS NULL;

-- Make invite_code not null
ALTER TABLE public.groups ALTER COLUMN invite_code SET NOT NULL;

-- Trigger to set invite code on new group insertion
CREATE OR REPLACE FUNCTION set_group_invite_code()
RETURNS trigger AS $$
BEGIN
  IF new.invite_code IS NULL THEN
    new.invite_code := generate_invite_code();
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER before_group_insert
  BEFORE INSERT ON public.groups
  FOR EACH ROW EXECUTE PROCEDURE set_group_invite_code();
