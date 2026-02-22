
-- Fix companies policies: drop restrictive, create permissive
DROP POLICY IF EXISTS "Authenticated users can create company" ON public.companies;
DROP POLICY IF EXISTS "Members can view own company" ON public.companies;
DROP POLICY IF EXISTS "Admins can update company" ON public.companies;

CREATE POLICY "Authenticated users can create company"
ON public.companies FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Members can view own company"
ON public.companies FOR SELECT TO authenticated
USING (is_company_member(id));

CREATE POLICY "Admins can update company"
ON public.companies FOR UPDATE TO authenticated
USING (is_admin_in_company(id));

-- Fix profiles policies
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can see company members" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can see company members"
ON public.profiles FOR SELECT TO authenticated
USING (is_company_member(company_id));

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- Fix user_roles policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (is_admin_in_company(company_id))
WITH CHECK (is_admin_in_company(company_id));

-- Allow users to insert their own first role (for company creation flow)
CREATE POLICY "Users can insert own role"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Fix projects policies
DROP POLICY IF EXISTS "Company members can view projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can manage projects" ON public.projects;

CREATE POLICY "Company members can view projects"
ON public.projects FOR SELECT TO authenticated
USING (is_company_member(company_id));

CREATE POLICY "Admins can manage projects"
ON public.projects FOR ALL TO authenticated
USING (is_admin_in_company(company_id))
WITH CHECK (is_admin_in_company(company_id));

-- Fix diary_entries policies
DROP POLICY IF EXISTS "Company members can view diary" ON public.diary_entries;
DROP POLICY IF EXISTS "Company members can create diary entries" ON public.diary_entries;
DROP POLICY IF EXISTS "Authors can update unlocked entries" ON public.diary_entries;

CREATE POLICY "Company members can view diary"
ON public.diary_entries FOR SELECT TO authenticated
USING (is_company_member(company_id));

CREATE POLICY "Company members can create diary entries"
ON public.diary_entries FOR INSERT TO authenticated
WITH CHECK (is_company_member(company_id) AND author_id = auth.uid());

CREATE POLICY "Authors can update unlocked entries"
ON public.diary_entries FOR UPDATE TO authenticated
USING (author_id = auth.uid() AND is_locked = false);

-- Fix contracts policies
DROP POLICY IF EXISTS "Company members can view contracts" ON public.contracts;
DROP POLICY IF EXISTS "Admins can manage contracts" ON public.contracts;

CREATE POLICY "Company members can view contracts"
ON public.contracts FOR SELECT TO authenticated
USING (is_company_member(company_id));

CREATE POLICY "Admins can manage contracts"
ON public.contracts FOR ALL TO authenticated
USING (is_admin_in_company(company_id))
WITH CHECK (is_admin_in_company(company_id));

-- Fix financial_records policies
DROP POLICY IF EXISTS "Company members can view financials" ON public.financial_records;
DROP POLICY IF EXISTS "Company members can manage financials" ON public.financial_records;

CREATE POLICY "Company members can view financials"
ON public.financial_records FOR SELECT TO authenticated
USING (is_company_member(company_id));

CREATE POLICY "Company members can manage financials"
ON public.financial_records FOR ALL TO authenticated
USING (is_company_member(company_id))
WITH CHECK (is_company_member(company_id));

-- Fix bids policies
DROP POLICY IF EXISTS "Company members can view bids" ON public.bids;
DROP POLICY IF EXISTS "Company members can manage bids" ON public.bids;

CREATE POLICY "Company members can view bids"
ON public.bids FOR SELECT TO authenticated
USING (is_company_member(company_id));

CREATE POLICY "Company members can manage bids"
ON public.bids FOR ALL TO authenticated
USING (is_company_member(company_id))
WITH CHECK (is_company_member(company_id));

-- Fix alerts policies
DROP POLICY IF EXISTS "Users can view own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Company members can create alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can update own alerts" ON public.alerts;

CREATE POLICY "Users can view own alerts"
ON public.alerts FOR SELECT TO authenticated
USING (user_id = auth.uid() OR (user_id IS NULL AND is_company_member(company_id)));

CREATE POLICY "Company members can create alerts"
ON public.alerts FOR INSERT TO authenticated
WITH CHECK (is_company_member(company_id));

CREATE POLICY "Users can update own alerts"
ON public.alerts FOR UPDATE TO authenticated
USING (user_id = auth.uid());
