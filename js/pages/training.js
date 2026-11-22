import { observeReveals } from '../site.js';
import { useData } from '../lib/store.js';
import { $ } from '../lib/dom.js';
import { resolveTrainings } from '../lib/content.js';
import { programCard } from '../components/cards.js';

const grid = $('#training-grid');

useData({ trainings: 'col:trainings' }, ({ trainings }) => {
  grid.innerHTML = resolveTrainings(trainings).map(programCard).join('');
  observeReveals(grid);
});
