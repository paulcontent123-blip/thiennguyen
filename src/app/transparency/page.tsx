import { ModulePage } from "@/components/module-page";

export default function TransparencyPage() {
  return <ModulePage eyebrow="Public" title="Minh bạch" description="Các báo cáo công khai phải masking dữ liệu nhạy cảm trước khi hiển thị." items={["Dòng tiền", "Báo cáo campaign", "Bằng chứng đã công khai", "Hồ sơ tổ chức đã xác minh"]} />;
}
