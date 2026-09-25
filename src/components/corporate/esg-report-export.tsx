"use client";

export type CorporateEsgExportData = {
  companyName: string;
  year: number;
  generatedAt: string;
  campaignCount: number;
  committedAmount: number;
  receivedAmount: number;
  disbursedAmount: number;
  donationCount: number;
  donorCount: number;
  evidenceCount: number;
  fieldUpdateCount: number;
  deliveredResourceCount: number;
  deliveredResourceValue: number;
  campaigns: Array<{
    title: string;
    status: string;
    province: string;
    committed: number;
    received: number;
    disbursed: number;
    evidenceCount: number;
    fieldUpdateCount: number;
  }>;
};

function cell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function EsgReportExport({ report }: { report: CorporateEsgExportData }) {
  function exportCsv() {
    const rows: Array<Array<string | number>> = [
      ["BÁO CÁO TÁC ĐỘNG ESG TỰ ĐỘNG"],
      ["Doanh nghiệp", report.companyName],
      ["Năm báo cáo", report.year],
      ["Tạo lúc", report.generatedAt],
      [],
      ["Chỉ số", "Giá trị"],
      ["Chiến dịch đồng hành", report.campaignCount],
      ["Giá trị cam kết VND", report.committedAmount],
      ["Tiền thực nhận VND", report.receivedAmount],
      ["Giải ngân hợp lệ VND", report.disbursedAmount],
      ["Lượt ủng hộ", report.donationCount],
      ["Nhà hảo tâm", report.donorCount],
      ["Tệp bằng chứng", report.evidenceCount],
      ["Cập nhật thực địa", report.fieldUpdateCount],
      ["Lượt nguồn lực đã bàn giao", report.deliveredResourceCount],
      ["Giá trị nguồn lực ghi nhận VND", report.deliveredResourceValue],
      [],
      ["Chiến dịch", "Trạng thái", "Tỉnh/thành", "Cam kết VND", "Thực nhận VND", "Giải ngân VND", "Bằng chứng", "Cập nhật thực địa"],
      ...report.campaigns.map((item) => [item.title, item.status, item.province, item.committed, item.received, item.disbursed, item.evidenceCount, item.fieldUpdateCount]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(cell).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `esg-${report.companyName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "doanh-nghiep"}-${report.year}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <div className="flex flex-wrap gap-2 print:hidden">
    <button type="button" onClick={exportCsv} className="rounded-[7px] border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15">Xuất CSV</button>
    <button type="button" onClick={() => window.print()} className="rounded-[7px] bg-son px-4 py-2 text-sm font-bold text-white">In / lưu PDF</button>
  </div>;
}
