
-- Create storage bucket for diary photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('diary-photos', 'diary-photos', true);

-- Storage policies for diary photos
CREATE POLICY "Company members can upload diary photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'diary-photos'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Anyone can view diary photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'diary-photos');

CREATE POLICY "Authors can delete own diary photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'diary-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create diary_photos metadata table
CREATE TABLE public.diary_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diary_entry_id UUID NOT NULL REFERENCES public.diary_entries(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  uploaded_by UUID NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  description TEXT,
  activity TEXT,
  contract_id UUID REFERENCES public.contracts(id),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.diary_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Company members can view diary photos"
ON public.diary_photos FOR SELECT
USING (is_company_member(company_id));

CREATE POLICY "Company members can insert diary photos"
ON public.diary_photos FOR INSERT
WITH CHECK (is_company_member(company_id) AND uploaded_by = auth.uid());

CREATE POLICY "Authors can delete own diary photos"
ON public.diary_photos FOR DELETE
USING (uploaded_by = auth.uid());
