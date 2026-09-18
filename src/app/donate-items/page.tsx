import { ModulePage } from "@/components/module-page";

export default function DonateItemsPage() {
  return (
    <ModulePage
      eyebrow="Nguồn lực cộng đồng"
      title="Nguồn lực"
      description="Đóng góp hiện vật, ngày công, xe vận chuyển — và nhận hỗ trợ từ wishlist. Sẽ dựng ở đợt sau."
      items={["Đăng ký đóng góp hiện vật/ngày công/xe", "Wishlist cần nhận", "Claim vật phẩm", "Liên hệ điều phối"]}
    />
  );
}
