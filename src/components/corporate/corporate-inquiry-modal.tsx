"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { submitCorporateInquiry } from "@/app/corporate/actions";
import { BUDGET_RANGES, type InquiryInterest } from "@/lib/corporate/options";

type Props = {
  triggerClassName: string;
  triggerLabel: string;
  interest?: InquiryInterest;
  campaign?: { id: string; title: string };
};

export function CorporateInquiryModal({ triggerClassName, triggerLabel, interest = "other", campaign }: Props) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      const result = await submitCorporateInquiry(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(result.message);
    } catch {
      setError("Không thể kết nối tới hệ thống. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {triggerLabel}
      </button>

      {open && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/55 px-4 py-6"
              onClick={(event) => {
                if (event.target === event.currentTarget) close();
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Tư vấn giải pháp đồng hành"
                className="relative max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-[16px] bg-white p-6 shadow-modal sm:p-7"
              >
                <button type="button" onClick={close} aria-label="Đóng" className="absolute right-5 top-4 text-2xl text-inkSoft hover:text-son">×</button>
                <h2 className="pr-8 font-serif text-xl font-semibold text-chamDeep">Tư vấn giải pháp đồng hành</h2>
                <p className="mt-1 text-sm text-inkMid">Đội ngũ sẽ liên hệ với bạn qua email.</p>

                {campaign ? (
                  <p className="mt-3 rounded-[8px] bg-paper px-3 py-2 text-sm text-chamDeep">
                    Chiến dịch quan tâm: <strong>{campaign.title}</strong>
                  </p>
                ) : null}

                {success ? (
                  <div className="mt-5 rounded-[14px] border border-lua/30 bg-lua/10 p-5 text-sm text-lua">
                    {success}
                    <button type="button" onClick={close} className="button-secondary mt-4 block">Đóng</button>
                  </div>
                ) : (
                  <form action={handleSubmit} className="mt-5 space-y-4">
                    {error ? <p className="rounded-[8px] bg-son/10 p-3 text-sm text-son">{error}</p> : null}
                    <input type="hidden" name="interest" value={interest} />
                    {campaign ? <input type="hidden" name="campaignId" value={campaign.id} /> : null}
                    <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 opacity-0" />

                    <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                      Tên doanh nghiệp
                      <input className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="companyName" placeholder="Công ty TNHH ABC Việt Nam" required maxLength={200} />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                        Người liên hệ
                        <input className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="contactName" placeholder="Họ và tên" required maxLength={120} />
                      </label>
                      <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                        Email
                        <input className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="contactEmail" type="email" placeholder="csr@company.com" required maxLength={254} />
                      </label>
                    </div>
                    <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                      Ngân sách CSR dự kiến / năm
                      <select className="rounded-[8px] border border-line bg-white px-4 py-3 text-sm font-normal" name="budgetRange" defaultValue="" required>
                        <option value="" disabled>Chọn mức ngân sách</option>
                        {BUDGET_RANGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                      Lĩnh vực ưu tiên <span className="font-normal text-inkSoft">(tùy chọn)</span>
                      <input className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="focusArea" placeholder="VD: Giáo dục vùng cao, Y tế cộng đồng…" maxLength={300} />
                    </label>
                    <button className="button-primary w-full" type="submit" disabled={loading}>
                      {loading ? "Đang gửi…" : "Gửi yêu cầu tư vấn →"}
                    </button>
                  </form>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
