-- supabase/migrations/20260901000200_fix_storage_rls.sql
-- Create storage buckets and configure RLS for receipts and documents

-- 1. Ensure storage buckets exist and are marked public
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Storage Objects RLS Policies
DROP POLICY IF EXISTS "Public Access to Receipts and Documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Users Can Upload to Receipts and Documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Users Can Update Receipts and Documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Users Can Delete Receipts and Documents" ON storage.objects;

-- Allow public and authenticated read access
CREATE POLICY "Public Access to Receipts and Documents" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id IN ('receipts', 'documents'));

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated Users Can Upload to Receipts and Documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('receipts', 'documents'));

-- Allow authenticated users to update files
CREATE POLICY "Authenticated Users Can Update Receipts and Documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN ('receipts', 'documents'));

-- Allow authenticated users to delete files
CREATE POLICY "Authenticated Users Can Delete Receipts and Documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN ('receipts', 'documents'));

-- 3. Ensure personal_expenses table has full RLS for owner
DROP POLICY IF EXISTS "Personal expenses are strictly private" ON public.personal_expenses;
CREATE POLICY "Personal expenses are strictly private" ON public.personal_expenses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
