"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/server";
import { slugify } from "@/lib/utils/slugify";
import type { NewsPostStatus } from "@/lib/news/types";
import { destroyCloudinaryAsset, uploadToCloudinary } from "@/lib/cloudinary/server";
import { sanitizeNewsHtml } from "@/lib/news/content";

export type NewsActionResult = { ok: true; message: string } | { ok: false; message: string };

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullableText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value || null;
}

function parseStatus(value: string): NewsPostStatus {
  if (value === "published" || value === "archived") return value;
  return "draft";
}

function parseTags(value: string) {
  return Array.from(new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))).slice(0, 12);
}

function validatePayload(formData: FormData) {
  const title = text(formData, "title");
  const excerpt = text(formData, "excerpt");
  const content = text(formData, "content");
  const category = text(formData, "category") || "Tin tức";
  const coverUrl = nullableText(formData, "coverUrl");
  const status = parseStatus(text(formData, "status"));
  const tags = parseTags(text(formData, "tags"));
  const metaTitle = text(formData, "metaTitle");
  const metaDescription = text(formData, "metaDescription");
  const focusKeyword = text(formData, "focusKeyword");
  const canonicalUrl = nullableText(formData, "canonicalUrl");
  const safeContent = sanitizeNewsHtml(content);

  if (title.length < 3 || title.length > 180) throw new Error("Tiêu đề phải dài từ 3 đến 180 ký tự.");
  if (!safeContent || !safeContent.replace(/<[^>]*>/g, "").trim()) throw new Error("Nội dung bài viết không được để trống.");
  if (content.length > 100_000) throw new Error("Nội dung bài viết không được vượt quá 100.000 ký tự.");
  if (excerpt.length > 500) throw new Error("Mô tả ngắn không được vượt quá 500 ký tự.");
  if (category.length > 80) throw new Error("Chuyên mục không được vượt quá 80 ký tự.");
  if (metaTitle.length > 70) throw new Error("SEO title nên tối đa 70 ký tự.");
  if (metaDescription.length > 180) throw new Error("Meta description nên tối đa 180 ký tự.");
  if (focusKeyword.length > 100) throw new Error("Từ khóa chính tối đa 100 ký tự.");
  if (canonicalUrl) {
    try {
      if (new URL(canonicalUrl).protocol !== "https:") throw new Error();
    } catch {
      throw new Error("Canonical URL phải là URL HTTPS hợp lệ.");
    }
  }
  if (coverUrl) {
    try {
      if (new URL(coverUrl).protocol !== "https:") throw new Error();
    } catch {
      throw new Error("Ảnh cover phải là URL HTTPS hợp lệ.");
    }
  }

  return { title, excerpt, content: safeContent, category, cover_url: coverUrl, status, tags, meta_title: metaTitle || null, meta_description: metaDescription || null, focus_keyword: focusKeyword || null, canonical_url: canonicalUrl };
}

function refreshNews() {
  revalidatePath("/news");
  revalidatePath("/admin");
}

export async function createNewsPost(formData: FormData): Promise<NewsActionResult> {
  const { supabase, user } = await requireActionRole(["admin"]);
  try {
    const payload = validatePayload(formData);
    const slugInput = text(formData, "slug");
    const slug = slugInput || slugify(payload.title);
    const publishedAt = payload.status === "published" ? new Date().toISOString() : null;
    const { error } = await supabase.from("news_posts").insert({
      ...payload,
      slug,
      author_id: user.id,
      published_at: publishedAt,
    });
    if (error) {
      if (error.code === "23505") return { ok: false, message: "Slug đã tồn tại. Hãy nhập slug khác." };
      return { ok: false, message: error.message };
    }
    refreshNews();
    return { ok: true, message: "Đã tạo bài viết." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Không thể tạo bài viết." };
  }
}

export async function updateNewsPost(id: string, formData: FormData): Promise<NewsActionResult> {
  const { supabase } = await requireActionRole(["admin"]);
  if (!id) return { ok: false, message: "Thiếu mã bài viết." };
  try {
    const payload = validatePayload(formData);
    const slugInput = text(formData, "slug");
    const slug = slugInput || slugify(payload.title);
    const current = await supabase.from("news_posts").select("published_at").eq("id", id).maybeSingle();
    if (current.error || !current.data) return { ok: false, message: "Không tìm thấy bài viết." };
    const publishedAt = payload.status === "published"
      ? current.data.published_at ?? new Date().toISOString()
      : null;
    const { error } = await supabase.from("news_posts").update({ ...payload, slug, published_at: publishedAt }).eq("id", id);
    if (error) {
      if (error.code === "23505") return { ok: false, message: "Slug đã tồn tại. Hãy nhập slug khác." };
      return { ok: false, message: error.message };
    }
    refreshNews();
    return { ok: true, message: "Đã cập nhật bài viết." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Không thể cập nhật bài viết." };
  }
}

export async function deleteNewsPost(id: string): Promise<NewsActionResult> {
  const { supabase } = await requireActionRole(["admin"]);
  if (!id) return { ok: false, message: "Thiếu mã bài viết." };
  const { error } = await supabase.from("news_posts").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  refreshNews();
  return { ok: true, message: "Đã xóa bài viết." };
}

export type NewsMediaActionResult =
  | { ok: true; asset: { id: string; url: string; public_id: string; original_name: string; alt_text: string; width: number | null; height: number | null; created_at: string } }
  | { ok: false; message: string };

export async function uploadNewsImage(formData: FormData): Promise<NewsMediaActionResult> {
  const { supabase, user } = await requireActionRole(["admin"]);
  const file = formData.get("file");
  const altText = text(formData, "altText").slice(0, 300);
  if (!(file instanceof File) || file.size < 1) return { ok: false, message: "Hãy chọn ảnh cần tải lên." };
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
    return { ok: false, message: "Ảnh phải là JPG, PNG hoặc WebP và tối đa 10 MB." };
  }

  try {
    const uploaded = await uploadToCloudinary(file, "thiennguyen/news", `news-${Date.now()}-${crypto.randomUUID()}`);
    const { data, error } = await supabase.from("news_media").insert({
      url: uploaded.secureUrl,
      public_id: uploaded.publicId,
      original_name: file.name.slice(0, 255),
      alt_text: altText,
      uploaded_by: user.id,
    }).select("id, url, public_id, original_name, alt_text, width, height, created_at").single();

    if (error || !data) {
      await destroyCloudinaryAsset(uploaded.publicId).catch(() => undefined);
      console.error("Could not store news media metadata", error);
      return { ok: false, message: "Ảnh đã tải lên nhưng không lưu được vào thư viện. Hãy thử lại hoặc liên hệ kỹ thuật." };
    }
    revalidatePath("/admin");
    return { ok: true, asset: data };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Không thể tải ảnh lên." };
  }
}
