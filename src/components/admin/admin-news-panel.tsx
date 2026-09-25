"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createNewsPost, deleteNewsPost, updateNewsPost, uploadNewsImage, type NewsActionResult } from "@/app/admin/news/actions";
import { newsStatusLabel, type NewsMediaAsset, type NewsPost } from "@/lib/news/types";
import { shouldBypassImageOptimization } from "@/lib/images";

type SaveAction = (formData: FormData) => Promise<NewsActionResult>;
type EditorFields = {
  title: string; slug: string; category: string; status: string; excerpt: string; content: string;
  cover_url: string; tags: string; meta_title: string; meta_description: string; focus_keyword: string; canonical_url: string;
};

const blankPost: EditorFields = {
  title: "", slug: "", category: "Tin tức", status: "draft", excerpt: "", content: "",
  cover_url: "", tags: "", meta_title: "", meta_description: "", focus_keyword: "", canonical_url: "",
};

function makeFields(post?: NewsPost): EditorFields {
  if (!post) return blankPost;
  return {
    title: post.title, slug: post.slug, category: post.category, status: post.status, excerpt: post.excerpt,
    content: post.content, cover_url: post.cover_url ?? "", tags: post.tags.join(", "), meta_title: post.meta_title ?? "",
    meta_description: post.meta_description ?? "", focus_keyword: post.focus_keyword ?? "", canonical_url: post.canonical_url ?? "",
  };
}

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return <span className="flex items-center justify-between gap-2 text-xs font-bold text-chamDeep">{children}{hint ? <span className="font-normal text-inkSoft">{hint}</span> : null}</span>;
}

function Field({ label, name, value, onChange, maxLength, placeholder, type = "text" }: { label: string; name: keyof EditorFields; value: string; onChange: (name: keyof EditorFields, value: string) => void; maxLength?: number; placeholder?: string; type?: string }) {
  return <label className="grid gap-1"><Label hint={maxLength ? `${value.length}/${maxLength}` : undefined}>{label}</Label><input type={type} name={name} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(event) => onChange(name, event.target.value)} className="w-full rounded-[6px] border border-line px-3 py-2 text-sm font-normal outline-none focus:border-sky" /></label>;
}

function NewsEditorForm({ post, media, action, onDelete }: { post?: NewsPost; media: NewsMediaAsset[]; action: SaveAction; onDelete?: () => Promise<void> }) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [fields, setFields] = useState(() => makeFields(post));
  const [assets, setAssets] = useState(media);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"body" | "cover">("body");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function updateField(name: keyof EditorFields, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  function saveSelection() {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) savedRange.current = selection.getRangeAt(0).cloneRange();
  }

  function restoreSelection() {
    editorRef.current?.focus();
    const selection = window.getSelection();
    if (selection && savedRange.current) {
      selection.removeAllRanges();
      selection.addRange(savedRange.current);
    }
  }

  function command(name: string, value?: string) {
    restoreSelection();
    document.execCommand(name, false, value);
    if (editorRef.current) updateField("content", editorRef.current.innerHTML);
  }

  function insertHtml(html: string) {
    restoreSelection();
    document.execCommand("insertHTML", false, html);
    if (editorRef.current) updateField("content", editorRef.current.innerHTML);
    saveSelection();
  }

  function selectImage(asset: NewsMediaAsset, uploadedAlt?: string) {
    if (pickerTarget === "cover") {
      updateField("cover_url", asset.url);
    } else {
      const alt = uploadedAlt ?? window.prompt("Mô tả ảnh (alt text) để hỗ trợ SEO và khả năng tiếp cận:", asset.alt_text || asset.original_name || "Ảnh minh họa");
      if (alt === null) return;
      insertHtml(`<figure><img src="${asset.url}" alt="${alt.replace(/[&<>\"]/g, "")}" loading="lazy"><figcaption>${alt.replace(/[&<>]/g, "")}</figcaption></figure><p><br></p>`);
    }
    setPickerOpen(false);
  }

  async function uploadImage(file: File, altText = "") {
    const formData = new FormData();
    formData.set("file", file);
    formData.set("altText", altText);
    const result = await uploadNewsImage(formData);
    if (!result.ok) throw new Error(result.message);
    setAssets((current) => [result.asset, ...current.filter((asset) => asset.id !== result.asset.id)]);
    return result.asset;
  }

  async function handleFileSelected(file?: File) {
    if (!file) return;
    saveSelection();
    setBusy(true);
    setMessage(null);
    try {
      const alt = window.prompt("Mô tả ảnh (alt text):", file.name.replace(/\.[^.]+$/, "")) ?? "";
      const asset = await uploadImage(file, alt);
      selectImage(asset, alt);
      setMessage({ ok: true, text: "Ảnh đã tải lên Cloudinary và được lưu trong thư viện." });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Không tải được ảnh." });
    } finally {
      setBusy(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const formData = new FormData(event.currentTarget);
    formData.set("content", editorRef.current?.innerHTML ?? "");
    try {
      const result = await action(formData);
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) router.refresh();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Không lưu được bài viết." });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!onDelete || !window.confirm(`Xóa bài viết “${fields.title || "chưa đặt tiêu đề"}”?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await onDelete();
      router.refresh();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Không xóa được bài viết." });
    } finally {
      setBusy(false);
    }
  }

  function insertLink() {
    const url = window.prompt("Dán URL liên kết (HTTPS):");
    if (!url) return;
    try {
      if (new URL(url).protocol !== "https:") throw new Error();
      command("createLink", url);
    } catch {
      setMessage({ ok: false, text: "Liên kết phải bắt đầu bằng HTTPS." });
    }
  }

  function insertTable() {
    const rows = Math.min(12, Math.max(1, Number(window.prompt("Số hàng (tối đa 12):", "3")) || 3));
    const columns = Math.min(8, Math.max(1, Number(window.prompt("Số cột (tối đa 8):", "3")) || 3));
    const head = `<thead><tr>${Array.from({ length: columns }, (_, index) => `<th>Cột ${index + 1}</th>`).join("")}</tr></thead>`;
    const body = `<tbody>${Array.from({ length: Math.max(1, rows - 1) }, () => `<tr>${Array.from({ length: columns }, () => "<td>Nội dung</td>").join("")}</tr>`).join("")}</tbody>`;
    insertHtml(`<table>${head}${body}</table><p><br></p>`);
  }

  const metaTitle = fields.meta_title || fields.title;
  const metaDescription = fields.meta_description || fields.excerpt;

  return (
    <>
      <form onSubmit={handleSubmit} className="grid gap-4 rounded-[10px] border border-line bg-white p-4 lg:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_250px]">
          <div className="grid content-start gap-3">
            <Field label="Tiêu đề bài viết" name="title" value={fields.title} onChange={updateField} maxLength={180} placeholder="Viết tiêu đề rõ ràng, tập trung một ý chính" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Slug URL" name="slug" value={fields.slug} onChange={updateField} placeholder="Để trống để tự sinh từ tiêu đề" />
              <Field label="Chuyên mục" name="category" value={fields.category} onChange={updateField} maxLength={80} placeholder="Tin tức" />
            </div>
            <label className="grid gap-1"><Label hint={`${fields.excerpt.length}/500`}>Mô tả ngắn</Label><textarea name="excerpt" value={fields.excerpt} onChange={(event) => updateField("excerpt", event.target.value)} maxLength={500} rows={3} placeholder="Tóm tắt nội dung hiển thị trên danh sách và kết quả tìm kiếm" className="w-full rounded-[6px] border border-line px-3 py-2 text-sm outline-none focus:border-sky" /></label>
          </div>
          <div className="rounded-[8px] border border-line bg-paper p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-inkSoft">Ảnh đại diện</div>
            {fields.cover_url ? <div className="relative mt-2 aspect-[16/9] overflow-hidden rounded-[6px] bg-white"><Image src={fields.cover_url} alt="Ảnh cover bài viết" fill sizes="250px" unoptimized={shouldBypassImageOptimization(fields.cover_url)} className="object-cover" /></div> : <div className="mt-2 grid aspect-[16/9] place-items-center rounded-[6px] border border-dashed border-lineStrong text-xs text-inkSoft">Chưa chọn ảnh cover</div>}
            <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => { setPickerTarget("cover"); setPickerOpen(true); }} className="rounded-[5px] border border-lineStrong bg-white px-2.5 py-1.5 text-xs font-bold text-chamDeep">Chọn từ thư viện</button><button type="button" onClick={() => { setPickerTarget("cover"); imageInputRef.current?.click(); }} disabled={busy} className="rounded-[5px] bg-chamDeep px-2.5 py-1.5 text-xs font-bold text-white">Tải ảnh mới</button></div>
            <input type="hidden" name="coverUrl" value={fields.cover_url} />
          </div>
        </div>

        <section className="overflow-hidden rounded-[8px] border border-line">
          <div className="flex flex-wrap items-center gap-1 border-b border-line bg-paper p-2">
            <ToolbarButton label="H1" title="Tiêu đề cấp 1" onClick={() => command("formatBlock", "<h1>")} />
            <ToolbarButton label="H2" title="Tiêu đề cấp 2" onClick={() => command("formatBlock", "<h2>")} />
            <ToolbarButton label="H3" title="Tiêu đề cấp 3" onClick={() => command("formatBlock", "<h3>")} />
            <ToolbarButton label="H4" title="Tiêu đề cấp 4" onClick={() => command("formatBlock", "<h4>")} />
            <span className="mx-1 h-6 border-l border-lineStrong" />
            <ToolbarButton label="B" title="In đậm" onClick={() => command("bold")} strong />
            <ToolbarButton label="I" title="In nghiêng" onClick={() => command("italic")} italic />
            <ToolbarButton label="U" title="Gạch chân" onClick={() => command("underline")} underline />
            <ToolbarButton label="S" title="Gạch ngang" onClick={() => command("strikeThrough")} />
            <span className="mx-1 h-6 border-l border-lineStrong" />
            <ToolbarButton label="• Danh sách" title="Danh sách dấu chấm" onClick={() => command("insertUnorderedList")} />
            <ToolbarButton label="1. Danh sách" title="Danh sách đánh số" onClick={() => command("insertOrderedList")} />
            <ToolbarButton label="Trích dẫn" title="Trích dẫn" onClick={() => command("formatBlock", "<blockquote>")} />
            <ToolbarButton label="Liên kết" title="Chèn liên kết" onClick={insertLink} />
            <ToolbarButton label="Bảng" title="Chèn bảng" onClick={insertTable} />
            <ToolbarButton label="Chèn ảnh" title="Chèn ảnh từ thư viện" onClick={() => { saveSelection(); setPickerTarget("body"); setPickerOpen(true); }} />
            <ToolbarButton label="Tải ảnh" title="Tải ảnh lên Cloudinary" onClick={() => { saveSelection(); setPickerTarget("body"); imageInputRef.current?.click(); }} />
            <ToolbarButton label="↶" title="Hoàn tác" onClick={() => command("undo")} />
            <ToolbarButton label="↷" title="Làm lại" onClick={() => command("redo")} />
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 text-[11px] text-inkSoft"><span>Chọn một đoạn văn bản rồi dùng thanh công cụ. Ảnh sẽ được chèn tại vị trí con trỏ.</span><span>{fields.content.replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length} từ</span></div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={(event) => updateField("content", event.currentTarget.innerHTML)}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onBlur={() => { if (editorRef.current) updateField("content", editorRef.current.innerHTML); }}
            dangerouslySetInnerHTML={{ __html: fields.content }}
            className="news-editor-content min-h-[420px] px-5 py-4 text-[15px] leading-7 text-inkMid outline-none"
          />
          <input type="hidden" name="content" value={fields.content} />
        </section>

        <div className="grid gap-3 lg:grid-cols-2">
          <details className="rounded-[8px] border border-line bg-paper p-4" open>
            <summary className="cursor-pointer text-sm font-bold text-chamDeep">SEO & kết quả tìm kiếm</summary>
            <div className="mt-4 grid gap-3">
              <Field label="SEO title" name="meta_title" value={fields.meta_title} onChange={updateField} maxLength={70} placeholder="Để trống để dùng tiêu đề bài viết" />
              <label className="grid gap-1"><Label hint={`${fields.meta_description.length}/180`}>Meta description</Label><textarea name="meta_description" value={fields.meta_description} onChange={(event) => updateField("meta_description", event.target.value)} maxLength={180} rows={3} className="w-full rounded-[6px] border border-line px-3 py-2 text-sm outline-none focus:border-sky" placeholder="Mô tả ngắn cho trang kết quả tìm kiếm" /></label>
              <div className="grid gap-3 sm:grid-cols-2"><Field label="Từ khóa chính" name="focus_keyword" value={fields.focus_keyword} onChange={updateField} maxLength={100} placeholder="Ví dụ: hỗ trợ trẻ em" /><Field label="Canonical URL" name="canonical_url" type="url" value={fields.canonical_url} onChange={updateField} placeholder="Tùy chọn, URL HTTPS chuẩn" /></div>
              <div className="rounded-[6px] border border-line bg-white p-3"><div className="truncate text-sm text-[#1a0dab]">{metaTitle || "Tiêu đề bài viết"}</div><div className="truncate text-xs text-[#188038]">thiennguyen.com.vn/news/{fields.slug || "duong-dan-bai-viet"}</div><div className="mt-1 line-clamp-2 text-xs leading-5 text-inkMid">{metaDescription || "Mô tả bài viết sẽ hiển thị ở đây sau khi được nhập."}</div></div>
            </div>
          </details>
          <div className="grid content-start gap-3 rounded-[8px] border border-line bg-paper p-4">
            <div className="text-sm font-bold text-chamDeep">Xuất bản</div>
            <label className="grid gap-1"><Label>Trạng thái</Label><select name="status" value={fields.status} onChange={(event) => updateField("status", event.target.value)} className="rounded-[6px] border border-line bg-white px-3 py-2 text-sm"><option value="draft">Bản nháp</option><option value="published">Xuất bản công khai</option><option value="archived">Lưu trữ</option></select></label>
            <Field label="Thẻ bài viết" name="tags" value={fields.tags} onChange={updateField} placeholder="Tin tức, cộng đồng, minh bạch" />
            <p className="text-xs leading-5 text-inkSoft">Có thể nhập nhiều thẻ, cách nhau bằng dấu phẩy. Bài nháp và bài lưu trữ không xuất hiện công khai.</p>
            {message ? <p role="status" className={`rounded-[6px] p-3 text-xs ${message.ok ? "bg-lua/10 text-lua" : "bg-son/10 text-son"}`}>{message.text}</p> : null}
            <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy} className="rounded-[6px] bg-son px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busy ? "Đang lưu…" : post ? "Lưu thay đổi" : "Tạo bài viết"}</button>{onDelete ? <button type="button" disabled={busy} onClick={handleDelete} className="rounded-[6px] border border-son/30 px-4 py-2.5 text-xs font-bold text-son disabled:opacity-50">Xóa bài viết</button> : null}</div>
          </div>
        </div>
      </form>

      <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void handleFileSelected(event.target.files?.[0])} />
      {pickerOpen ? <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setPickerOpen(false); }}>
        <div role="dialog" aria-modal="true" aria-label="Thư viện ảnh" className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-[12px] bg-white shadow-modal">
          <div className="flex items-center justify-between border-b border-line px-5 py-4"><div><h3 className="font-serif text-lg font-semibold text-chamDeep">Thư viện ảnh</h3><p className="mt-0.5 text-xs text-inkSoft">Ảnh nằm trong folder thiennguyen/news trên Cloudinary</p></div><button type="button" onClick={() => setPickerOpen(false)} className="rounded-full px-3 py-1 text-xl text-inkSoft hover:bg-paper" aria-label="Đóng">×</button></div>
          <div className="max-h-[calc(85vh-76px)] overflow-y-auto p-5">
            {assets.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{assets.map((asset) => <button type="button" key={asset.id} onClick={() => selectImage(asset)} className="overflow-hidden rounded-[8px] border border-line text-left transition hover:border-sky hover:shadow"><div className="relative aspect-square bg-paper"><Image src={asset.url} alt={asset.alt_text || asset.original_name} fill sizes="(max-width: 640px) 50vw, 25vw" unoptimized={shouldBypassImageOptimization(asset.url)} className="object-cover" /></div><span className="block truncate px-2 py-2 text-[11px] text-inkMid">{asset.original_name || asset.alt_text || "Ảnh"}</span></button>)}</div> : <div className="rounded-[8px] border border-dashed border-lineStrong p-10 text-center text-sm text-inkSoft">Thư viện chưa có ảnh. Dùng nút “Tải ảnh” để thêm ảnh.</div>}
            <button type="button" onClick={() => { setPickerOpen(false); imageInputRef.current?.click(); }} className="mt-4 rounded-[6px] bg-chamDeep px-4 py-2 text-xs font-bold text-white">＋ Tải ảnh lên</button>
          </div>
        </div>
      </div> : null}
    </>
  );
}

function ToolbarButton({ label, title, onClick, strong, italic, underline }: { label: string; title: string; onClick: () => void; strong?: boolean; italic?: boolean; underline?: boolean }) {
  return <button type="button" title={title} onMouseDown={(event) => event.preventDefault()} onClick={onClick} className={`rounded-[4px] border border-transparent px-2 py-1.5 text-xs text-inkMid transition hover:border-lineStrong hover:bg-white ${strong ? "font-black" : ""} ${italic ? "italic" : ""} ${underline ? "underline" : ""}`}>{label}</button>;
}

export function AdminNewsPanel({ posts, media, loadError }: { posts: NewsPost[]; media: NewsMediaAsset[]; loadError: string | null }) {
  const [openNew, setOpenNew] = useState(false);
  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-serif text-[21px] font-medium text-chamDeep">Quản lý bài viết</h1><p className="mt-1 text-sm text-inkMid">Soạn thảo nội dung, quản lý ảnh, tối ưu hiển thị tìm kiếm và xuất bản tin tức.</p></div><span className="rounded-full bg-paper px-3 py-1.5 text-xs font-bold text-inkMid">{posts.length} bài viết</span></div>
      {loadError ? <p className="mb-4 rounded-[8px] bg-nghe/10 p-3 text-sm text-ngheDeep">{loadError}</p> : null}
      <div className="mb-5 rounded-[10px] border border-son/30 bg-son/5 p-4"><button type="button" onClick={() => setOpenNew((open) => !open)} className="font-bold text-son">{openNew ? "− Đóng trình soạn thảo" : "＋ Tạo bài viết mới"}</button>{openNew ? <div className="mt-4"><NewsEditorForm media={media} action={createNewsPost} /></div> : null}</div>
      <div className="space-y-3">
        {posts.length === 0 ? <div className="rounded-[10px] border border-line bg-white p-8 text-center text-sm text-inkSoft">Chưa có bài viết nào.</div> : posts.map((post) => (
          <details key={post.id} className="rounded-[10px] border border-line bg-white p-4">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3"><div><h2 className="font-serif text-base font-semibold text-chamDeep">{post.title}</h2><p className="mt-1 text-xs text-inkSoft">/{post.slug} · {post.category} · {new Date(post.created_at).toLocaleDateString("vi-VN")}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${post.status === "published" ? "bg-lua/15 text-lua" : post.status === "archived" ? "bg-inkSoft/15 text-inkMid" : "bg-nghe/15 text-ngheDeep"}`}>{newsStatusLabel(post.status)}</span></summary>
            <div className="mt-4"><NewsEditorForm key={post.id} post={post} media={media} action={updateNewsPost.bind(null, post.id)} onDelete={async () => { const result = await deleteNewsPost(post.id); if (!result.ok) throw new Error(result.message); }} /></div>
          </details>
        ))}
      </div>
    </section>
  );
}
