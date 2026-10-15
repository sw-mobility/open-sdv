import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { parse as parseYaml } from 'yaml';
import { renderEditorIndex } from './edit-index.mjs';
import { renderProject as projectView } from '../site/project-view.js';
import { createPagesConfig, pagesConfigShape, pagesRepositoryUrl, pagesProjectUrl } from './pages-config.mjs';
import { isDeepStrictEqual } from 'node:util';
import { stringify as stringifyYaml } from 'yaml';
import { createProjectValidator, normalizeProjectSource } from './project-data.mjs';

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
const validateProject = createProjectValidator(projectSchema);
const validateOrganization = ajv.compile(organizationSchema);

const organizations = await loadOrganizations();
const organizationMap = new Map(organizations.map((org) => [org.slug, org]));
const projects = await loadProjects();

validateRelations();

const pagesConfig = createPagesConfig(projects, organizations);
if (process.argv.includes('--cms-config')) {
  await fs.writeFile(path.join(root, '.pages.yml'), '# Pages CMS configuration. Regenerate with npm run cms:config after adding projects.\n' + stringifyYaml(pagesConfig, { lineWidth: 0 }));
  console.log('Updated .pages.yml for Pages CMS.');
  process.exit(0);
}
const savedConfig = parseYaml(await fs.readFile(path.join(root, '.pages.yml'), 'utf8'));
if (!isDeepStrictEqual(pagesConfigShape(savedConfig), pagesConfigShape(pagesConfig))) throw new Error('Pages CMS config is out of date. Run npm run cms:config and commit .pages.yml with the project changes.');

if (checkOnly) {
  console.log(`Validated ${organizations.length} organizations and ${projects.length} projects.`);
  process.exit(0);
}

await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(dist, { recursive: true });
await Promise.all([
  fs.copyFile(path.join(root, 'site/styles.css'), path.join(dist, 'styles.css')),
  fs.copyFile(path.join(root, 'site/catalog.js'), path.join(dist, 'catalog.js')),
  fs.copyFile(path.join(root, 'site/edit-index.css'), path.join(dist, 'edit-index.css')),
  fs.copyFile(path.join(root, 'site/favicon.svg'), path.join(dist, 'favicon.svg')),
  fs.cp(path.join(root, 'site/assets'), path.join(dist, 'assets'), { recursive: true }),
]);


const editorHelpers = { layout, url, escapeHtml, renderOrganizationLogo };

await Promise.all([
  writePage('index.html', renderCatalog()),
  writePage('organizations/index.html', renderOrganizations()),
  writePage('contribute/index.html', renderContribute()),
  writePage('edit/index.html', renderEditorIndex(projects, organizations, editorHelpers)),
  writePage('admin/index.html', renderEditorIndex(projects, organizations, editorHelpers)),
  ...projects.map((project) => writePage(`projects/${project.slug}/index.html`, renderProject(project))),
  ...projects.map((project) => writePage(`projects/${project.slug}/edit/index.html`, renderProjectEditorEntry(project))),
  fs.writeFile(path.join(dist, 'catalog.json'), JSON.stringify({ organizations, projects: projects.map(({ markdown, html, ...p }) => p) }, null, 2)),
]);

console.log(`Built ${projects.length * 2 + 5} pages into ${dist}`);

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
    const source = normalizeProjectSource(parseYaml(await fs.readFile(file, 'utf8')));
    const errors = validateProject(source);
    if (errors.length) throw new Error(`Invalid project ${file}: ${errors.map(error => `${error.path}: ${error.message}`).join(' / ')}`);
    const { body: cmsBody, ...data } = source;
    const expectedDirectory = path.join(root, 'catalog/projects', data.organization, data.slug);
    if (path.dirname(file) !== expectedDirectory) throw new Error(`Project identity does not match its folder: ${file}`);
    if (seen.has(data.slug)) throw new Error(`Duplicate project slug: ${data.slug}`);
    seen.add(data.slug);
    const markdown = cmsBody;
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
    result.push({ ...data, markdown, html, sourcePath: path.relative(root, path.dirname(file)).replaceAll('\\', '/') });
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
  <link rel="icon" type="image/svg+xml" href="${url('/favicon.svg')}?v=2">
  <link rel="stylesheet" href="${url('/styles.css')}">
</head>
<body>
  <a class="skip-link" href="#main">본문으로 건너뛰기</a>
  <div class="notice-bar">
    <div class="shell notice-inner"><span>Software-defined vehicle open source collaboration</span><a href="${url('/contribute/')}">프로젝트 등록 안내 →</a></div>
  </div>
  <header class="site-header">
    <nav class="nav" aria-label="주요 메뉴">
      <a class="brand" href="${url('/')}" aria-label="Open SDV 프로젝트 목록"><img class="brand-mark" src="${url('/assets/open-sdv-mark.svg')}" alt="" width="48" height="48"><span class="brand-copy"><strong>Open <span>SDV</span></strong><small>Project Catalog</small></span></a>
      <div class="nav-links">
        <a href="${url('/')}" ${current === 'projects' ? 'aria-current="page"' : ''}>프로젝트</a>
        <a href="${url('/organizations/')}" ${current === 'organizations' ? 'aria-current="page"' : ''}>참여 기관</a>
        <a href="${url('/contribute/')}" ${current === 'contribute' ? 'aria-current="page"' : ''}>등록·수정</a>
      </div>
    </nav>
  </header>
  <main id="main">${body}</main>
  <footer class="site-footer">
    <div class="shell footer-inner">
      <p>Open SDV Project DB · 여러 기관이 함께 관리하는 공개 소프트웨어 레지스트리</p>
      <p><a href="${url('/contribute/')}">프로젝트 정보 수정 안내</a></p>
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
      <div class="section-heading"><h2>프로젝트 찾기</h2><p>기관과 기술 분야를 선택하거나 프로젝트 이름으로 검색하세요.</p><a class="catalog-editor-link" href="${url('/edit/')}">기관 담당자 · 프로젝트 정보 수정 →</a></div>
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
      <div class="result-bar"><h2 id="project-list-title">프로젝트</h2><span class="result-count" data-result-count aria-live="polite">${projects.length}개 프로젝트</span></div>
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
    <div class="card-top">${renderOrganizationLogo(org, 'card')}${project.repository_status === 'private' ? '<span class="badge">비공개</span>' : ''}</div>
    <h3>${escapeHtml(project.name)}</h3>
    <p class="summary">${escapeHtml(project.summary) || '프로젝트 정보 준비 중'}</p>
    <div class="tag-row">${project.categories.slice(0, 3).map((category) => `<span class="tag">${escapeHtml(category)}</span>`).join('')}</div>
    <div class="card-footer"><span>${licenseLabel(project.license)}</span><span class="card-link">프로젝트 보기 →</span></div>
    </div>
  </a>`;
}

function renderProject(project) {
  return projectView(project, { organizationMap, projects, url, escapeHtml, renderOrganizationLogo, layout });
}

function renderProjectEditorEntry(project) {
  const org = organizationMap.get(project.organization);
  return layout({ title: `${project.name} 정보 수정`, current: 'contribute', body: `<link rel="stylesheet" href="${url('/edit-index.css')}"><section class="page-hero"><div class="shell"><div class="breadcrumbs"><a href="${url('/edit/')}">← 수정할 프로젝트 선택</a></div><p class="eyebrow">${escapeHtml(org.name)}</p><h1>${escapeHtml(project.name)} 정보 수정</h1><p class="lead">소개와 사용법을 Pages CMS의 폼에서 편집합니다. Git 명령어나 파일 수정은 필요하지 않습니다.</p><div class="edit-actions"><a class="button" href="${pagesProjectUrl(project.slug)}" target="_blank" rel="noopener noreferrer">Pages CMS에서 수정 ↗</a><a class="button secondary" href="${url(`/projects/${project.slug}/`)}">현재 프로젝트 페이지 보기</a></div></div></section><div class="shell editor-index"><section class="editor-choice"><h2>수정은 이렇게 진행됩니다</h2><ol class="edit-steps"><li><strong>GitHub 계정으로 로그인</strong><p>처음 사용할 때 저장소 접근 승인이 필요할 수 있습니다. 저장소가 보이지 않으면 사이트 관리자에게 문의하세요.</p></li><li><strong>프로젝트 정보를 폼에서 수정</strong><p>이름·한 줄 소개·소개와 사용법·문서 주소·담당자를 작성하세요. 수정 대상은 ${escapeHtml(project.name)}입니다.</p></li><li><strong>내용 확인 후 저장</strong><p>main 브랜치에서 저장하면 GitHub에 변경 내용이 기록됩니다. 자동 검사와 배포가 성공한 뒤 공개 사이트에 반영됩니다.</p></li></ol><p class="edit-notice">저장은 브라우저 임시저장이 아닙니다. 공개 가능한 정보만 작성하세요. 처음 연결할 때는 관리자가 편집 설정을 저장소에 반영하고 서비스 접근을 승인해야 합니다.</p><p><a href="${pagesRepositoryUrl}" target="_blank" rel="noopener noreferrer">프로젝트 폼이 열리지 않으면 저장소부터 선택하기 ↗</a></p></section></div>` });
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
      <div class="org-meta"><span>${count ? `${count}개 등록 프로젝트` : '공개 프로젝트 준비 중'}</span>${count ? `<a href="${url('/')}?organization=${org.slug}">프로젝트 모아보기 →</a>` : ''}</div>
    </article>`;
  }).join('');
  const body = `<section class="page-hero"><div class="shell"><p class="eyebrow">Organizations</p><h1>참여 기관</h1><p class="lead">각 기관이 담당하는 SDV 프로젝트와 공개 저장소를 살펴보세요.</p></div></section><div class="shell org-grid">${cards}</div>`;
  return layout({ title: '참여 기관', description: 'SDV 공개 소프트웨어 카탈로그에 참여하는 기관 목록입니다.', current: 'organizations', body });
}

function renderContribute() {
  return layout({ title: '프로젝트 등록·수정', description: 'Pages CMS에서 프로젝트 정보를 편집합니다.', current: 'contribute', body: `
    <section class="page-hero"><div class="shell"><p class="eyebrow">Project management</p><h1>프로젝트 등록·수정</h1><p class="lead">담당 프로젝트를 선택하고 Pages CMS에서 폼으로 수정하세요.</p></div></section>
    <div class="shell guide-layout"><article class="guide-content">
    <section><h2>기존 프로젝트 수정</h2><p><a class="button" href="${url('/edit/')}">내 프로젝트 선택 →</a></p><ol class="steps"><li><strong>정보 수정 버튼을 누릅니다.</strong><br>Pages CMS가 새 창에서 열립니다. GitHub 계정으로 로그인하세요.</li><li><strong>한국어 폼에서 내용을 작성합니다.</strong><br>소개와 사용법은 서식 편집기에서 작성하고, 공개 상태와 성숙도 등은 목록에서 선택합니다.</li><li><strong>저장 후 배포 결과를 확인합니다.</strong><br>main 브랜치에 저장하면 자동 검사와 빌드를 거쳐 사이트에 반영됩니다. 저장 성공과 사이트 배포 완료는 다르므로 잠시 후 공개 페이지를 확인하세요.</li></ol><p>관리자 승인이 필요한 경우에는 별도 검토 브랜치에서 저장하고 PR로 병합해야 합니다. Pages CMS를 연결했다고 자동 승인 절차가 생기지는 않습니다.</p></section>
    <section><h2>처음 사용하는 담당자</h2><p>관리자가 Pages CMS의 GitHub App을 open-sdv 저장소에 연결한 뒤 이용할 수 있습니다. 저장소가 보이지 않거나 저장 권한 오류가 나면 관리자에게 문의하세요. 로그인과 저장은 외부 Pages CMS 서비스에서 처리하며 이 사이트는 토큰이나 비밀번호를 보관하지 않습니다.</p></section>
    <section><h2>새 프로젝트 등록</h2><p>새 프로젝트는 관리자가 기관·저장소·식별자를 확인하여 항목을 추가합니다. 현재 등록된 ${projects.length}개 프로젝트는 담당자가 내용을 수정할 수 있습니다.</p></section>
    <section><h2>정보 저장 방식</h2><p>프로젝트별 project.yaml 하나에 기본 정보와 상세 본문이 함께 저장됩니다. 담당자는 파일 구조를 알 필요 없이 폼만 작성하면 됩니다. 기관별 메뉴는 편의를 위한 구분이며 기관별 접근권한 제한은 아닙니다.</p></section></article></div>` });
}
function licenseLabel(license) {
  return !license ? '라이선스 미등록' : license === 'NOASSERTION' ? '라이선스 확인 필요' : escapeHtml(license);
}

function renderOrganizationLogo(org, variant) {
  return org.logo ? `<img class="org-logo org-logo--${variant}" src="${url(`/assets/organizations/${org.logo}`)}" alt="${escapeHtml(org.name)}" width="200" height="64" loading="lazy">` : `<span class="org-monogram">${escapeHtml(org.short_name)}</span>`;
}
