export type NewsPostStatus = "draft" | "published" | "archived";

export type NewsPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  cover_url: string | null;
  status: NewsPostStatus;
  author_id: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  meta_title: string | null;
  meta_description: string | null;
  focus_keyword: string | null;
  canonical_url: string | null;
};

export type NewsMediaAsset = {
  id: string;
  url: string;
  public_id: string;
  original_name: string;
  alt_text: string;
  width: number | null;
  height: number | null;
  created_at: string;
};

export function newsStatusLabel(status: NewsPostStatus) {
  return {
    draft: "Bản nháp",
    published: "Đã xuất bản",
    archived: "Lưu trữ",
  }[status];
}
