const search = document.querySelector('[data-filter="search"]');
const category = document.querySelector('[data-filter="category"]');
const layer = document.querySelector('[data-filter="layer"]');
const organization = document.querySelector('[data-filter="organization"]');
const cards = [...document.querySelectorAll('[data-project-card]')];
const count = document.querySelector('[data-result-count]');
const empty = document.querySelector('[data-empty-state]');
const filterSummary = document.querySelector('[data-filter-summary]');
const filterChips = document.querySelector('[data-filter-chips]');
const controls = { search, organization, category, layer };

function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase('ko-KR').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function setControlsFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (search) search.value = params.get('q') || '';
  if (category) category.value = params.get('category') || '';
  if (layer) layer.value = params.get('layer') || '';
  if (organization) organization.value = params.get('organization') || '';
}

function updateUrl(mode = 'replace') {
  const params = new URLSearchParams();
  const term = search?.value.trim();
  if (term) params.set('q', term);
  if (category?.value) params.set('category', category.value);
  if (layer?.value) params.set('layer', layer.value);
  if (organization?.value) params.set('organization', organization.value);
  const next = `${window.location.pathname}${params.size ? `?${params}` : ''}`;
  window.history[mode === 'push' ? 'pushState' : 'replaceState']({}, '', next);
  try { sessionStorage.setItem('sdv.catalog.query', params.size ? `?${params}` : ''); } catch { /* Storage is optional. */ }
}

function updateFilterSummary() {
  if (!filterChips) return;
  filterChips.replaceChildren();
  const labels = { search: '검색', organization: '기관', category: '분류', layer: '계층' };
  for (const [key, control] of Object.entries(controls)) {
    if (!control?.value.trim()) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-chip';
    const label = key === 'search' ? control.value.trim() : control.selectedOptions[0].textContent;
    button.textContent = `${labels[key]}: ${label} ×`;
    button.setAttribute('aria-label', `${labels[key]} ${label} 조건 해제`);
    button.addEventListener('click', () => {
      control.value = '';
      applyFilters({ mode: 'push' });
      control.focus();
    });
    filterChips.append(button);
  }
  if (filterSummary) filterSummary.hidden = !filterChips.childElementCount;
}

function applyFilters({ syncUrl = true, mode = 'replace' } = {}) {
  if (!cards.length) return;
  const term = normalize(search?.value);
  const selectedCategory = normalize(category?.value);
  const selectedLayer = normalize(layer?.value);
  const selectedOrganization = organization?.value || '';
  const terms = term.split(' ').filter(Boolean);
  let visible = 0;

  cards.forEach((card) => {
    const haystack = normalize(card.dataset.search);
    const categories = normalize(card.dataset.categories);
    const layers = normalize(card.dataset.layers);
    const matches = terms.every((word) => haystack.includes(word))
      && (!selectedCategory || categories.split('|').includes(selectedCategory))
      && (!selectedLayer || layers.split('|').includes(selectedLayer))
      && (!selectedOrganization || card.dataset.organization === selectedOrganization);

    card.hidden = !matches;
    if (matches) visible += 1;
  });

  const filtered = term || selectedCategory || selectedLayer || selectedOrganization;
  if (count) count.textContent = filtered ? `전체 ${cards.length}개 중 ${visible}개` : `${visible}개 프로젝트`;
  if (empty) empty.style.display = visible ? 'none' : 'block';
  updateFilterSummary();
  if (syncUrl) updateUrl(mode);
}

search?.addEventListener('input', () => applyFilters({ mode: 'replace' }));
category?.addEventListener('change', () => applyFilters({ mode: 'push' }));
layer?.addEventListener('change', () => applyFilters({ mode: 'push' }));
organization?.addEventListener('change', () => applyFilters({ mode: 'push' }));

document.querySelectorAll('[data-clear-filters]').forEach((button) => button.addEventListener('click', () => {
  if (search) search.value = '';
  if (category) category.value = '';
  if (layer) layer.value = '';
  if (organization) organization.value = '';
  applyFilters({ mode: 'push' });
  search?.focus();
}));

document.addEventListener('keydown', (event) => {
  const editing = document.activeElement?.matches('input, textarea, select, [contenteditable="true"]');
  if (event.key === '/' && search && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) {
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
if (cards.length) updateUrl();

try {
  const query = sessionStorage.getItem('sdv.catalog.query');
  if (query?.startsWith('?')) document.querySelectorAll('[data-project-list]').forEach((link) => {
    link.href = `${link.getAttribute('href')}${query}`;
  });
} catch { /* The plain project-list link remains usable. */ }

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
  activateTab(tabs.some((tab) => tab.dataset.tab === requested) ? requested : 'overview');
}

window.addEventListener('hashchange', activateFromHash);
activateFromHash();
