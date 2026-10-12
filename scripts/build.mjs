import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { parse as parseYaml } from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const checkOnly = process.argv.includes('--check');
const configuredBase = (process.env.BASE_PATH || '').trim().replace(/^\/+|\/+$/g, '');
const basePath = configuredBase ? `/${configuredBase}` : '';

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const [projectSchema, organizationSchema] = await Promise.all([
  readJson('schemas/project.schema.json'),
  readJson('schemas/organization.schema.json'),
]);
const validateProject = ajv.compile(projectSchema);
const validateOrganization = ajv.compile(organizationSchema);

const organizations = await loadOrganizations();
const organizationMap = new Map(organizations.map((org) => [org.slug, org]));
const projects = await loadProjects();

validateRelations();

if (checkOnly) {
  console.log(`Validated ${organizations.length} organizations and ${projects.length} projects.`);
  process.exit(0);
}

await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(dist, { recursive: true });
await Promise.all([
  fs.copyFile(path.join(root, 'site/styles.css'), path.join(dist, 'styles.css')),
  fs.copyFile(path.join(root, 'site/catalog.js'), path.join(dist, 'catalog.js')),
  fs.copyFile(path.join(root, 'site/favicon.svg'), path.join(dist, 'favicon.svg')),
  fs.cp(path.join(root, 'site/assets'), path.join(dist, 'assets'), { recursive: true }),
]);

await Promise.all([
  writePage('index.html', renderCatalog()),
  writePage('organizations/index.html', renderOrganizations()),
  writePage('contribute/index.html', renderContribute()),
  ...projects.map((project) => writePage(`projects/${project.slug}/index.html`, renderProject(project))),
  fs.writeFile(path.join(dist, 'catalog.json'), JSON.stringify({ organizations, projects: projects.map(({ markdown, html, ...p }) => p) }, null, 2)),
]);

console.log(`Built ${projects.length + 3} pages into ${dist}`);

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(root, relativePath), 'utf8'));
}

async function listFiles(dir, fileName) {
  const found = [];
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name === fileName || (fileName === '*.yaml' && entry.name.endsWith('.yaml'))) found.push(full);
    }
  }
  await walk(dir);
  return found.sort();
}

async function loadOrganizations() {
  const files = await listFiles(path.join(root, 'catalog/organizations'), '*.yaml');
  const seen = new Set();
  const result = [];
  for (const file of files) {
    const data = parseYaml(await fs.readFile(file, 'utf8'));
    if (!validateOrganization(data)) failValidation(file, validateOrganization.errors);
    if (data.logo) await fs.access(path.join(root, 'site/assets/organizations', data.logo));
    if (seen.has(data.slug)) throw new Error(`Duplicate organization slug: ${data.slug}`);
    seen.add(data.slug);
    result.push(data);
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
}

async function loadProjects() {
  const files = await listFiles(path.join(root, 'catalog/projects'), 'project.yaml');
  const seen = new Set();
  const result = [];
  for (const file of files) {
    const data = parseYaml(await fs.readFile(file, 'utf8'));
    if (!validateProject(data)) failValidation(file, validateProject.errors);
    if (seen.has(data.slug)) throw new Error(`Duplicate project slug: ${data.slug}`);
    seen.add(data.slug);
    const readme = path.join(path.dirname(file), 'README.md');
    const markdown = await fs.readFile(readme, 'utf8').catch(() => {
      throw new Error(`Missing README.md next to ${file}`);
    });
    const rawHtml = await marked.parse(markdown, { gfm: true });
    const html = sanitizeHtml(rawHtml, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
      allowedAttributes: {
        a: ['href', 'name', 'target', 'rel'],
        img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
        code: ['class'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      transformTags: {
        a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
        img: sanitizeHtml.simpleTransform('img', { loading: 'lazy' }),
      },
    });
    result.push({ ...data, markdown, html });
  }
  return result.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.name.localeCompare(b.name, 'ko-KR'));
}

function validateRelations() {
  const projectNames = new Set(projects.map((p) => p.name));
  for (const project of projects) {
    if (!organizationMap.has(project.organization)) {
      throw new Error(`${project.slug}: unknown organization '${project.organization}'`);
    }
    for (const relation of project.integrates_with || []) {
      if (!projectNames.has(relation) && !['Docker', 'Kubernetes'].includes(relation)) {
        console.warn(`${project.slug}: '${relation}' is treated as an external integration.`);
      }
    }
  }
}

function failValidation(file, errors) {
  const details = (errors || []).map((error) => `${error.instancePath || '/'} ${error.message}`).join('\n  - ');
  throw new Error(`Schema validation failed: ${file}\n  - ${details}`);
}

async function writePage(relativePath, contents) {
  const destination = path.join(dist, relativePath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, contents, 'utf8');
}

function url(value = '/') {
  const normalized = value.startsWith('/') ? value : `/${value}`;
  return `${basePath}${normalized}` || '/';
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function layout({ title, description, current, body }) {
  const fullTitle = title === '프로젝트' ? 'Open SDV Project DB' : `${title} · Open SDV Project DB`;
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#07345f">
  <title>${escapeHtml(fullTitle)}</title>
  <link rel="icon" type="image/svg+xml" href="${url('/favicon.svg')}">
  <link rel="stylesheet" href="${url('/styles.css')}">
</head>
<body>
  <a class="skip-link" href="#main">본문으로 건너뛰기</a>
  <div class="notice-bar">
    <div class="shell notice-inner"><span>Software-defined vehicle open source collaboration</span><a href="${url('/contribute/')}">프로젝트 등록 안내 →</a></div>
  </div>
  <header class="site-header">
    <nav class="nav" aria-label="주요 메뉴">
      <a class="brand" href="${url('/')}"><span class="brand-mark" aria-hidden="true">SDV</span><span class="brand-copy"><strong>Open SDV Project DB</strong><small>Collaborative registry</small></span></a>
      <div class="nav-links">
        <a href="${url('/')}" ${current === 'projects' ? 'aria-current="page"' : ''}>프로젝트</a>
        <a href="${url('/organizations/')}" ${current === 'organizations' ? 'aria-current="page"' : ''}>참여 기관</a>
        <a href="${url('/contribute/')}" ${current === 'contribute' ? 'aria-current="page"' : ''}>프로젝트 등록</a>
      </div>
    </nav>
  </header>
  <main id="main">${body}</main>
  <footer class="site-footer">
    <div class="shell footer-inner">
      <p>Open SDV Project DB · 여러 기관이 함께 관리하는 공개 소프트웨어 레지스트리</p>
      <p><a href="${url('/contribute/')}">YAML과 Markdown으로 프로젝트 등록하기</a></p>
    </div>
  </footer>
</body>
</html>`;
}

function renderCatalog() {
  const categories = [...new Set(projects.flatMap((p) => p.categories))].sort((a, b) => a.localeCompare(b, 'ko-KR'));
  const layers = ['vehicle', 'edge', 'cloud', 'tooling', 'data', 'safety'].filter((layer) => projects.some((project) => project.sdv_layers.includes(layer)));
  const cards = projects.map(renderProjectCard).join('\n');
  const body = `
    <section class="catalog-hero" aria-labelledby="catalog-title">
      <div class="shell catalog-hero-inner">
        <div>
          <p class="eyebrow">Open software · shared mobility</p>
          <h1 id="catalog-title">SDV 오픈소스를<br>한곳에서 탐색하세요.</h1>
          <p class="lead">여러 기관이 공개한 차량 소프트웨어의 역할과 소스 코드, 개발 문서, 참여 방법을 살펴보세요.</p>
        </div>
        <div class="metrics" aria-label="카탈로그 통계">
          <div class="metric"><strong>${projects.length}</strong><span>등록 프로젝트</span></div>
          <div class="metric"><strong>${organizations.length}</strong><span>참여 기관</span></div>
        </div>
      </div>
    </section>
    <section class="shell catalog-body" aria-labelledby="project-list-title">
      <div class="section-heading"><h2>프로젝트 찾기</h2><p>기관과 기술 분야를 선택하거나 프로젝트 이름으로 검색하세요.</p></div>
      <div class="filter-panel" role="search">
        <div class="control">
          <label for="project-search">프로젝트 검색</label><span class="search-icon" aria-hidden="true"></span>
          <input id="project-search" name="q" data-filter="search" type="search" placeholder="예: TANGO, Yocto, 비전" autocomplete="off">
        </div>
        <div class="control">
          <label for="organization-filter">담당기관</label>
          <select id="organization-filter" data-filter="organization"><option value="">모든 기관</option>${organizations.filter((org) => projects.some((project) => project.organization === org.slug)).map((org) => `<option value="${org.slug}">${escapeHtml(org.short_name)}</option>`).join('')}</select>
        </div>
        <div class="control">
          <label for="category-filter">분류</label>
          <select id="category-filter" name="category" data-filter="category"><option value="">모든 분류</option>${categories.map((item) => `<option value="${escapeHtml(item.toLowerCase())}">${escapeHtml(item)}</option>`).join('')}</select>
        </div>
        <div class="control">
          <label for="layer-filter">SDV 계층</label>
          <select id="layer-filter" name="layer" data-filter="layer"><option value="">모든 계층</option>${layers.map((item) => `<option value="${item}">${item}</option>`).join('')}</select>
        </div>
      </div>
      <div class="filter-summary" data-filter-summary hidden><div class="filter-chips" data-filter-chips aria-label="선택한 검색 조건"></div><button class="reset-filters" type="button" data-clear-filters>전체 초기화</button></div>
      <div class="result-bar"><h2 id="project-list-title">공개 프로젝트</h2><span class="result-count" data-result-count aria-live="polite">${projects.length}개 프로젝트</span></div>
      <div class="project-grid">${cards}</div>
      <div class="empty-state" data-empty-state><strong>검색 결과가 없습니다.</strong><p>다른 검색어를 입력하거나 필터를 초기화해 보세요.</p><button class="button secondary" type="button" data-clear-filters>전체 프로젝트 보기</button></div>
    </section>
    <script src="${url('/catalog.js')}" defer></script>`;
  return layout({ title: '프로젝트', description: 'SDV 공개 소프트웨어 프로젝트를 기관, 분류, 차량 소프트웨어 계층별로 탐색합니다.', current: 'projects', body });
}

function renderProjectCard(project) {
  const org = organizationMap.get(project.organization);
  const searchText = [project.name, project.summary, org.name, org.short_name, ...project.categories, ...(project.technologies || [])].join(' ');
  return `<a class="project-card" href="${url(`/projects/${project.slug}/`)}" data-project-card data-organization="${escapeHtml(project.organization)}" data-search="${escapeHtml(searchText)}" data-categories="${escapeHtml(project.categories.map((v) => v.toLowerCase()).join('|'))}" data-layers="${escapeHtml(project.sdv_layers.join('|'))}" aria-label="${escapeHtml(project.name)} · ${escapeHtml(org.name)} 상세 보기">
    <div class="project-card-accent" aria-hidden="true"></div><div class="project-card-body">
    <div class="card-top">${renderOrganizationLogo(org, 'card')}</div>
    <h3>${escapeHtml(project.name)}</h3>
    <p class="summary">${escapeHtml(project.summary)}</p>
    <div class="tag-row">${project.categories.slice(0, 3).map((category) => `<span class="tag">${escapeHtml(category)}</span>`).join('')}</div>
    <div class="card-footer"><span>${licenseLabel(project.license)}</span><span class="card-link">프로젝트 보기 →</span></div>
    </div>
  </a>`;
}

function renderProject(project) {
  const org = organizationMap.get(project.organization);
  const externalLinks = [
    project.homepage ? ['프로젝트 홈페이지', project.homepage] : null,
    project.repository ? ['GitHub 저장소', project.repository] : null,
    project.documentation ? ['개발 문서', project.documentation] : null,
  ].filter(Boolean);
  const links = externalLinks.map(([label, href]) => `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a>`).join('');
  const actions = [
    project.repository ? `<a class="button" href="${escapeHtml(project.repository)}" target="_blank" rel="noopener noreferrer">소스 코드 ↗</a>` : '',
    project.documentation ? `<a class="button secondary" href="${escapeHtml(project.documentation)}" target="_blank" rel="noopener noreferrer">개발 문서 ↗</a>` : '',
  ].filter(Boolean).join('');
  const integrationNames = project.integrates_with || [];
  const siblingProjects = projects.filter((item) => item.organization === project.organization && item.slug !== project.slug);
  const integrationLinks = integrationNames.map((name) => {
    const match = projects.find((p) => p.name === name);
    return match ? `<li><a href="${url(`/projects/${match.slug}/`)}">${escapeHtml(name)}</a></li>` : `<li>${escapeHtml(name)}</li>`;
  }).join('') || '<li>등록된 연동 프로젝트 없음</li>';
  const technologyTags = (project.technologies || []).map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join('') || '<span class="tag">정보 없음</span>';
  const maintainers = project.maintainers.map((maintainer) => `<div class="person"><strong>${escapeHtml(maintainer.name)}</strong><p>${escapeHtml(maintainer.role)}${maintainer.github ? ` · <a href="https://github.com/${escapeHtml(maintainer.github)}" target="_blank" rel="noopener noreferrer">GitHub ↗</a>` : ''}</p></div>`).join('') || '<div class="person"><strong>프로젝트 담당자</strong><p>담당기관에서 담당 팀과 공개 연락 경로를 등록할 예정입니다.</p></div>';
  const resourceRows = externalLinks.length ? externalLinks.map(([label, href]) => `<div class="resource-item"><strong>${escapeHtml(label)}</strong><p><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(href)}</a></p></div>`).join('') : '<div class="resource-item"><strong>Resources</strong><p>외부 링크가 아직 등록되지 않았습니다.</p></div>';
  const body = `
    <header class="project-header">
      <div class="shell"><div class="breadcrumbs"><a href="${url('/')}" data-project-list>← 프로젝트 목록</a><span>›</span>${escapeHtml(project.name)}</div>
        <div class="project-title-row">
          <div>
            <p class="project-kicker">${escapeHtml(org.name)}</p>
            <h1>${escapeHtml(project.name)}</h1>
            <p class="detail-summary">${escapeHtml(project.summary)}</p>
          </div>
          ${actions ? `<div class="project-actions">${actions}</div>` : ''}
        </div>
      </div>
      <div class="project-tab-bar"><div class="shell project-tabs" role="tablist" aria-label="프로젝트 정보" data-project-tabs>
        <button type="button" role="tab" id="tab-overview" aria-controls="panel-overview" aria-selected="true" data-tab="overview">개요</button>
        <button type="button" role="tab" id="tab-downloads" aria-controls="panel-downloads" aria-selected="false" tabindex="-1" data-tab="downloads">소스·문서</button>
        <button type="button" role="tab" id="tab-people" aria-controls="panel-people" aria-selected="false" tabindex="-1" data-tab="people">참여기관</button>
        <button type="button" role="tab" id="tab-resources" aria-controls="panel-resources" aria-selected="false" tabindex="-1" data-tab="resources">개발 자료</button>
        <button type="button" role="tab" id="tab-governance" aria-controls="panel-governance" aria-selected="false" tabindex="-1" data-tab="governance">운영 정보</button>
        <button type="button" role="tab" id="tab-contact" aria-controls="panel-contact" aria-selected="false" tabindex="-1" data-tab="contact">문의·기여</button>
      </div></div>
    </header>
    <div class="project-page"><div class="shell project-layout">
      <div class="project-main">
        <section class="tab-panel" id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" data-tab-panel="overview">
          <h2>프로젝트 개요</h2><p class="tab-intro">${escapeHtml(project.summary)}</p>
          <dl class="overview-facts">
            <div class="fact"><dt>담당기관</dt><dd>${escapeHtml(org.short_name)}</dd></div>
            <div class="fact"><dt>라이선스</dt><dd>${licenseLabel(project.license)}</dd></div>
            <div class="fact"><dt>저장소</dt><dd>GitHub · 공개</dd></div>
            <div class="fact"><dt>정보 확인일</dt><dd>${escapeHtml(project.last_reviewed)}</dd></div>
          </dl>
          <article class="prose">${project.html}</article>
        </section>
        <section class="tab-panel" id="panel-downloads" role="tabpanel" aria-labelledby="tab-downloads" data-tab-panel="downloads" hidden><h2>소스 코드와 문서</h2><p class="tab-intro">소스 코드와 배포 자료는 프로젝트가 관리하는 공식 채널에서 제공합니다.</p><div class="resource-list">${resourceRows}</div></section>
        <section class="tab-panel" id="panel-people" role="tabpanel" aria-labelledby="tab-people" data-tab-panel="people" hidden><h2>Who's involved</h2><p class="tab-intro">이 프로젝트를 등록하고 유지하는 기관과 담당자입니다.</p><div class="people-list">${maintainers}</div><h3>담당기관</h3><p><strong>${escapeHtml(org.name)}</strong><br>${escapeHtml(org.description)}</p></section>
        <section class="tab-panel" id="panel-resources" role="tabpanel" aria-labelledby="tab-resources" data-tab-panel="resources" hidden><h2>개발 자료</h2><p class="tab-intro">개발, 통합, 테스트를 시작하는 데 필요한 프로젝트 링크와 기술 정보입니다.</p><div class="resource-list">${resourceRows}</div><h3>사용 기술</h3><div class="tag-row">${technologyTags}</div><h3>SDV 적용 계층</h3><div class="tag-row">${project.sdv_layers.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join('')}</div></section>
        <section class="tab-panel" id="panel-governance" role="tabpanel" aria-labelledby="tab-governance" data-tab-panel="governance" hidden><h2>운영 정보</h2><p class="tab-intro">프로젝트의 담당기관과 라이선스, 정보 확인일을 안내합니다. 구체적인 운영 및 기여 정책은 공식 저장소를 확인하세요.</p><dl class="overview-facts"><div class="fact"><dt>Maturity</dt><dd>${maturityLabel(project.maturity)}</dd></div><div class="fact"><dt>License</dt><dd>${licenseLabel(project.license)}</dd></div><div class="fact"><dt>담당기관</dt><dd>${escapeHtml(org.name)}</dd></div><div class="fact"><dt>정보 확인일</dt><dd>${escapeHtml(project.last_reviewed)}</dd></div></dl><p>성숙도와 담당자 등 미등록 정보는 각 기관에서 보완할 예정입니다.</p></section>
        <section class="tab-panel" id="panel-contact" role="tabpanel" aria-labelledby="tab-contact" data-tab-panel="contact" hidden><h2>문의 및 기여</h2><p class="tab-intro">프로젝트 문의와 개선 제안은 공식 저장소의 안내를 확인한 뒤 전달하세요.</p><div class="sidebar-links"><a href="${escapeHtml(project.repository)}/issues" target="_blank" rel="noopener noreferrer">GitHub Issues에서 문의·제안 ↗</a><a href="${escapeHtml(project.repository)}#readme" target="_blank" rel="noopener noreferrer">README에서 기여 방법 확인 ↗</a></div>${project.maintainers.length ? `<h3>프로젝트 담당자</h3><div class="people-list">${maintainers}</div>` : ''}</section>
      </div>
      <aside class="project-sidebar" aria-label="프로젝트 보조 정보">
        <section class="sidebar-card"><h2>프로젝트 링크</h2><div class="sidebar-links">${links || '<span>등록된 외부 링크 없음</span>'}</div></section>
        <section class="sidebar-card organization-panel">${renderOrganizationLogo(org, 'detail')}<span>프로젝트 담당기관</span></section>
        ${integrationNames.length ? `<section class="sidebar-card"><h2>연관 프로젝트</h2><ul class="related-list">${integrationLinks}</ul></section>` : siblingProjects.length ? `<section class="sidebar-card"><h2>같은 기관의 프로젝트</h2><ul class="related-list">${siblingProjects.map((item) => `<li><a href="${url(`/projects/${item.slug}/`)}">${escapeHtml(item.name)}</a></li>`).join('')}</ul></section>` : ''}
        <section class="sidebar-card"><h2>기술 분류</h2><div class="tag-row">${project.categories.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join('')}${technologyTags}</div></section>
      </aside>
    </div></div>
    <script src="${url('/catalog.js')}" defer></script>`;
  return layout({ title: project.name, description: project.summary, current: 'projects', body });
}

function renderOrganizations() {
  const cards = organizations.map((org) => {
    const count = projects.filter((project) => project.organization === org.slug).length;
    const institutionProjects = projects.filter((project) => project.organization === org.slug);
    return `<article class="org-card">
      <div class="institution-logo">${renderOrganizationLogo(org, 'institution')}</div>
      <h2>${escapeHtml(org.name)}</h2>
      <p>${escapeHtml(org.description)}</p>
      ${count ? `<ul class="institution-projects">${institutionProjects.map((project) => `<li><a href="${url(`/projects/${project.slug}/`)}">${escapeHtml(project.name)} <span aria-hidden="true">→</span></a></li>`).join('')}</ul>` : ''}
      <div class="org-meta"><span>${count ? `${count}개 공개 프로젝트` : '공개 프로젝트 준비 중'}</span>${count ? `<a href="${url('/')}?organization=${org.slug}">프로젝트 모아보기 →</a>` : ''}</div>
    </article>`;
  }).join('');
  const body = `<section class="page-hero"><div class="shell"><p class="eyebrow">Organizations</p><h1>참여 기관</h1><p class="lead">각 기관이 담당하는 SDV 프로젝트와 공개 저장소를 살펴보세요.</p></div></section><div class="shell org-grid">${cards}</div>`;
  return layout({ title: '참여 기관', description: 'SDV 공개 소프트웨어 카탈로그에 참여하는 기관 목록입니다.', current: 'organizations', body });
}

function renderContribute() {
  const sample = `schema_version: "1.0"
slug: my-sdv-project
name: My SDV Project
organization: my-organization
summary: 프로젝트가 해결하는 문제를 1~2문장으로 작성합니다.
repository: https://github.com/example/my-sdv-project
status: active
maturity: incubation
license: Apache-2.0
categories:
  - 미들웨어
sdv_layers:
  - vehicle
  - edge
maintainers:
  - name: Project Team
    role: Maintainer
last_reviewed: "2026-09-28"`;
  const body = `
  <section class="page-hero"><div class="shell"><p class="eyebrow">Contribution workflow</p><h1>프로젝트 등록 가이드</h1><p class="lead">기관은 YAML에는 검색 가능한 사실을, README에는 프로젝트 설명과 사용법을 작성합니다.</p></div></section>
  <div class="shell guide-layout">
    <nav class="guide-nav" aria-label="문서 목차"><a href="#workflow">등록 절차</a><a href="#files">파일 구조</a><a href="#yaml">YAML 예시</a><a href="#review">자동 검사</a></nav>
    <article class="guide-content">
      <section id="workflow"><h2>등록 절차</h2><ol class="steps"><li><strong>기관 폴더를 확인합니다.</strong><br>처음 참여하는 기관은 조직 YAML도 함께 추가합니다.</li><li><strong>프로젝트 폴더를 만듭니다.</strong><br><code>catalog/projects/{기관}/{프로젝트}/</code> 경로를 사용합니다.</li><li><strong>YAML과 README를 작성합니다.</strong><br>장문의 소개나 설치법을 YAML에 넣지 않습니다.</li><li><strong>Pull Request를 엽니다.</strong><br>검증과 미리보기 확인 후 관리자가 병합합니다.</li></ol></section>
      <section id="files"><h2>파일 구조</h2><pre><code>catalog/projects/my-organization/my-project/
├─ project.yaml   # 검색·필터·관계 데이터
└─ README.md      # 소개·설치·사용·기여 문서</code></pre></section>
      <section id="yaml"><h2>YAML 예시</h2><pre><code>${escapeHtml(sample)}</code></pre></section>
      <section id="review"><h2>자동 검사</h2><p>Pull Request에서는 스키마, 중복 slug, 기관 참조, README 존재 여부와 전체 정적 빌드를 검사합니다. 별 수, 최근 릴리스와 커밋일처럼 자주 바뀌는 값은 향후 GitHub API로 수집하고 기관이 직접 적지 않도록 분리합니다.</p></section>
    </article>
  </div>`;
  return layout({ title: '기여 가이드', description: '기관이 SDV 공개 소프트웨어 프로젝트를 YAML과 Markdown으로 등록하는 방법입니다.', current: 'contribute', body });
}

function statusLabel(status) {
  return ({ unknown: '담당기관 확인 예정', active: 'Active', maintained: 'Maintained', experimental: 'Experimental', archived: 'Archived' })[status] || status;
}

function maturityLabel(maturity) {
  return ({ unknown: '정보 미등록', concept: 'Concept', sandbox: 'Sandbox', incubation: 'Incubation', production: 'Production' })[maturity] || maturity;
}

function licenseLabel(license) {
  return license === 'NOASSERTION' ? '라이선스 확인 필요' : escapeHtml(license);
}

function renderOrganizationLogo(org, variant) {
  return org.logo ? `<img class="org-logo org-logo--${variant}" src="${url(`/assets/organizations/${org.logo}`)}" alt="${escapeHtml(org.name)}" width="200" height="64" loading="lazy">` : `<span class="org-monogram">${escapeHtml(org.short_name)}</span>`;
}
