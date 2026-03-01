-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public) VALUES ('company-logos', 'company-logos', true);

-- Allow company members to upload logos
CREATE POLICY "Company members can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'company-logos' AND auth.uid() IS NOT NULL);

-- Allow public read access
CREATE POLICY "Logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

-- Allow members to update/delete their logos
CREATE POLICY "Company members can manage logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'company-logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Company members can update logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'company-logos' AND auth.uid() IS NOT NULL);