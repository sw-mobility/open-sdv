import { sdvLayerLabels } from '../site/project-labels.js';

const string = (name, label, extra = {}) => ({ name, label, type: 'string', ...extra });
const select = (name, label, values, extra = {}) => ({ name, label, type: 'select', options: { values: Object.entries(values).map(([name, label]) => ({ name, label })) }, ...extra });

export const pagesRepositoryUrl = 'https://app.pagescms.org/sw-mobility/open-sdv/main';
export const pagesProjectUrl = slug => `${pagesRepositoryUrl}/file/${encodeURIComponent(slug)}`;

export function projectFields(projects = [], currentSlug = '') {
  return [
    string('schema_version', '스키마 버전', { hidden: true, readonly: true }),
    string('slug', '프로젝트 식별자', { hidden: true, readonly: true }),
    string('organization', '담당기관 식별자', { hidden: true, readonly: true }),
    string('name', '01 · 프로젝트 이름', { required: true, options: { minlength: 2, maxlength: 80 }, description: '프로젝트 목록과 상세 페이지의 제목입니다. 예: OMP_Xrite' }),
    { name: 'summary', label: '02 · 한 줄 소개', type: 'text', pattern: { regex: '^(?:[\\s\\S]{30,260})?$', message: '비워두거나 30~260자로 작성하세요.' }, description: '목록 카드에 표시됩니다. 어떤 문제를 해결하는지, 누가 사용하는지 간단히 설명하세요.' },
    { name: 'body', label: '03 · 프로젝트 소개와 사용법', type: 'rich-text', options: { format: 'markdown', switcher: true, media: false }, description: '상세 페이지의 개요 본문입니다. 프로젝트 소개 → 지원 환경 → 설치 → 사용 예제 → 기여 방법 순서로 작성하면 좋습니다. 비공개 정보와 비밀번호는 넣지 마세요.' },
    string('repository', '04 · 소스 코드 저장소', { pattern: { regex: '^(?:https?://.+)?$', message: 'https://로 시작하는 저장소 주소를 입력하세요.' }, description: '프로젝트 소스 코드가 있는 GitHub 주소입니다.' }),
    select('repository_status', '저장소 공개 상태', { public: '공개', private: '비공개 · 접근 권한 필요', unconfirmed: '확인 중' }, { required: true }),
    string('documentation', '개발 문서 주소', { pattern: '^(?:https?://.+)?$', description: '설치·사용 가이드 주소입니다. 별도 문서가 없으면 비워두세요.' }),
    string('homepage', '프로젝트 홈페이지 주소', { pattern: '^(?:https?://.+)?$', description: '기관 홈페이지가 아닌 프로젝트 전용 주소입니다. 없으면 비워두세요.' }),
    string('license', '05 · 라이선스', { description: '예: Apache-2.0, MIT, EPL-2.0. 확인되지 않았으면 비워두세요.' }),
    string('categories', '06 · 기술 분류', { list: true, description: '항목 추가로 하나씩 입력하세요. 예: 플랫폼, 클라우드, AI / ML. 목록 카드와 분류 필터에 사용합니다.' }),
    select('sdv_layers', 'SDV 적용 계층', sdvLayerLabels, { options: { values: Object.entries(sdvLayerLabels).map(([name, label]) => ({ name, label })), multiple: true } }),
    string('technologies', '사용 기술', { list: true, description: '언어·프레임워크·프로토콜을 하나씩 입력하세요. 예: Python, Yocto, ROS 2' }),
    { name: 'integrates_with', label: '연관 프로젝트', type: 'select', options: { multiple: true, values: projects.filter(project => project.slug !== currentSlug).sort((a, b) => a.slug.localeCompare(b.slug)).map(project => ({ name: project.slug, label: project.name })) }, description: '연동하거나 함께 활용하는 프로젝트를 선택하세요. 없으면 선택하지 않아도 됩니다.' },
    { name: 'maintainers', label: '07 · 프로젝트 담당자', type: 'object', list: { collapsible: { collapsed: false, summary: '{name} · {role}' } }, description: '참여기관과 문의·기여 탭에 표시됩니다. 공개 가능한 이름·팀명을 입력하세요. GitHub 계정은 선택사항입니다.', fields: [string('name', '이름 또는 팀명', { required: true }), string('role', '역할', { required: true, description: '예: 프로젝트 담당, 개발, Maintainer' }), string('github', 'GitHub 계정명', { pattern: { regex: '^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?)?$', message: 'URL이 아닌 GitHub 계정명만 입력하세요.' }, description: 'https://github.com/ 부분을 제외한 계정명입니다. 없으면 비워두세요.' })] },
    { name: 'last_reviewed', label: '08 · 정보 확인일', type: 'date', required: true, options: { time: false, format: 'yyyy-MM-dd' }, description: '입력한 정보를 마지막으로 확인한 날짜입니다. 수정 시 오늘 날짜로 갱신하세요.' },
    { name: 'featured', label: '대표 프로젝트 표시', type: 'boolean', hidden: true, readonly: true },
  ];
}

export function createPagesConfig(projects, organizations) {
  return {
    settings: { hide: true, content: { merge: true }, commit: { templates: { update: 'content: update {name} via Pages CMS' } } },
    content: organizations.filter(org => projects.some(project => project.organization === org.slug)).map(org => ({
      name: org.slug, label: org.name, type: 'group', items: projects.filter(project => project.organization === org.slug).map(project => ({
        name: project.slug, label: project.name, type: 'file', path: `${project.sourcePath}/project.yaml`, format: 'yaml', operations: { create: false, rename: false, delete: false }, fields: projectFields(projects, project.slug),
      })),
    })),
  };
}

// Display names may change in CMS without requiring an accompanying config edit.
export function pagesConfigShape(config) {
  return { ...config, content: config.content.map(({ label, ...group }) => ({ ...group, items: group.items.map(({ label, ...file }) => ({ ...file, fields: file.fields.map(field => field.name === 'integrates_with' ? { ...field, options: { ...field.options, values: field.options.values.map(({ label, ...value }) => value).sort((a, b) => a.name.localeCompare(b.name)) } } : field) })).sort((a, b) => a.name.localeCompare(b.name)) })).sort((a, b) => a.name.localeCompare(b.name)) };
}
