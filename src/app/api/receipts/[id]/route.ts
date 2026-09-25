import { generateDonationReceiptPdf, sha256Hex } from "@/lib/donations/receipt-pdf";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CampaignRelation = {
  title: string;
  owner_type: string;
  organizations: { name: string } | { name: string }[] | null;
};

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "AUTH_REQUIRED" }, { status: 401 });

  const { data: transaction, error } = await supabase
    .from("transactions")
    .select("id, tx_ref, status, amount_vnd, received_amount, donor_name, receipt_email, completed_at, payment_provider, campaigns(title, owner_type, organizations(name))")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!transaction) return Response.json({ error: "RECEIPT_NOT_FOUND" }, { status: 404 });
  if (transaction.status !== "completed") return Response.json({ error: "RECEIPT_NOT_AVAILABLE" }, { status: 409 });

  const campaign = relation(transaction.campaigns as CampaignRelation | CampaignRelation[] | null);
  const organization = relation(campaign?.organizations);
  const pdf = generateDonationReceiptPdf({
    txRef: transaction.tx_ref,
    donorName: transaction.donor_name,
    receiptEmail: transaction.receipt_email,
    campaignTitle: campaign?.title || "Chiến dịch thiện nguyện",
    ownerName: campaign?.owner_type === "individual" ? "Chủ chiến dịch cá nhân đã xác minh" : organization?.name || "Tổ chức thiện nguyện",
    amountVnd: Number(transaction.received_amount ?? transaction.amount_vnd) || 0,
    completedAt: transaction.completed_at || new Date().toISOString(),
    paymentMethod: transaction.payment_provider === "wallet" ? "Phân bổ từ ví Thiện Nguyện" : "Chuyển khoản ngân hàng",
  });
  const hash = sha256Hex(pdf);
  return new Response(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="bien-nhan-${transaction.tx_ref}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Receipt-SHA256": hash,
    },
  });
}
