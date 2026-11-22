import { observeReveals } from '../site.js';
import { useData } from '../lib/store.js';
import { $ } from '../lib/dom.js';
import { mergeClients } from '../lib/content.js';
import { clientCard, emptyState } from '../components/cards.js';
import { createFilter } from '../components/filters.js';

const grid = $('#clients-grid');

const filter = createFilter({
  chips: $('#client-filters'),
  search: $('#client-search'),
  note: $('#client-note'),
  allLabel: 'All industries',
  searchText: (c) => `${c.name} ${c.location} ${c.category}`,
  onChange(items) {
    grid.innerHTML = items.length
      ? items.map((c) => clientCard(c)).join('')
      : emptyState('No clients match', 'Try a different search or industry.', 'search');
    observeReveals(grid);
  },
});

useData({ settings: 'doc:settings/site', clients: 'col:clients' }, ({ settings, clients }) => {
  filter.setItems(mergeClients(clients, settings));
});
