import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationCategory =
  | "payment_pending"
  | "payment_completed"
  | "payment_rejected"
  | "campaign_status"
  | "resource_update"
  | "admin_alert"
  | "other";

type NotifyUserInput = {
  userId: string;
  category: NotificationCategory;
  title: string;
  body?: string;
  link?: string;
};

// Ghi một thông báo trong app cho một người dùng cụ thể. Chạy bằng service role (bypass RLS) vì
// server action gọi hàm này thường không phải chính chủ sở hữu thông báo (ví dụ Admin tạo thông
// báo cho donor). Không bao giờ throw ra ngoài — lỗi ghi thông báo không được làm hỏng luồng chính.
export async function notifyUser(input: NotifyUserInput): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("notifications").insert({
      user_id: input.userId,
      category: input.category,
      title: input.title,
      body: input.body ?? "",
      link: input.link ?? null,
    });
    if (error) console.error("Failed to write notification", { userId: input.userId, error });
  } catch (error) {
    console.error("Failed to write notification (unexpected)", { userId: input.userId, error });
  }
}

// Gửi cùng một thông báo cho toàn bộ tài khoản admin — dùng cho cảnh báo giao dịch chờ đối soát.
export async function notifyAdmins(input: Omit<NotifyUserInput, "userId">): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: admins, error } = await admin.from("profiles").select("id").eq("role", "admin");
    if (error) {
      console.error("Failed to list admins for notification", error);
      return;
    }
    if (!admins?.length) return;
    const rows = admins.map((row) => ({
      user_id: row.id,
      category: input.category,
      title: input.title,
      body: input.body ?? "",
      link: input.link ?? null,
    }));
    const { error: insertError } = await admin.from("notifications").insert(rows);
    if (insertError) console.error("Failed to write admin notifications", insertError);
  } catch (error) {
    console.error("Failed to write admin notifications (unexpected)", error);
  }
}
