"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getMyRescueApplicationStatus, type MyRescueApplicationStatus } from "@/app/rescue/apply/actions";
import { RescueApplyForm } from "@/components/rescue/rescue-apply-form";

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: "Chờ duyệt", className: "bg-nghe/15 text-ngheDeep" },
  needs_revision: { label: "Cần bổ sung", className: "bg-sky/15 text-sky" },
  approved: { label: "Đã duyệt", className: "bg-lua/15 text-lua" },
  rejected: { label: "Từ chối", className: "bg-son/15 text-son" },
};

const datetime = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function RescueApplyModal({ isAuthenticated, triggerClassName, triggerLabel }: { isAuthenticated: boolean; triggerClassName: string; triggerLabel: string }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [existing, setExisting] = useState<MyRescueApplicationStatus>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

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

  async function handleOpen() {
    setOpen(true);
    if (!isAuthenticated) return;
    setLoadingStatus(true);
    setStatusError(null);
    try {
      const status = await getMyRescueApplicationStatus();
      setExisting(status);
    } catch {
      setStatusError("Không thể tải trạng thái hồ sơ. Vui lòng thử lại.");
    } finally {
      setLoadingStatus(false);
    }
  }

  function close() {
    setOpen(false);
  }

  const canSubmitNew = !existing || existing.status === "rejected";

  return (
    <>
      <button type="button" onClick={handleOpen} className={triggerClassName}>
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
                aria-label="Hồ sơ hoạt động cứu trợ"
                className="relative max-h-[92vh] w-full max-w-[640px] overflow-y-auto rounded-[16px] bg-white p-6 shadow-modal sm:p-7"
              >
                <button type="button" onClick={close} aria-label="Đóng" className="absolute right-5 top-4 text-2xl text-inkSoft hover:text-son">×</button>

                <h2 className="pr-8 font-serif text-xl font-semibold text-chamDeep">Hồ sơ hoạt động cứu trợ</h2>
                <p className="mt-1 text-sm leading-6 text-inkMid">
                  Đăng ký cá nhân/đội cứu trợ tự phát. Gửi hồ sơ không tự kích hoạt tài khoản — chỉ Admin xem xét và cấp quyền điều phối sau khi duyệt.
                </p>

                {!isAuthenticated ? (
                  <div className="mt-5 rounded-[14px] border border-line bg-paper p-6 text-center">
                    <p className="text-sm text-inkMid">Cần đăng nhập để gửi hồ sơ đăng ký đội cứu trợ.</p>
                    <a href="/login?next=/sos" className="button-primary mt-4 inline-flex">
                      Đăng nhập
                    </a>
                  </div>
                ) : loadingStatus ? (
                  <p className="mt-5 text-sm text-inkSoft">Đang tải trạng thái hồ sơ…</p>
                ) : statusError ? (
                  <p className="mt-5 rounded-[8px] bg-son/10 p-3 text-sm text-son">{statusError}</p>
                ) : (
                  <>
                    {existing ? (
                      <div className="mt-5 rounded-[14px] border border-line bg-white p-5">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-serif text-base font-semibold text-chamDeep">
                            Hồ sơ gần nhất{existing.team_name ? ` — ${existing.team_name}` : ""}
                          </h3>
                          <span className={`rounded-[4px] px-2 py-1 text-xs font-bold ${statusLabels[existing.status]?.className ?? "bg-inkSoft/15 text-inkSoft"}`}>
                            {statusLabels[existing.status]?.label ?? existing.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-inkSoft">Gửi lúc {datetime.format(new Date(existing.created_at))}</p>
                        {existing.review_note ? <p className="mt-2 rounded-[8px] bg-paper p-3 text-sm text-inkMid">Ghi chú từ Admin: {existing.review_note}</p> : null}
                        {!canSubmitNew ? (
                          <p className="mt-3 text-sm text-inkSoft">
                            {existing.status === "pending" ? "Hồ sơ đang chờ Admin xem xét." : "Hồ sơ đã được duyệt — tài khoản cứu trợ đã kích hoạt (nếu đủ điều kiện)."}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {canSubmitNew ? (
                      <div className="mt-5">
                        <RescueApplyForm />
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
