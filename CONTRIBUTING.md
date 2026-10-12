# 기여 가이드

프로젝트 등록은 기관별 폴더에 `project.yaml`과 `README.md`를 추가하는 Pull Request로 진행합니다.

- YAML에는 검색과 필터에 필요한 짧고 구조화된 사실만 기록합니다.
- 프로젝트 소개, 설치법, 구성도, 사용 예제는 README에 기록합니다.
- 라이선스는 SPDX 식별자를 사용합니다.
- 프로젝트 slug는 전체 카탈로그에서 고유해야 합니다.
- 자동 생성할 수 있는 GitHub 통계는 YAML에 직접 기록하지 않습니다.
- 더미 데이터는 반드시 `demo: true`로 표시합니다.

제출 전 `npm run check`와 `npm run build`를 실행하세요.
