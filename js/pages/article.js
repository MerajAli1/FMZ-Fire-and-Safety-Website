import { observeReveals } from '../site.js';
import { useData } from '../lib/store.js';
import { $, esc, icon, imgUrl, categoryLabel } from '../lib/dom.js';
import { publishedPosts } from '../lib/content.js';
import { renderMarkdown, markdownToText, readingMinutes } from '../lib/markdown.js';
import { setPageSeo, absoluteUrl } from '../lib/seo.js';
import { postCard, postHref, formatDate } from '../components/cards.js';
import { SITE_URL } from '../config.js';

const slug = new URLSearchParams(location.search).get('slug') || '';
const root = $('#article');
let rendered = '';

function notFound() {
  setPageSeo({ title: 'Article not found | FMZ Fire & Safety Engineering', noindex: true });
  $('#article-title').textContent = 'Article not found';
  $('#article-meta').textContent = '';
  $('#article-body').innerHTML = `<p>Sorry, this article doesn't exist or has been removed.</p><p><a class="btn" href="blog.html">Browse all articles</a></p>`;
  $('#article-cover').hidden = true;
  root.removeAttribute('aria-busy');
}

function render(post, all) {
  const key = JSON.stringify(post);
  if (key === rendered) return;
  rendered = key;

  const date = post.date || post.createdAt;
  const description = post.metaDescription || post.excerpt || markdownToText(post.content).slice(0, 160);
  const path = postHref(post);

  setPageSeo({
    title: `${post.metaTitle || post.title} | FMZ Fire & Safety`,
    description,
    path,
    image: post.coverImage || 'assets/img/og-image.jpg',
    type: 'article',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description,
      image: post.coverImage ? [absoluteUrl(post.coverImage)] : undefined,
      datePublished: new Date(date).toISOString(),
      dateModified: new Date(post.updatedAt || date).toISOString(),
      author: { '@type': 'Organization', name: post.author || 'FMZ Fire & Safety Engineering' },
      publisher: { '@type': 'Organization', name: 'FMZ Fire & Safety Engineering', logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/img/icon-512.png` } },
      mainEntityOfPage: absoluteUrl(path),
    },
  });

  $('#crumb-title').textContent = post.title;
  $('#article-category').textContent = post.category ? categoryLabel(post.category) : 'Article';
  $('#article-title').textContent = post.title;
  $('#article-meta').innerHTML = [
    `${icon('calendar')} ${esc(formatDate(date))}`,
    `${icon('clock')} ${readingMinutes(post.content)} min read`,
    post.author ? `${icon('users')} ${esc(post.author)}` : '',
  ].filter(Boolean).map((x) => `<span>${x}</span>`).join('');

  const cover = $('#article-cover');
  cover.hidden = !post.coverImage;
  if (post.coverImage) cover.innerHTML = `<img src="${esc(imgUrl(post.coverImage, 1400))}" alt="${esc(post.title)}" fetchpriority="high">`;

  $('#article-body').innerHTML = renderMarkdown(post.content);
  const tags = (post.tags || []).filter(Boolean);
  $('#article-tags').innerHTML = tags.map((t) => `<span class="tag">#${esc(t)}</span>`).join('');

  // Share links
  const url = encodeURIComponent(absoluteUrl(path));
  const text = encodeURIComponent(post.title);
  $('#share-whatsapp').href = `https://wa.me/?text=${text}%20${url}`;
  $('#share-facebook').href = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
  $('#share-linkedin').href = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;

  // Related: same category first, then newest
  const others = all.filter((p) => p.slug !== post.slug);
  const related = [...others.filter((p) => p.category === post.category), ...others.filter((p) => p.category !== post.category)].slice(0, 3);
  $('#related-section').hidden = related.length === 0;
  $('#related-grid').innerHTML = related.map(postCard).join('');
  observeReveals($('#related-grid'));
  root.removeAttribute('aria-busy');
}

$('#share-copy')?.addEventListener('click', async (e) => {
  try {
    await navigator.clipboard.writeText(location.href);
    e.currentTarget.querySelector('span').textContent = 'Link copied!';
  } catch { /* ignore */ }
});

useData({ posts: 'col:posts' }, ({ posts }, meta) => {
  if (!posts && meta.error) { notFound(); return; }
  const all = publishedPosts(posts);
  const post = all.find((p) => p.slug === slug || p.id === slug);
  if (post) render(post, all); else notFound();
});
