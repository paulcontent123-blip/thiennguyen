import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getPublicNews, getPublicNewsPost } from "@/lib/public-data";
import type { NewsPost } from "@/lib/news/types";
import { shouldBypassImageOptimization } from "@/lib/images";
import { extractNewsHeadings, sanitizeNewsHtml } from "@/lib/news/content";

async function loadPost(slug: string) {
  return getPublicNewsPost(slug);
}

async function loadRelatedPosts(post: NewsPost) {
  const { posts } = await getPublicNews();
  const tags = new Set(post.tags.map((tag) => tag.toLowerCase()));
  return posts.filter((item) => item.id !== post.id).slice(0, 24).map((item) => ({
    ...item,
    score: (item.category === post.category ? 2 : 0) + (item.tags ?? []).filter((tag: string) => tags.has(tag.toLowerCase())).length,
  })).sort((a, b) => b.score - a.score || new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime()).slice(0, 4);
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { post } = await loadPost(params.slug);
  if (!post) return { title: "Tin tức | Thiện Nguyện" };
  return {
    title: post.meta_title || `${post.title} | Thiện Nguyện`,
    description: post.meta_description || post.excerpt || undefined,
    alternates: post.canonical_url ? { canonical: post.canonical_url } : undefined,
    openGraph: { title: post.meta_title || post.title, description: post.meta_description || post.excerpt || undefined, images: post.cover_url ? [post.cover_url] : undefined, type: "article" },
  };
}

export default async function NewsDetailPage({ params }: { params: { slug: string } }) {
  const postResult = await loadPost(params.slug);
  const post = postResult.post;
  if (!post && !postResult.error) notFound();
  if (!post) {
    return (
      <main className="min-h-screen bg-paper">
        <SiteHeader />
        <section className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="font-serif text-3xl font-semibold text-chamDeep">Bài viết tạm thời chưa tải được</h1>
          <p className="mt-3 text-inkMid">Máy chủ dữ liệu đang gặp sự cố. Vui lòng thử lại sau ít phút.</p>
          <Link href="/news" className="button-primary mt-6 inline-flex">Quay lại tin tức</Link>
        </section>
      </main>
    );
  }
  const safeHtml = sanitizeNewsHtml(post.content);
  const headings = extractNewsHeadings(safeHtml);
  const relatedPosts = await loadRelatedPosts(post);

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <article className="mx-auto max-w-[1160px] px-6 py-10 sm:px-7 sm:py-14">
        <Link href="/news" className="text-sm font-bold text-son hover:underline">← Tất cả tin tức</Link>
        <header className="mx-auto mt-7 max-w-[860px]">
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-son">{post.category}</div>
          <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-chamDeep sm:text-5xl">{post.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-inkSoft"><time dateTime={post.published_at ?? post.created_at}>{new Date(post.published_at ?? post.created_at).toLocaleDateString("vi-VN")}</time><span>·</span><span>{post.tags.join(" · ")}</span></div>
          {post.cover_url ? <Image src={post.cover_url} alt={post.title} width={1400} height={788} unoptimized={shouldBypassImageOptimization(post.cover_url)} priority className="mt-8 max-h-[480px] w-full rounded-[14px] object-cover" /> : null}
          {post.excerpt ? <p className="mt-8 border-l-4 border-son pl-4 text-lg leading-8 text-inkMid">{post.excerpt}</p> : null}
        </header>

        <div className="mx-auto mt-10 grid max-w-[1100px] gap-8 lg:grid-cols-[minmax(0,760px)_280px] lg:items-start">
          <div className="min-w-0">
            {headings.length > 0 ? <nav aria-label="Mục lục bài viết" className="mb-8 rounded-[10px] border border-line bg-white p-5 lg:hidden"><h2 className="font-serif text-lg font-semibold text-chamDeep">Trong bài viết</h2><ul className="mt-3 space-y-2">{headings.map((heading) => <li key={heading.id} className={heading.level > 2 ? "pl-4" : ""}><a href={`#${heading.id}`} className="text-sm text-sky hover:underline">{heading.text}</a></li>)}</ul></nav> : null}
            <div className="news-article-content" dangerouslySetInnerHTML={{ __html: safeHtml }} />
            {post.tags.length ? <div className="mt-10 flex flex-wrap gap-2">{post.tags.map((tag) => <span key={tag} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-inkMid">#{tag}</span>)}</div> : null}
          </div>
          <aside className="space-y-5">
            {headings.length > 0 ? <nav aria-label="Mục lục bài viết" className="sticky top-24 hidden rounded-[10px] border border-line bg-white p-5 lg:block"><h2 className="font-serif text-lg font-semibold text-chamDeep">Mục lục</h2><ul className="mt-3 space-y-2">{headings.map((heading) => <li key={heading.id} className={heading.level > 2 ? "pl-3" : ""}><a href={`#${heading.id}`} className="text-xs leading-5 text-inkMid hover:text-son">{heading.text}</a></li>)}</ul></nav> : null}
            {relatedPosts.length > 0 ? <section className="rounded-[10px] border border-line bg-white p-5"><h2 className="font-serif text-lg font-semibold text-chamDeep">Bài viết liên quan</h2><div className="mt-3 space-y-4">{relatedPosts.map((related) => <article key={related.id} className="flex gap-3">{related.cover_url ? <Image src={related.cover_url} alt="" width={76} height={64} unoptimized={shouldBypassImageOptimization(related.cover_url)} className="h-16 w-[76px] shrink-0 rounded-[5px] object-cover" /> : <div className="h-16 w-[76px] shrink-0 rounded-[5px] bg-paperDeep" />}<div className="min-w-0"><div className="text-[10px] font-bold uppercase text-son">{related.category}</div><Link href={`/news/${related.slug}`} className="mt-1 line-clamp-2 block text-sm font-semibold leading-5 text-chamDeep hover:text-son">{related.title}</Link></div></article>)}</div></section> : null}
          </aside>
        </div>
      </article>
    </main>
  );
}
