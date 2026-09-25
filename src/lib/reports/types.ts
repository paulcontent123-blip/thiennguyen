export type PeriodReport = {
  period_key: string;
  period_type: "quarter" | "half";
  period_number: number;
  period_start: string;
  period_end: string;
  is_complete: boolean;
  total_received_vnd: number;
  completed_donation_count: number;
  campaign_count: number;
  total_disbursed_vnd: number;
};

export type ClosedCampaignReport = {
  campaign_id: string;
  slug: string;
  title: string;
  owner_name: string;
  category: string | null;
  province: string | null;
  closed_at: string | null;
  total_received_vnd: number;
  total_disbursed_vnd: number;
  completed_donation_count: number;
  valid_disbursement_count: number;
  evidence_file_count: number;
};

export function normalizePeriodReports(rows: unknown[] | null): PeriodReport[] {
  return (rows ?? []).map((row) => {
    const value = row as Record<string, unknown>;
    return {
      period_key: String(value.period_key),
      period_type: value.period_type === "half" ? "half" : "quarter",
      period_number: Number(value.period_number),
      period_start: String(value.period_start),
      period_end: String(value.period_end),
      is_complete: Boolean(value.is_complete),
      total_received_vnd: Number(value.total_received_vnd ?? 0),
      completed_donation_count: Number(value.completed_donation_count ?? 0),
      campaign_count: Number(value.campaign_count ?? 0),
      total_disbursed_vnd: Number(value.total_disbursed_vnd ?? 0),
    };
  });
}

export function normalizeClosedCampaignReports(rows: unknown[] | null): ClosedCampaignReport[] {
  return (rows ?? []).map((row) => {
    const value = row as Record<string, unknown>;
    return {
      campaign_id: String(value.campaign_id),
      slug: String(value.slug),
      title: String(value.title),
      owner_name: String(value.owner_name),
      category: value.category ? String(value.category) : null,
      province: value.province ? String(value.province) : null,
      closed_at: value.closed_at ? String(value.closed_at) : null,
      total_received_vnd: Number(value.total_received_vnd ?? 0),
      total_disbursed_vnd: Number(value.total_disbursed_vnd ?? 0),
      completed_donation_count: Number(value.completed_donation_count ?? 0),
      valid_disbursement_count: Number(value.valid_disbursement_count ?? 0),
      evidence_file_count: Number(value.evidence_file_count ?? 0),
    };
  });
}
