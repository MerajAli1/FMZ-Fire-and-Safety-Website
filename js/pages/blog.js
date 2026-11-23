import { observeReveals } from '../site.js';
import { useData } from '../lib/store.js';
import { $ } from '../lib/dom.js';
import { postCard, emptyState } from '../components/cards.js';
import { createFilter } from '../components/filters.js';
import { publishedPosts } from '../lib/content.js';

const grid = $('#blog-grid');

const filter = createFilter({
  chips: $('#blog-filters'),
  search: $('#blog-search'),
  note: $('#blog-note'),
  allLabel: 'All articles',
  searchText: (p) => `${p.title} ${p.excerpt} ${p.category} ${(p.tags || []).join(' ')}`,
  onChange(items) {
    grid.innerHTML = items.length
      ? items.map(postCard).join('')
      : emptyState('No articles yet', 'Fire-safety guides and tips are coming soon. Check back shortly!', 'message');
    observeReveals(grid);
  },
});

useData({ posts: 'col:posts' }, ({ posts }, meta) => {
  if (!posts && meta.error) {
    grid.innerHTML = emptyState('Could not load articles', 'Please check your connection and refresh the page.', 'alert');
    return;
  }
  filter.setItems(publishedPosts(posts));
});
