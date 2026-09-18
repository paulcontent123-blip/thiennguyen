import { ModulePage } from "@/components/module-page";

export default function IntroductionPage() {
  return (
    <ModulePage
      eyebrow="Về Thiện Nguyện"
      title="Giới thiệu"
      description="Sứ mệnh, cơ sở pháp lý, đội ngũ, đối tác và media kit. Sẽ dựng ở đợt sau."
      items={["Sứ mệnh & vấn đề cốt lõi", "Cơ sở pháp lý (NĐ 93/2021, NĐ 13/2023)", "Đội ngũ & đối tác", "Media kit"]}
    />
  );
}
