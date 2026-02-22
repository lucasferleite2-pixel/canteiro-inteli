
-- Fix permissive company INSERT policy
DROP POLICY "Anyone can create company" ON public.companies;
CREATE POLICY "Authenticated users can create company" ON public.companies FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
