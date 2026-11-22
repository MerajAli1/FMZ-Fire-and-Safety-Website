import '../site.js';
import { useData, publishedSorted } from '../lib/store.js';
import { $ } from '../lib/dom.js';
import { galleryItem, emptyState } from '../components/cards.js';
import { createFilter } from '../components/filters.js';
import { openLightbox } from '../components/lightbox.js';

const grid = $('#gallery-grid');
let visible = [];

const filter = createFilter({
  chips: $('#gallery-filters'),
  allLabel: 'All photos',
  searchText: (g) => `${g.caption} ${g.category}`,
  onChange(items) {
    visible = items;
    grid.innerHTML = items.length
      ? items.map(galleryItem).join('')
      : emptyState('No photos yet', 'Photos from our trainings and projects will appear here soon.', 'image');
  },
});

useData({ gallery: 'col:gallery' }, ({ gallery }, meta) => {
  if (!gallery && meta.error) {
    grid.innerHTML = emptyState('Could not load the gallery', 'Please check your connection and refresh the page.', 'alert');
    return;
  }
  filter.setItems(publishedSorted(gallery || []).filter((g) => g.imageUrl));
});

grid.addEventListener('click', (e) => {
  const btn = e.target.closest('.gallery-item');
  if (btn) openLightbox(visible, Number(btn.dataset.index));
});
