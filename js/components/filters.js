/** Category chips + text search for listing pages. */
import { esc, categoryLabel, debounce } from '../lib/dom.js';

/**
 * @param {object} opts
 * @param {HTMLElement} opts.chips     container for category chips
 * @param {HTMLInputElement} [opts.search] optional search input
 * @param {HTMLElement} [opts.note]    optional "N results" element
 * @param {string} opts.allLabel
 * @param {(item) => string} opts.searchText
 * @param {(items: any[]) => void} opts.onChange
 */
export function createFilter({ chips, search, note, allLabel = 'All', searchText, onChange }) {
  let items = [];
  let active = new URLSearchParams(location.search).get('category') || 'all';
  let query = '';

  function categories() {
    const counts = new Map();
    items.forEach((it) => {
      const c = (it.category || '').toLowerCase();
      if (c) counts.set(c, (counts.get(c) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }

  function renderChips() {
    const cats = categories();
    if (active !== 'all' && !cats.some(([c]) => c === active)) active = 'all';
    chips.hidden = cats.length < 2;
    chips.innerHTML = [
      `<button type="button" class="chip${active === 'all' ? ' is-active' : ''}" data-cat="all" aria-pressed="${active === 'all'}">${esc(allLabel)} <span class="chip__count">${items.length}</span></button>`,
      ...cats.map(([c, n]) => `<button type="button" class="chip${active === c ? ' is-active' : ''}" data-cat="${esc(c)}" aria-pressed="${active === c}">${esc(categoryLabel(c))} <span class="chip__count">${n}</span></button>`),
    ].join('');
  }

  function apply() {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((it) =>
      (active === 'all' || (it.category || '').toLowerCase() === active)
      && (!q || searchText(it).toLowerCase().includes(q)));
    if (note) {
      note.hidden = !q && active === 'all';
      note.textContent = `Showing ${filtered.length} of ${items.length}`;
    }
    onChange(filtered);
  }

  chips.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    active = btn.dataset.cat;
    const url = new URL(location.href);
    if (active === 'all') url.searchParams.delete('category'); else url.searchParams.set('category', active);
    history.replaceState(null, '', url);
    renderChips();
    apply();
  });

  search?.addEventListener('input', debounce(() => { query = search.value; apply(); }, 150));

  return {
    setItems(list) {
      items = list;
      renderChips();
      apply();
    },
  };
}
