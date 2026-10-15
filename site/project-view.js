export function renderProject(project, context) {
  const { organizationMap, projects, url, escapeHtml, renderOrganizationLogo, layout } = context;
  const org = organizationMap.get(project.organization);
  const externalLinks = [
    project.homepage ? ['프로젝트 홈페이지', project.homepage] : null,
    project.repository ? ['GitHub 저장소', project.repository] : null,
    project.documentation ? ['개발 문서', project.documentation] : null,
  ].filter(Boolean);
  const links = externalLinks.map(([label, href]) => `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a>`).join('');
  const actions = [
    project.repository ? `<a class="button" href="${escapeHtml(project.repository)}" target="_blank" rel="noopener noreferrer">${project.repository_status === 'private' ? '저장소 링크' : '소스 코드'} ↗</a>` : '',
    project.documentation ? `<a class="button secondary" href="${escapeHtml(project.documentation)}" target="_blank" rel="noopener noreferrer">개발 문서 ↗</a>` : '',
    `<a class="button secondary" href="${url(`/projects/${project.slug}/edit/`)}">정보 수정</a>`,
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
            <p class="detail-summary">${escapeHtml(project.summary) || '프로젝트 정보 준비 중'}</p>
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
          <h2>프로젝트 개요</h2>${project.summary ? `<p class="tab-intro">${escapeHtml(project.summary)}</p>` : ''}
          <dl class="overview-facts">
            <div class="fact"><dt>담당기관</dt><dd>${escapeHtml(org.short_name)}</dd></div>
            <div class="fact"><dt>라이선스</dt><dd>${licenseLabel(project.license)}</dd></div>
            <div class="fact"><dt>저장소</dt><dd>${project.repository_status === 'private' ? '비공개 · 접근 권한 필요' : 'GitHub · 공개'}</dd></div>
            <div class="fact"><dt>정보 확인일</dt><dd>${escapeHtml(project.last_reviewed)}</dd></div>
          </dl>
          <article class="prose">${project.html.trim() || '<p>프로젝트 소개와 사용법은 담당기관에서 등록할 예정입니다.</p>'}</article>
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

function maturityLabel(maturity) {
  return ({ unknown: '정보 미등록', concept: 'Concept', sandbox: 'Sandbox', incubation: 'Incubation', production: 'Production' })[maturity] || maturity;
}

function licenseLabel(license) {
  return !license ? '라이선스 미등록' : license === 'NOASSERTION' ? '라이선스 확인 필요' : String(license).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

