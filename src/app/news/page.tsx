import Link from "next/link";
import Image from "next/image";
import { SiteHeader } from "@/components/site-header";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { NewsPost } from "@/lib/news/types";
import { shouldBypassImageOptimization } from "@/lib/images";

export const dynamic = "force-dynamic";

async function loadNews(): Promise<NewsPost[]> {
  if (!hasSupabaseEnv()) return [];
  const { data, error } = await createClient()
    .from("news_posts")
    .select("id, slug, title, excerpt, content, category, tags, cover_url, status, author_id, published_at, created_at, updated_at, meta_title, meta_description, focus_keyword, canonical_url")
    .eq("status", "published")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });
  if (error) {
    console.error("Failed to load public news", error);
    return [];
  }
  return (data ?? []) as NewsPost[];
}

export default async function NewsPage() {
  const posts = await loadNews();
  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-[1160px] px-6 py-12 sm:px-7">
        <div className="max-w-2xl">
          <p className="eyebrow">Tin tức & câu chuyện</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-chamDeep sm:text-4xl">Tin tức Thiện Nguyện</h1>
          <p className="mt-3 text-sm leading-7 text-inkMid">Cập nhật hoạt động, câu chuyện cộng đồng và những thay đổi mới nhất từ nền tảng.</p>
        </div>
        {posts.length === 0 ? (
          <div className="mt-10 rounded-[14px] border border-line bg-white p-10 text-center text-sm text-inkSoft">Chưa có tin tức được xuất bản.</div>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <article key={post.id} className="overflow-hidden rounded-[14px] border border-line bg-white transition hover:-translate-y-0.5 hover:shadow-modal">
                {post.cover_url ? <Image src={post.cover_url} alt="" width={800} height={450} unoptimized={shouldBypassImageOptimization(post.cover_url)} className="h-44 w-full object-cover" /> : <div className="h-44 bg-gradient-to-br from-chamDeep to-sky" />}
                <div className="p-5">
                  <div className="text-xs font-bold uppercase tracking-[0.08em] text-son">{post.category}</div>
                  <h2 className="mt-2 font-serif text-xl font-semibold leading-snug text-chamDeep"><Link href={`/news/${post.slug}`} className="hover:text-son">{post.title}</Link></h2>
                  {post.excerpt ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-inkMid">{post.excerpt}</p> : null}
                  <div className="mt-4 flex items-center justify-between text-xs text-inkSoft"><time dateTime={post.published_at ?? post.created_at}>{new Date(post.published_at ?? post.created_at).toLocaleDateString("vi-VN")}</time><Link href={`/news/${post.slug}`} className="font-bold text-son hover:underline">Đọc tiếp →</Link></div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
