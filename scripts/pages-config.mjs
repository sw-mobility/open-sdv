const string = (name, label, extra = {}) => ({ name, label, type: 'string', ...extra });
const select = (name, label, values, extra = {}) => ({ name, label, type: 'select', options: { values: Object.entries(values).map(([name, label]) => ({ name, label })) }, ...extra });

export const pagesRepositoryUrl = 'https://app.pagescms.org/sw-mobility/open-sdv/main';
export const pagesProjectUrl = slug => `${pagesRepositoryUrl}/file/${encodeURIComponent(slug)}`;

export function projectFields() {
  return [
    string('schema_version', '스키마 버전', { hidden: true, readonly: true }),
    string('slug', '프로젝트 식별자', { hidden: true, readonly: true }),
    string('organization', '담당기관 식별자', { hidden: true, readonly: true }),
    string('name', '01 · 프로젝트 이름', { required: true, options: { minlength: 2, maxlength: 80 }, description: '프로젝트 목록과 상세 페이지의 제목입니다. 예: OMP_Xrite' }),
    { name: 'summary', label: '02 · 한 줄 소개', type: 'text', pattern: { regex: '^(?:[\\s\\S]{30,260})?$', message: '비워두거나 30~260자로 작성하세요.' }, description: '목록 카드에 표시됩니다. 어떤 문제를 해결하는지, 누가 사용하는지 간단히 설명하세요.' },
    { name: 'body', label: '03 · 프로젝트 소개와 사용법', type: 'rich-text', options: { format: 'markdown', switcher: true, media: false }, description: '상세 페이지의 개요 본문입니다. 프로젝트 소개 → 지원 환경 → 설치 → 사용 예제 → 기여 방법 순서로 작성하면 좋습니다. 비공개 정보와 비밀번호는 넣지 마세요.' },
    string('repository', '04 · 소스 코드 저장소', { pattern: { regex: '^(?:https?://.+)?$', message: 'https://로 시작하는 저장소 주소를 입력하세요.' }, description: '프로젝트 소스 코드가 있는 GitHub 주소입니다.' }),
    select('repository_status', '저장소 공개 상태', { public: '공개', private: '비공개 · 접근 권한 필요', unconfirmed: '확인 중' }),
    string('documentation', '개발 문서 주소', { pattern: '^(?:https?://.+)?$', description: '설치·사용 가이드 주소입니다. 별도 문서가 없으면 비워두세요.' }),
    string('homepage', '프로젝트 홈페이지 주소', { pattern: '^(?:https?://.+)?$', description: '기관 홈페이지가 아닌 프로젝트 전용 주소입니다. 없으면 비워두세요.' }),
    string('license', '05 · 라이선스', { description: '예: Apache-2.0, MIT, EPL-2.0. 확인되지 않았으면 비워두세요.' }),
    string('categories', '06 · 기술 분류', { list: true, description: '항목 추가로 하나씩 입력하세요. 예: 플랫폼, 클라우드, AI / ML. 목록 카드와 분류 필터에 사용합니다.' }),
    select('sdv_layers', 'SDV 적용 계층', { vehicle: '차량', edge: '엣지', cloud: '클라우드', tooling: '개발 도구', data: '데이터', safety: '안전' }, { options: { values: [{ name: 'vehicle', label: '차량' }, { name: 'edge', label: '엣지' }, { name: 'cloud', label: '클라우드' }, { name: 'tooling', label: '개발 도구' }, { name: 'data', label: '데이터' }, { name: 'safety', label: '안전' }], multiple: true } }),
    string('technologies', '사용 기술', { list: true, description: '언어·프레임워크·프로토콜을 하나씩 입력하세요. 예: Python, Yocto, ROS 2' }),
    string('integrates_with', '함께 사용하는 프로젝트', { list: true, description: '연동 관계가 있는 등록 프로젝트 이름을 정확히 입력하세요. 없으면 비워두세요.' }),
    { name: 'maintainers', label: '07 · 공개 담당자', type: 'object', list: { collapsible: { collapsed: false, summary: '{name} · {role}' } }, description: '공개 가능한 이름·팀명과 GitHub 계정을 입력하세요. 개인 전화번호 등은 입력하지 마세요.', fields: [string('name', '이름 또는 팀명', { required: true }), string('role', '역할', { required: true, description: '예: 프로젝트 담당, 개발, Maintainer' }), string('github', 'GitHub 계정명', { pattern: { regex: '^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$', message: 'URL이 아닌 GitHub 계정명만 입력하세요.' }, description: 'https://github.com/ 부분을 제외한 계정명입니다.' })] },
    select('status', '08 · 운영 상태', { unknown: '확인 예정', active: '개발 중', maintained: '유지 관리', experimental: '실험', archived: '보관' }),
    select('maturity', '프로젝트 성숙도', { unknown: '미등록', concept: '개념', sandbox: '샌드박스', incubation: '인큐베이션', production: '운영 적용' }),
    { name: 'last_reviewed', label: '09 · 정보 확인일', type: 'date', required: true, options: { time: false, format: 'yyyy-MM-dd' }, description: '입력한 정보를 마지막으로 확인한 날짜입니다. 수정 시 오늘 날짜로 갱신하세요.' },
    { name: 'featured', label: '대표 프로젝트 표시', type: 'boolean', hidden: true, readonly: true },
    { name: 'demo', label: '예제 데이터 표시', type: 'boolean', hidden: true, readonly: true },
  ];
}

export function createPagesConfig(projects, organizations) {
  const fields = projectFields();
  return {
    settings: { hide: true, content: { merge: true }, commit: { templates: { update: 'content: update {name} via Pages CMS' } } },
    content: organizations.filter(org => projects.some(project => project.organization === org.slug)).map(org => ({
      name: org.slug, label: org.name, type: 'group', items: projects.filter(project => project.organization === org.slug).map(project => ({
        name: project.slug, label: project.name, type: 'file', path: `${project.sourcePath}/project.yaml`, format: 'yaml', operations: { create: false, rename: false, delete: false }, fields,
      })),
    })),
  };
}

// Display names may change in CMS without requiring an accompanying config edit.
export function pagesConfigShape(config) {
  return { ...config, content: config.content.map(({ label, ...group }) => ({ ...group, items: group.items.map(({ label, ...file }) => file).sort((a, b) => a.name.localeCompare(b.name)) })).sort((a, b) => a.name.localeCompare(b.name)) };
}
