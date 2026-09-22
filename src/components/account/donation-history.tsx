import Link from "next/link";
import type { DonationHistoryItem } from "@/lib/donations/types";

const currency = new Intl.NumberFormat("vi-VN");
const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: "Chờ xác nhận", className: "bg-ngheXsoft text-ngheDeep" },
  completed: { label: "Thành công", className: "bg-lua/10 text-lua" },
  needs_review: { label: "Cần đối soát", className: "bg-sky/10 text-sky" },
  failed: { label: "Thất bại", className: "bg-son/10 text-son" },
  expired: { label: "Hết hạn", className: "bg-paperDeep text-inkSoft" },
  refunded: { label: "Đã hoàn tiền", className: "bg-paperDeep text-inkMid" },
};

export function DonationHistory({ items }: { items: DonationHistoryItem[] }) {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-12">
      <div className="panel">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-semibold text-chamDeep">Lịch sử ủng hộ</h2>
            <p className="mt-1 text-sm text-inkSoft">Theo dõi mã giao dịch VietQR và trạng thái đối soát ngân hàng.</p>
          </div>
          <Link href="/campaigns" className="text-sm font-bold text-son hover:underline">Khám phá chiến dịch →</Link>
        </div>

        {items.length === 0 ? (
          <div className="mt-5 rounded-[10px] border border-dashed border-lineStrong bg-paper px-4 py-8 text-center text-sm text-inkSoft">Bạn chưa tạo giao dịch ủng hộ nào bằng tài khoản này.</div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-inkSoft">
                  <th className="px-3 py-2 font-semibold">Mã giao dịch</th>
                  <th className="px-3 py-2 font-semibold">Chiến dịch</th>
                  <th className="px-3 py-2 text-right font-semibold">Số tiền</th>
                  <th className="px-3 py-2 font-semibold">Trạng thái</th>
                  <th className="px-3 py-2 font-semibold">Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const status = statusLabels[item.status] ?? { label: item.status, className: "bg-paperDeep text-inkMid" };
                  return (
                    <tr key={item.id} className="border-b border-line/70 last:border-0">
                      <td className="px-3 py-3 font-mono text-xs font-bold text-chamDeep">{item.txRef}</td>
                      <td className="px-3 py-3"><Link href={`/campaigns/${item.campaignSlug}`} className="font-semibold text-chamDeep hover:text-son">{item.campaignTitle}</Link></td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-son">{currency.format(item.amountVnd)}đ</td>
                      <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>{status.label}</span></td>
                      <td className="px-3 py-3 text-xs text-inkSoft">{dateTime.format(new Date(item.completedAt ?? item.createdAt))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
