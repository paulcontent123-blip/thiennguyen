"use client";

type ClosureExportData = {
  title: string;
  status: string;
  closedAt: string;
  totalReceived: number;
  totalDisbursed: number;
  balance: number;
  donationCount: number;
  donorCount: number;
  disbursements: Array<{ description: string; amount: number; evidenceCount: number; auditedAt: string }>;
};

function cell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function ClosureExportButtons({ report }: { report: ClosureExportData }) {
  function exportCsv() {
    const rows: Array<Array<string | number>> = [
      ["BÁO CÁO TẤT TOÁN CHIẾN DỊCH"],
      ["Chiến dịch", report.title],
      ["Trạng thái", report.status],
      ["Ngày đóng", report.closedAt],
      ["Tổng thực nhận VND", report.totalReceived],
      ["Tổng giải ngân hợp lệ VND", report.totalDisbursed],
      ["Số dư VND", report.balance],
      ["Lượt ủng hộ", report.donationCount],
      ["Nhà hảo tâm", report.donorCount],
      [],
      ["Khoản giải ngân", "Số tiền VND", "Tệp bằng chứng", "Hậu kiểm lúc"],
      ...report.disbursements.map((item) => [item.description, item.amount, item.evidenceCount, item.auditedAt]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(cell).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tat-toan-${report.title.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "chien-dich"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <div className="flex flex-wrap gap-2 print:hidden">
    <button type="button" onClick={exportCsv} className="rounded-[7px] border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15">Xuất CSV</button>
    <button type="button" onClick={() => window.print()} className="rounded-[7px] bg-son px-4 py-2 text-sm font-bold text-white">In / lưu PDF</button>
  </div>;
}
