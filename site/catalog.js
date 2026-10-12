const search = document.querySelector('[data-filter="search"]');
const category = document.querySelector('[data-filter="category"]');
const layer = document.querySelector('[data-filter="layer"]');
const cards = [...document.querySelectorAll('[data-project-card]')];
const count = document.querySelector('[data-result-count]');
const empty = document.querySelector('[data-empty-state]');

function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase('ko-KR');
}

function setControlsFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (search) search.value = params.get('q') || '';
  if (category) category.value = params.get('category') || '';
  if (layer) layer.value = params.get('layer') || '';
}

function updateUrl(mode = 'replace') {
  const params = new URLSearchParams();
  const term = search?.value.trim();
  if (term) params.set('q', term);
  if (category?.value) params.set('category', category.value);
  if (layer?.value) params.set('layer', layer.value);
  const next = `${window.location.pathname}${params.size ? `?${params}` : ''}`;
  window.history[mode === 'push' ? 'pushState' : 'replaceState']({}, '', next);
}

function applyFilters({ syncUrl = true, mode = 'replace' } = {}) {
  if (!cards.length) return;
  const term = normalize(search?.value);
  const selectedCategory = normalize(category?.value);
  const selectedLayer = normalize(layer?.value);
  let visible = 0;

  cards.forEach((card) => {
    const haystack = normalize(card.dataset.search);
    const categories = normalize(card.dataset.categories);
    const layers = normalize(card.dataset.layers);
    const matches = (!term || haystack.includes(term))
      && (!selectedCategory || categories.split('|').includes(selectedCategory))
      && (!selectedLayer || layers.split('|').includes(selectedLayer));

    card.hidden = !matches;
    if (matches) visible += 1;
  });

  if (count) count.textContent = `${visible}개 프로젝트`;
  if (empty) empty.style.display = visible ? 'none' : 'block';
  if (syncUrl) updateUrl(mode);
}

search?.addEventListener('input', () => applyFilters({ mode: 'replace' }));
category?.addEventListener('change', () => applyFilters({ mode: 'push' }));
layer?.addEventListener('change', () => applyFilters({ mode: 'push' }));

document.querySelector('[data-clear-filters]')?.addEventListener('click', () => {
  if (search) search.value = '';
  if (category) category.value = '';
  if (layer) layer.value = '';
  applyFilters({ mode: 'push' });
  search?.focus();
});

document.addEventListener('keydown', (event) => {
  if (event.key === '/' && search && document.activeElement !== search) {
    event.preventDefault();
    search.focus();
  }
});

window.addEventListener('popstate', () => {
  setControlsFromUrl();
  applyFilters({ syncUrl: false });
});

setControlsFromUrl();
applyFilters({ syncUrl: false });

const tabList = document.querySelector('[data-project-tabs]');
const tabs = [...document.querySelectorAll('[data-tab]')];
const panels = [...document.querySelectorAll('[data-tab-panel]')];

function activateTab(name, { focus = false, updateHash = false } = {}) {
  if (!tabs.length || !tabs.some((tab) => tab.dataset.tab === name)) return;

  tabs.forEach((tab) => {
    const selected = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  });
  panels.forEach((panel) => { panel.hidden = panel.dataset.tabPanel !== name; });

  if (updateHash) window.history.pushState({}, '', `#${name}`);
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => activateTab(tab.dataset.tab, { updateHash: true }));
});

tabList?.addEventListener('keydown', (event) => {
  const current = tabs.indexOf(document.activeElement);
  if (current < 0) return;
  let next = current;
  if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
  else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = tabs.length - 1;
  else return;
  event.preventDefault();
  activateTab(tabs[next].dataset.tab, { focus: true, updateHash: true });
});

function activateFromHash() {
  const requested = window.location.hash.slice(1);
  activateTab(requested || 'overview');
}

window.addEventListener('hashchange', activateFromHash);
activateFromHash();
