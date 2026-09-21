"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createOrganizationCampaign } from "@/app/organization/actions";
import { CAMPAIGN_CATEGORIES } from "@/lib/campaigns/categories";

type CampaignType = "direct" | "partner";

const typeOptions: { value: CampaignType; icon: string; name: string; desc: string }[] = [
  { value: "direct", icon: "\u{1F3E6}", name: "Trực tiếp", desc: "Quỹ tự triển khai. Hệ thống tự tách 90/10 theo NĐ 93/2021." },
  { value: "partner", icon: "\u{1F517}", name: "Kết nối", desc: "Chuyển thẳng đến đối tác. E-Receipt tự động qua Webhook." },
];

export function CreateCampaignModal({ disabled = false, disabledReason }: { disabled?: boolean; disabledReason?: string }) {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CampaignType>("direct");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function close() {
    setOpen(false);
    setError(null);
    setSuccess(false);
    setType("direct");
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    formData.set("campaignType", type);
    try {
      const result = await createOrganizationCampaign(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Phiên đăng nhập không hợp lệ hoặc bạn không có quyền tạo chiến dịch.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        className="rounded-[40px] bg-chamDeep px-4 py-2 text-[13px] font-bold text-white transition hover:bg-chamDeep/90 disabled:cursor-not-allowed disabled:opacity-45"
      >
        Tạo chiến dịch
      </button>

      {open && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) close();
              }}
            >
              <div className="relative max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-[14px] bg-white p-7 shadow-modal">
                <button
                  type="button"
                  onClick={close}
                  aria-label="Đóng"
                  className="absolute right-5 top-5 text-xl text-inkSoft transition hover:text-son"
                >
                  &#215;
                </button>

                <h2 className="font-serif text-xl font-semibold text-chamDeep">Tạo chiến dịch mới</h2>
                <p className="mt-1 text-sm text-inkMid">Chọn loại hình để hệ thống cấu hình dòng tiền phù hợp.</p>

                {success ? (
                  <div className="mt-6 rounded-[8px] bg-lua/10 p-4 text-sm text-lua">
                    Đã tạo bản nháp. Bạn có thể gửi chiến dịch xét duyệt trong Cổng tổ chức.
                    <button type="button" onClick={close} className="button-primary mt-4 w-full">
                      Đóng
                    </button>
                  </div>
                ) : (
                  <form action={handleSubmit} className="mt-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {typeOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setType(opt.value)}
                          className={`rounded-[8px] border p-3 text-left transition ${
                            type === opt.value ? "border-son bg-son/5" : "border-line hover:border-lineStrong"
                          }`}
                        >
                          <div className="text-2xl">{opt.icon}</div>
                          <div className="mt-1 text-sm font-bold text-chamDeep">{opt.name}</div>
                          <div className="mt-0.5 text-xs leading-4 text-inkSoft">{opt.desc}</div>
                        </button>
                      ))}
                    </div>

                    {error ? <p className="rounded-[8px] bg-son/10 p-3 text-sm text-son">{error}</p> : null}

                    <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                      Tên chiến dịch
                      <input
                        className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal"
                        name="title"
                        placeholder="VD: Học bổng cho 50 học sinh Hà Giang 2026"
                        required
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                        Mục tiêu (VND)
                        <input
                          className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal"
                          name="targetAmount"
                          type="number"
                          min={1}
                          placeholder="50000000"
                          required
                        />
                      </label>
                      <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                        Thời hạn
                        <input className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="deadline" type="date" />
                      </label>
                    </div>

                    <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                      Hạng mục
                      <select className="rounded-[8px] border border-line bg-white px-4 py-3 text-sm font-normal" name="category">
                        {CAMPAIGN_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                      Mô tả chiến dịch
                      <textarea
                        className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal"
                        name="description"
                        rows={3}
                        placeholder="Mô tả chi tiết về mục đích, đối tượng thụ hưởng và kế hoạch sử dụng tiền…"
                      />
                    </label>

                    <p className="rounded-[8px] bg-paper p-3 text-xs leading-5 text-inkMid">
                      Sau khi gửi, Admin sẽ kiểm tra giấy phép hoạt động của tổ chức trong vòng 3–5 ngày làm việc trước khi chiến dịch được
                      công khai.
                    </p>

                    <button className="button-primary w-full" type="submit" disabled={loading}>
                      {loading ? "Đang gửi…" : "Gửi hồ sơ xét duyệt →"}
                    </button>
                  </form>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
