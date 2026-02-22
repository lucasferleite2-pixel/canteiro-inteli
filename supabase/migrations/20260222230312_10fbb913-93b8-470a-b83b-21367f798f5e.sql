
-- Drop restrictive policies on diary_entries and recreate as permissive
DROP POLICY IF EXISTS "Company members can view diary" ON public.diary_entries;
DROP POLICY IF EXISTS "Company members can create diary entries" ON public.diary_entries;
DROP POLICY IF EXISTS "Authors can update unlocked entries" ON public.diary_entries;

CREATE POLICY "Company members can view diary"
ON public.diary_entries FOR SELECT
USING (is_company_member(company_id));

CREATE POLICY "Company members can create diary entries"
ON public.diary_entries FOR INSERT
WITH CHECK (is_company_member(company_id) AND author_id = auth.uid());

CREATE POLICY "Authors can update unlocked entries"
ON public.diary_entries FOR UPDATE
USING (author_id = auth.uid() AND is_locked = false);
