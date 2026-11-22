import { observeReveals, getSettings } from '../site.js';
import { useData, publishedSorted } from '../lib/store.js';
import { $ } from '../lib/dom.js';
import { productCard, emptyState } from '../components/cards.js';
import { createFilter } from '../components/filters.js';
import { openProduct } from '../components/product-modal.js';

const grid = $('#equipment-grid');
let all = [];

const filter = createFilter({
  chips: $('#equipment-filters'),
  search: $('#equipment-search'),
  note: $('#equipment-note'),
  allLabel: 'All equipment',
  searchText: (it) => `${it.title} ${it.description} ${it.category}`,
  onChange(items) {
    grid.innerHTML = items.length
      ? items.map(productCard).join('')
      : emptyState('No equipment found', all.length ? 'Try a different search or category.' : 'Our catalogue is being updated — contact us for availability.', 'search');
    observeReveals(grid);
  },
});

useData({ items: 'col:equipments' }, ({ items }, meta) => {
  if (!items && meta.error) {
    grid.innerHTML = emptyState('Could not load equipment', 'Please check your connection and refresh the page.', 'alert');
    return;
  }
  all = publishedSorted(items || []);
  filter.setItems(all);
});

grid.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-product]');
  if (!btn) return;
  const item = all.find((x) => x.id === btn.dataset.product);
  if (item) openProduct(item, String(getSettings().whatsapp || '').replace(/\D/g, ''));
});
