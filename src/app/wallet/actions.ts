"use server";

import { revalidatePath } from "next/cache";
import { buildVietQrUrl } from "@/lib/campaigns/content";
import { requireActionRole } from "@/lib/auth/server";
import { WALLET_MAX_TOPUP, WALLET_MIN_TOPUP, type WalletTopupResult } from "@/lib/wallet/types";

type TopupRow = {
  id: string;
  tx_ref: string;
  amount_vnd: number | string;
  bank_id: string;
  account_no: string;
  account_name: string;
  transfer_description: string;
};

function walletErrorMessage(message: string) {
  if (message.includes("WALLET_AMOUNT_INVALID")) return "Số tiền nạp phải từ 10.000đ đến 10 tỷ đồng.";
  if (message.includes("WALLET_TOO_MANY_PENDING")) return "Bạn đang có quá nhiều yêu cầu nạp chờ xác nhận (tối đa 5). Hãy chờ Admin đối soát.";
  if (message.includes("PLATFORM_RECEIVING_ACCOUNT_NOT_CONFIGURED")) return "Admin chưa cấu hình tài khoản nhận VND trung tâm.";
  if (message.includes("create_wallet_topup")) return "Database chưa được cập nhật migration ví.";
  return "Không thể tạo yêu cầu nạp ví lúc này. Vui lòng thử lại.";
}

export async function createWalletTopup(formData: FormData): Promise<WalletTopupResult> {
  const { supabase } = await requireActionRole(["donor", "org"]);
  const amount = Number(String(formData.get("amountVnd") ?? "").replace(/[^0-9]/g, ""));
  if (!Number.isSafeInteger(amount) || amount < WALLET_MIN_TOPUP || amount > WALLET_MAX_TOPUP) {
    return { ok: false, message: "Số tiền nạp phải từ 10.000đ đến 10 tỷ đồng." };
  }

  const { data, error } = await supabase.rpc("create_wallet_topup", { p_amount_vnd: amount });
  if (error) {
    console.error("Failed to create wallet top-up", { code: error.code, message: error.message });
    return { ok: false, message: walletErrorMessage(error.message) };
  }
  const row = (Array.isArray(data) ? data[0] : data) as TopupRow | null;
  if (!row) return { ok: false, message: "Hệ thống không nhận được yêu cầu nạp vừa tạo." };

  const amountVnd = Number(row.amount_vnd);
  revalidatePath("/wallet");
  return {
    ok: true,
    message: "Đã tạo yêu cầu nạp ví. Số dư chỉ được cộng sau khi Admin đối soát khớp sao kê ngân hàng.",
    intent: {
      id: row.id,
      txRef: row.tx_ref,
      amountVnd,
      bankId: row.bank_id,
      accountNo: row.account_no,
      accountName: row.account_name,
      transferDescription: row.transfer_description,
      qrUrl: buildVietQrUrl(
        { bank_id: row.bank_id, account_no: row.account_no, account_name: row.account_name, description_template: row.transfer_description },
        { amount: amountVnd, campaignSlug: "", campaignId: "", txRef: row.tx_ref },
      ),
    },
  };
}
