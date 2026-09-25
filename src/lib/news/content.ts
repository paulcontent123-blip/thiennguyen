const ALLOWED_TAGS = new Set([
  "p", "br", "h1", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "blockquote",
  "ul", "ol", "li", "a", "img", "figure", "figcaption", "hr", "table", "thead", "tbody",
  "tr", "th", "td", "pre", "code",
]);

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function safeUrl(value: string, image = false) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || (!image && ["http:", "mailto:"].includes(url.protocol))) return url.toString();
  } catch {
    if (!image && value.startsWith("#") && /^#[a-zA-Z0-9_-]+$/.test(value)) return value;
  }
  return null;
}

function textContent(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
}

function headingId(value: string, index: number) {
  const slug = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "muc"}-${index + 1}`;
}

export function sanitizeNewsHtml(input: string) {
  const withoutDangerousBlocks = input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|svg|math|template)[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|svg|math|template)[^>]*\/?>/gi, "");
  const html = withoutDangerousBlocks.replace(/<\/?([a-zA-Z0-9]+)(\s[^<>]*?)?\s*\/?>/g, (raw, rawName: string, rawAttrs = "") => {
    const tag = rawName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    const closing = /^<\//.test(raw);
    if (closing) return ["br", "hr", "img"].includes(tag) ? "" : `</${tag}>`;
    if (tag === "br" || tag === "hr") return `<${tag}>`;
    if (tag === "a") {
      const hrefMatch = rawAttrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const href = safeUrl(hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3] ?? "");
      return href ? `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">` : "<span>";
    }
    if (tag === "img") {
      const srcMatch = rawAttrs.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const altMatch = rawAttrs.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const src = safeUrl(srcMatch?.[1] ?? srcMatch?.[2] ?? srcMatch?.[3] ?? "", true);
      if (!src) return "";
      const alt = altMatch?.[1] ?? altMatch?.[2] ?? altMatch?.[3] ?? "";
      return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" loading="lazy">`;
    }
    if (["td", "th"].includes(tag)) {
      const spanMatch = rawAttrs.match(/\bcolspan\s*=\s*["']?(\d+)/i);
      const span = spanMatch ? Math.min(10, Math.max(1, Number(spanMatch[1]))) : 1;
      return `<${tag} colspan="${span}">`;
    }
    return `<${tag}>`;
  });
  let headingIndex = 0;
  return html.replace(/<(h2|h3|h4)>([\s\S]*?)<\/\1>/gi, (_match, rawTag: string, inner: string) => {
    const tag = rawTag.toLowerCase();
    const id = headingId(textContent(inner), headingIndex++);
    return `<${tag} id="${id}" data-news-heading="${id}">${inner}</${tag}>`;
  }).trim();
}

export function extractNewsHeadings(html: string) {
  const headings: { id: string; text: string; level: number }[] = [];
  const regex = /<(h2|h3|h4)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  for (const match of Array.from(html.matchAll(regex))) {
    const tag = match[1].toLowerCase();
    const id = match[2].match(/data-news-heading="([^"]+)"/)?.[1];
    const text = textContent(match[3]);
    if (id && text) headings.push({ id, text, level: Number(tag.slice(1)) });
  }
  return headings;
}
