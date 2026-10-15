import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { parse } from 'yaml';
import { createPagesConfig, pagesConfigShape, pagesProjectUrl, pagesRepositoryUrl } from './pages-config.mjs';
import { renderProject } from '../site/project-view.js';
import { createProjectValidator, normalizeProjectSource } from './project-data.mjs';
import { repositoryStatusLabel, githubRepositoryUrl } from '../site/project-labels.js';

const projects = [];
for (const org of await fs.readdir('catalog/projects')) for (const slug of await fs.readdir(`catalog/projects/${org}`)) {
  const source = await fs.readFile(`catalog/projects/${org}/${slug}/project.yaml`, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (source === null) continue;
  const data = normalizeProjectSource(parse(source));
  projects.push({ ...data, sourcePath: `catalog/projects/${org}/${slug}` });
  test(`${slug}: CMS data loads through the production normalization path`, () => { assert.equal(typeof data.body, 'string'); });
}
const organizations = await Promise.all((await fs.readdir('catalog/organizations')).map(async file => parse(await fs.readFile(`catalog/organizations/${file}`, 'utf8'))));
test('Pages CMS config covers every project and locks destructive operations', () => {
  const config = createPagesConfig(projects, organizations);
  const files = config.content.flatMap(group => group.items);
  assert.equal(files.length, projects.length);
  assert.equal(new Set(files.map(file => file.path)).size, projects.length);
  for (const file of files) {
    assert.equal(file.type, 'file'); assert.equal(file.format, 'yaml');
    assert.deepEqual(file.operations, { create: false, rename: false, delete: false });
    for (const key of ['slug','organization','schema_version']) assert.ok(file.fields.find(field => field.name === key).readonly);
    assert.equal(file.fields.find(field => field.name === 'body').options.format, 'markdown');
  }
  assert.equal(config.settings.content.merge, true);
});

test('committed .pages.yml contains only existing source files and matches the generator', async () => {
  const actual = parse(await fs.readFile('.pages.yml', 'utf8'));
  const expected = createPagesConfig(projects, organizations);
  const actualFiles = actual.content.flatMap(group => group.items).sort((a,b) => a.name.localeCompare(b.name));
  assert.deepEqual(pagesConfigShape(actual), pagesConfigShape(expected));
  for (const file of actualFiles) await fs.access(file.path);
});

test('edit links use the hosted Pages CMS repository and file routes', () => {
  assert.equal(pagesRepositoryUrl, 'https://app.pagescms.org/sw-mobility/open-sdv/main');
  assert.equal(pagesProjectUrl('omp-xrite'), pagesRepositoryUrl + '/file/omp-xrite');
});

test('changing a project title through CMS does not require a config regeneration', () => {
  const original = createPagesConfig(projects, organizations);
  const renamed = createPagesConfig(projects.map(project => ({ ...project, name: project.name + ' Updated' })).reverse(), [...organizations].reverse());
  assert.deepEqual(pagesConfigShape(original), pagesConfigShape(renamed));
});

test('cleared optional Pages CMS fields remain buildable without exposing private content', () => {
  const { sourcePath, ...base } = projects.find(project => project.slug === 'sdv-aifw');
  const data = normalizeProjectSource({ ...base, summary: null, license: '', body: null, categories: null, sdv_layers: [], maintainers: null, documentation: '', homepage: '' });
  assert.equal(data.body, ''); assert.equal(data.repository_status, 'private');
  assert.equal('documentation' in data, false); assert.equal('homepage' in data, false);
  assert.deepEqual(validate(data), []);
});

test('detail renderer includes all six tab panels and escapes text', () => {
  const project = { ...projects[0], name: '<script>bad</script>', html: '<p>설치 안내</p>' };
  const html = renderProject(project, { organizationMap: new Map(organizations.map(org => [org.slug, org])), projects, url: value => value, escapeHtml: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;'), renderOrganizationLogo: () => '', layout: ({body}) => body });
  for (const tab of ['overview','downloads','people','resources','governance','contact']) assert.ok(html.includes(`data-tab-panel="${tab}"`));
  assert.ok(!html.includes('<script>bad</script>'));
});

const schema = JSON.parse(await fs.readFile('schemas/project.schema.json', 'utf8'));
const validate = createProjectValidator(schema);
test('all project files satisfy catalog validation', () => {
  for (const { sourcePath, ...data } of projects) assert.deepEqual(validate(data), [], sourcePath);
});
test('invalid summaries, links, dates and partial maintainers block catalog validation', () => {
  const { sourcePath, ...base } = projects[0];
  const errors = validate({ ...base, summary: '짧음', repository: 'javascript:alert(1)', last_reviewed: '2026-02-30', maintainers: [{ name: 'Team', role: '', github: 'https://github.com/team' }] });
  for (const field of ['summary', 'repository', 'last_reviewed', 'maintainers']) assert.ok(errors.some(error => error.path === field), field);
});
test('body is required even when intentionally blank', () => {
  const { sourcePath, body, ...data } = projects[0];
  assert.ok(validate(data).some(error => error.path === 'body'));
});
test('missing or malformed maintainers returns errors rather than crashing validation', () => {
  const { sourcePath, maintainers, ...data } = projects[0];
  assert.ok(validate(data).some(error => error.path === 'maintainers'));
  assert.ok(validate({ ...data, maintainers: [null] }).some(error => error.path === 'maintainers'));
});

test('CMS omission of empty maintainers and technologies does not block validation or rendering', () => {
  const { sourcePath, maintainers, technologies, ...saved } = projects.find(project => project.slug === 'omp-cloudie');
  const before = structuredClone(saved);
  assert.ok(validate(saved).some(error => error.path === 'maintainers'));
  const data = normalizeProjectSource(saved);
  assert.deepEqual(validate(data), []);
  assert.deepEqual(data.maintainers, []);
  assert.deepEqual(data.technologies, []);
  assert.deepEqual(saved, before, 'Normalization must not modify saved source data.');
  const html = renderProject({ ...data, html: '<p>CMS 본문</p>' }, { organizationMap: new Map(organizations.map(org => [org.slug, org])), projects, url: value => value, escapeHtml: value => String(value), renderOrganizationLogo: () => '', layout: ({body}) => body });
  assert.ok(html.includes('CMS 본문'));
});

test('all empty optional fields accept omitted, null, and empty-string CMS representations', () => {
  const { sourcePath, ...base } = projects[0];
  for (const empty of [undefined, null, '']) {
    const saved = { ...base };
    for (const key of ['summary', 'body', 'license', 'categories', 'sdv_layers', 'technologies', 'integrates_with', 'maintainers', 'homepage', 'documentation']) {
      if (empty === undefined) delete saved[key]; else saved[key] = empty;
    }
    assert.deepEqual(validate(normalizeProjectSource(saved)), []);
  }
});

test('KETI can publish a nonempty introduction while its repository remains private', () => {
  const { sourcePath, ...base } = projects.find(project => project.slug === 'sdv-aifw');
  const data = normalizeProjectSource({ ...base, body: '# 프로젝트 소개\n\n담당기관에서 작성한 소개입니다.\n' });
  assert.deepEqual(validate(data), []);
  assert.equal(data.repository_status, 'private');
  assert.ok(data.body.includes('담당기관'));
});

test('retired maturity is absent from schema, CMS forms, and all detail pages', () => {
  assert.equal('maturity' in schema.properties, false);
  assert.equal(schema.required.includes('maturity'), false);
  const config = createPagesConfig(projects, organizations);
  for (const group of config.content) for (const file of group.items) assert.ok(!file.fields.some(field => field.name === 'maturity'));
  for (const { sourcePath, ...data } of projects) {
    const html = renderProject({ ...data, html: '' }, { organizationMap: new Map(organizations.map(org => [org.slug, org])), projects, url: value => value, escapeHtml: value => String(value), renderOrganizationLogo: () => '', layout: ({body}) => body });
    assert.ok(!html.includes('Maturity'));
    assert.ok(!html.includes('성숙도'));
  }
});

test('a stale CMS form may submit maturity without breaking the build', () => {
  const { sourcePath, ...base } = projects[0];
  const saved = { ...base, maturity: 'incubation' };
  const normalized = normalizeProjectSource(saved);
  assert.equal('maturity' in normalized, false);
  assert.equal(saved.maturity, 'incubation');
  assert.deepEqual(validate(normalized), []);
});

function renderFixture(overrides = {}, allProjects = projects) {
  return renderProject({ ...projects[0], html: '', ...overrides }, { organizationMap: new Map(organizations.map(org => [org.slug, org])), projects: allProjects, url: value => value, escapeHtml: (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'), renderOrganizationLogo: () => '', layout: ({ body }) => body });
}
const panel = (html, name) => html.split(`id="panel-${name}"`)[1].split('</section>')[0];

test('unused status and demo fields are removed, including stale CMS submissions', () => {
  for (const field of ['status', 'demo']) assert.equal(field in schema.properties, false);
  for (const group of createPagesConfig(projects, organizations).content) for (const file of group.items) {
    assert.ok(!file.fields.some(field => ['status', 'demo'].includes(field.name)));
  }
  const { sourcePath, ...base } = projects[0];
  const data = normalizeProjectSource({ ...base, status: 'active', demo: false });
  assert.equal('status' in data, false); assert.equal('demo' in data, false);
  assert.deepEqual(validate(data), []);
});

test('related project selector uses stable identifiers and excludes itself', () => {
  for (const group of createPagesConfig(projects, organizations).content) for (const file of group.items) {
    const field = file.fields.find(field => field.name === 'integrates_with');
    assert.equal(field.label, '연관 프로젝트'); assert.equal(field.type, 'select'); assert.equal(field.options.multiple, true);
    assert.equal(field.options.values.length, projects.length - 1);
    assert.ok(!field.options.values.some(option => option.name === file.name));
    for (const option of field.options.values) assert.ok(projects.some(project => project.slug === option.name));
  }
});

test('related project links survive renaming and still accept old name-based values', () => {
  const target = projects[1];
  const renamed = projects.map(project => project.slug === target.slug ? { ...project, name: '변경된 프로젝트 이름' } : project);
  const stable = renderFixture({ integrates_with: [target.slug] }, renamed);
  assert.ok(stable.includes(`href="/projects/${target.slug}/">변경된 프로젝트 이름</a>`));
  assert.ok(renderFixture({ integrates_with: [target.name] }).includes(`href="/projects/${target.slug}/"`));
  const self = renderFixture({ integrates_with: [projects[0].slug] });
  assert.ok(!self.includes('<h2>연관 프로젝트</h2>'));
});

test('public, private, unconfirmed, and missing repositories have accurate labels', () => {
  for (const [state, expected] of [['public', '공개'], ['private', '비공개 · 접근 권한 필요'], ['unconfirmed', '공개 여부 확인 중'], [undefined, '공개 여부 확인 중']]) {
    const data = { repository: 'https://github.com/example/repository', repository_status: state };
    assert.equal(repositoryStatusLabel(data), expected);
    assert.ok(panel(renderFixture(data), 'overview').includes(`<dd>${expected}</dd>`));
  }
  assert.equal(repositoryStatusLabel({}), '저장소 미등록');
});

test('cleared repository never generates broken Issues or README links', () => {
  const html = renderFixture({ repository: undefined });
  assert.ok(panel(html, 'overview').includes('저장소 미등록'));
  assert.ok(!html.includes('href="/issues"'));
  assert.ok(!html.includes('href="#readme"'));
  assert.ok(!html.includes('undefined'));
  assert.ok(panel(html, 'contact').includes('등록된 저장소가 없습니다'));
});

test('GitHub links are canonical and other hosts do not get fabricated Issues links', () => {
  assert.equal(githubRepositoryUrl('https://github.com/example/project.git/'), 'https://github.com/example/project');
  assert.equal(githubRepositoryUrl('https://gitlab.com/example/project'), null);
  assert.equal(githubRepositoryUrl('javascript:alert(1)'), null);
  const html = renderFixture({ repository: 'https://gitlab.com/example/project' });
  assert.ok(panel(html, 'contact').includes('https://gitlab.com/example/project'));
  assert.ok(!panel(html, 'contact').includes('/issues'));
});

test('development resources are localized and do not repeat source links', () => {
  const html = renderFixture({ sdv_layers: ['vehicle', 'edge', 'cloud', 'tooling', 'data', 'safety'], technologies: ['Python'], documentation: 'https://example.org/docs' });
  const resources = panel(html, 'resources');
  for (const label of ['차량', '엣지', '클라우드', '개발 도구', '데이터', '안전', 'Python']) assert.ok(resources.includes(label));
  assert.ok(!resources.includes('https://example.org/docs'));
  assert.ok(panel(html, 'downloads').includes('https://example.org/docs'));
});

test('project contacts render in both people and contact tabs with optional GitHub', () => {
  const html = renderFixture({ maintainers: [{ name: '<비전 팀>', role: '프로젝트 담당', github: 'example-team' }, { name: '운영팀', role: '개발' }] });
  for (const name of ['people', 'contact']) {
    const content = panel(html, name);
    assert.ok(content.includes('&lt;비전 팀&gt;')); assert.ok(content.includes('프로젝트 담당'));
    assert.ok(content.includes('https://github.com/example-team'));
    assert.ok(content.includes('운영팀'));
    assert.equal(content.split('https://github.com/example-team').length - 1, 1);
  }
  assert.ok(panel(renderFixture({ maintainers: [] }), 'people').includes('등록된 프로젝트 담당자가 없습니다'));
});

test('CMS whitespace and duplicate tags do not create blank UI labels or broken URLs', () => {
  const { sourcePath, ...base } = projects[0];
  const data = normalizeProjectSource({ ...base, categories: [' AI ', 'AI', ''], technologies: ['Python', ' Python ', ' '], documentation: '  ', maintainers: [{ name: ' 개발팀 ', role: ' 담당 ', github: ' example-team ' }] });
  assert.deepEqual(data.categories, ['AI']); assert.deepEqual(data.technologies, ['Python']);
  assert.equal('documentation' in data, false); assert.equal(data.maintainers[0].github, 'example-team');
  assert.deepEqual(validate(data), []);
});
