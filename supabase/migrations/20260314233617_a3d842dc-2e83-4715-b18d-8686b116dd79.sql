CREATE POLICY "Authors can update own rdo_foto"
ON public.rdo_foto
FOR UPDATE
TO public
USING (uploaded_by = auth.uid())
WITH CHECK (uploaded_by = auth.uid());