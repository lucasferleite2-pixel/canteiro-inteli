import { supabase } from "@/integrations/supabase/client";

const VERIFICATION_BASE_URL = "https://erp.valenobre.com/verificar";

export function buildVerificationUrl(reportId: string): string {
  return `${VERIFICATION_BASE_URL}/${encodeURIComponent(reportId)}`;
}

export interface ReportVerificationData {
  report_id: string;
  report_type: string;
  project_name: string;
  company_name?: string;
  company_id: string;
  project_id?: string;
  generated_by?: string;
  integrity_hash: string;
  short_hash: string;
  entries_count?: number;
  technical_responsible?: string;
  metadata?: Record<string, any>;
}

export async function saveReportVerification(data: ReportVerificationData): Promise<void> {
  try {
    await supabase.from("report_verifications").insert({
      report_id: data.report_id,
      report_type: data.report_type,
      project_name: data.project_name,
      company_name: data.company_name || null,
      company_id: data.company_id,
      project_id: data.project_id || null,
      generated_by: data.generated_by || null,
      integrity_hash: data.integrity_hash,
      short_hash: data.short_hash,
      entries_count: data.entries_count || 0,
      technical_responsible: data.technical_responsible || null,
      metadata: data.metadata || {},
    } as any);
  } catch (err) {
    console.error("Failed to save report verification:", err);
  }
}
