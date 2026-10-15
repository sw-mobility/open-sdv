export const sdvLayerLabels = { vehicle: '차량', edge: '엣지', cloud: '클라우드', tooling: '개발 도구', data: '데이터', safety: '안전' };

export function repositoryStatusLabel(project) {
  if (!project.repository) return '저장소 미등록';
  return { public: '공개', private: '비공개 · 접근 권한 필요', unconfirmed: '공개 여부 확인 중' }[project.repository_status] || '공개 여부 확인 중';
}

export function githubRepositoryUrl(repository) {
  if (!repository) return null;
  try {
    const parsed = new URL(repository);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.hostname !== 'github.com' || parts.length !== 2) return null;
    return `${parsed.origin}/${parts[0]}/${parts[1].replace(/\.git$/, '')}`;
  } catch { return null; }
}
