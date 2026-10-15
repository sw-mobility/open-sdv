export function renderEditorIndex(projects, organizations, helpers) {
  const { layout, url, escapeHtml: e, renderOrganizationLogo } = helpers;
  const cards = organizations.map((org) => {
    const items = projects.filter((project) => project.organization === org.slug);
    return `<section class="editor-choice"><div class="editor-choice-heading">${renderOrganizationLogo(org, 'institution')}<h2>${e(org.name)}</h2></div><ul>${items.map((project) => `<li><div><strong>${e(project.name)}</strong><span>${project.summary ? e(project.summary) : '소개와 사용법을 작성해 주세요.'}</span></div><a class="button secondary" href="${url(`/projects/${project.slug}/edit/`)}">정보 수정 →</a></li>`).join('')}</ul></section>`;
  }).join('');
  return layout({ title: '프로젝트 정보 수정', description: 'Pages CMS에서 담당 프로젝트 정보를 수정합니다.', current: 'contribute', body: `<link rel="stylesheet" href="${url('/edit-index.css')}"><section class="page-hero"><div class="shell"><p class="eyebrow">For project maintainers</p><h1>프로젝트 정보 수정</h1><p class="lead">내 프로젝트를 선택하세요. Pages CMS에서 로그인하고 폼으로 수정할 수 있습니다.</p><p class="edit-hint">GitHub 로그인 → 내 프로젝트 수정 → 저장 → 자동 검사·배포</p></div></section><div class="shell editor-index">${cards}</div>` });
}
