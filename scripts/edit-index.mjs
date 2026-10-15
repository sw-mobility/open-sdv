export function renderEditorIndex(projects, organizations, helpers) {
  const { layout, url, escapeHtml: e, renderOrganizationLogo } = helpers;
  const cards = organizations.map((org) => {
    const items = projects.filter((project) => project.organization === org.slug);
    return `<section class="editor-choice"><div class="editor-choice-heading">${renderOrganizationLogo(org, 'institution')}<h2>${e(org.name)}</h2></div><ul>${items.map((project) => `<li><div><strong>${e(project.name)}</strong><span>${project.summary ? e(project.summary) : '소개와 사용법을 작성해 주세요.'}</span></div><a class="button secondary" href="${url(`/projects/${project.slug}/edit/`)}">정보 수정 →</a></li>`).join('')}</ul></section>`;
  }).join('');
  return layout({ title: '프로젝트 정보 수정', description: '프로젝트를 선택하고 Pages CMS에서 수정하세요.', current: 'contribute', body: `<link rel="stylesheet" href="${url('/edit-index.css')}"><section class="page-hero"><div class="shell"><p class="eyebrow">For project maintainers</p><h1>프로젝트 정보 수정</h1><p class="lead">담당 프로젝트의 정보 수정을 누른 뒤, Pages CMS에서 수정하고 Save를 눌러주세요.</p></div></section><div class="shell editor-index">${cards}</div>` });
}
