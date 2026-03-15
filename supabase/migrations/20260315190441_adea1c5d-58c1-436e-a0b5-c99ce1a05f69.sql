
CREATE TABLE public.report_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id text NOT NULL UNIQUE,
  report_type text NOT NULL DEFAULT 'rdo',
  project_name text NOT NULL,
  company_name text,
  company_id uuid REFERENCES public.companies(id),
  project_id uuid REFERENCES public.projects(id),
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  generated_by text,
  integrity_hash text NOT NULL,
  short_hash text NOT NULL,
  entries_count integer DEFAULT 0,
  technical_responsible text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.report_verifications ENABLE ROW LEVEL SECURITY;

-- Public read access for verification (anyone can verify a document)
CREATE POLICY "Anyone can verify reports"
ON public.report_verifications
FOR SELECT
TO anon, authenticated
USING (true);

-- Only company members can insert
CREATE POLICY "Company members can create verifications"
ON public.report_verifications
FOR INSERT
TO authenticated
WITH CHECK (is_company_member(company_id));
