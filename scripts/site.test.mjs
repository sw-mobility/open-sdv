import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';

// Run after npm run build, for both root and GitHub Pages subpath builds.
const pages = [];
async function collect(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(file);
    else if (entry.name.endsWith('.html')) pages.push([file, await fs.readFile(file, 'utf8')]);
  }
}
await collect('dist');

test('all generated pages use the exact Open MiCOSA brand', () => {
  assert.ok(pages.length >= 19);
  for (const [file, html] of pages) {
    assert.match(html, /<title>[^<]*Open MiCOSA<\/title>/, file);
    assert.match(html, /aria-label="Open MiCOSA 프로젝트 목록"/, file);
    assert.match(html, /Open <span>MiCOSA<\/span>/, file);
    assert.doesNotMatch(html, /Open SDV|brand-mark|open-sdv-mark\.svg|notice-bar/, file);
  }
});

test('common editing entry appears once in the header, not in the footer or catalog', () => {
  for (const [file, html] of pages) {
    const header = html.match(/<header class="site-header">([\s\S]*?)<\/header>/)?.[1];
    const footer = html.match(/<footer class="site-footer">([\s\S]*?)<\/footer>/)?.[1];
    assert.ok(header && footer, file);
    assert.equal((header.match(/>등록·수정<\/a>/g) || []).length, 1, file);
    assert.doesNotMatch(footer, /<a\b|등록|수정/, file);
    assert.match(footer, /Open MiCOSA/, file);
    assert.doesNotMatch(html, /catalog-editor-link|프로젝트 등록 안내 →/, file);
  }
});

test('project-specific edit and hosted CMS links remain available', () => {
  const detail = pages.find(([file]) => file.replaceAll('\\', '/').endsWith('/projects/sdv-aifw/index.html'))?.[1];
  const editor = pages.find(([file]) => file.replaceAll('\\', '/').endsWith('/projects/sdv-aifw/edit/index.html'))?.[1];
  assert.ok(detail && editor);
  assert.match(detail, /href="[^"]*\/projects\/sdv-aifw\/edit\/">정보 수정<\/a>/);
  assert.match(editor, /https:\/\/app.pagescms.org\/sw-mobility\/open-sdv\/main\/file\/sdv-aifw/);
});
