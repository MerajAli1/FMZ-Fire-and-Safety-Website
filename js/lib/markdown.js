/**
 * Minimal, safe Markdown → HTML renderer for blog articles.
 * Everything is HTML-escaped first, so article text can never inject markup.
 *
 * Supported: ## / ### / #### headings, paragraphs, **bold**, *italic*, `code`,
 * [links](url), ![images](url), - / 1. lists, > quotes, --- rules.
 */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

function safeHref(url) {
  const u = url.trim();
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return ''; // javascript:, data:, …
  return u;
}

/** Optimise Cloudinary images inside articles. */
function imgSrc(url, width = 1200) {
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/') || /\/upload\/[^/]*w_\d+/.test(url)) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${width}/`);
}

export const headingId = (text) => String(text).toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function inline(raw) {
  let s = esc(raw);
  // images ![alt](url)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => {
    const href = safeHref(url);
    return href ? `<img src="${imgSrc(href)}" alt="${alt}" loading="lazy" decoding="async">` : alt;
  });
  // links [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
    const href = safeHref(url);
    if (!href) return text;
    const external = /^https?:/i.test(href) && !/fmzfiresafety\.com/i.test(href);
    return `<a href="${href}"${external ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`;
  });
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
  return s;
}

export function renderMarkdown(source) {
  const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [];
  const flush = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`);
    para = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const t = line.trim();
    let m;
    if (!t) { flush(); continue; }

    if ((m = t.match(/^(#{1,4})\s+(.+)$/))) {
      flush();
      const level = Math.min(4, Math.max(2, m[1].length === 1 ? 2 : m[1].length));
      const html = inline(m[2]);
      out.push(`<h${level} id="${headingId(html)}">${html}</h${level}>`);
    } else if (/^(-{3,}|\*{3,})$/.test(t)) {
      flush();
      out.push('<hr>');
    } else if ((m = t.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/))) {
      flush();
      const href = safeHref(m[2]);
      if (href) out.push(`<figure><img src="${imgSrc(href)}" alt="${esc(m[1])}" loading="lazy" decoding="async">${m[1] ? `<figcaption>${esc(m[1])}</figcaption>` : ''}</figure>`);
    } else if (/^>\s?/.test(t)) {
      flush();
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) { quote.push(lines[i].trim().replace(/^>\s?/, '')); i += 1; }
      i -= 1;
      out.push(`<blockquote><p>${quote.map(inline).join('<br>')}</p></blockquote>`);
    } else if (/^[-*•]\s+/.test(t) || /^\d+[.)]\s+/.test(t)) {
      flush();
      const ordered = /^\d/.test(t);
      const re = ordered ? /^\d+[.)]\s+/ : /^[-*•]\s+/;
      const items = [];
      while (i < lines.length && re.test(lines[i].trim())) { items.push(lines[i].trim().replace(re, '')); i += 1; }
      i -= 1;
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${tag}>`);
    } else {
      para.push(t);
    }
  }
  flush();
  return out.join('\n');
}

/** Plain text (for excerpts, meta descriptions and reading time). */
export function markdownToText(source) {
  return String(source || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const readingMinutes = (source) => Math.max(1, Math.round(markdownToText(source).split(' ').length / 200));
