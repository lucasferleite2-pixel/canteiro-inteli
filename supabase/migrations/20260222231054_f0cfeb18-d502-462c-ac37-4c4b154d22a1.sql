
CREATE POLICY "Authors can delete unlocked entries"
ON public.diary_entries FOR DELETE
USING (author_id = auth.uid() AND is_locked = false);
