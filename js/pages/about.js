import { observeReveals } from '../site.js';
import { useData, publishedSorted } from '../lib/store.js';
import { $ } from '../lib/dom.js';
import { teamCard } from '../components/cards.js';

const section = $('#team-section');
const grid = $('#team-grid');

useData({ team: 'col:team' }, ({ team }) => {
  const list = publishedSorted(team || []);
  section.hidden = list.length === 0;
  grid.innerHTML = list.map(teamCard).join('');
  observeReveals(grid);
});
