import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { parse } from 'yaml';
import { createPagesConfig, pagesConfigShape, pagesProjectUrl, pagesRepositoryUrl } from './pages-config.mjs';
import { renderProject } from '../site/project-view.js';
import { createProjectValidator, normalizeProjectSource } from './project-data.mjs';

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
