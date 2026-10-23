# Open MiCOSA

여러 기관의 SDV(Software-Defined Vehicle) 관련 소프트웨어를 한곳에서 탐색하고, 각 기관이 프로젝트 소개와 사용법을 직접 관리하는 공동 프로젝트 카탈로그입니다.

프로젝트 소스 코드는 각 저장소에서 관리하며, 이 저장소에서는 프로젝트 정보와 공개 웹사이트를 관리합니다.

- **공개 사이트:** [Open MiCOSA](https://sw-mobility.github.io/open-sdv/)
- **정보 수정 안내:** [등록·수정 페이지](https://sw-mobility.github.io/open-sdv/contribute/)
- **웹 편집 도구:** [Pages CMS](https://app.pagescms.org/sw-mobility/open-sdv/main)

## 참여 프로젝트

| 담당기관 | 프로젝트 | 소스 코드 저장소 |
| --- | --- | --- |
| HL만도 | OMP_Cloudie | [OMP_Cloudie](https://github.com/sw-mobility/OMP_Cloudie) |
| HL만도 | OMP_Xrite | [OMP_Xrite](https://github.com/sw-mobility/OMP_Xrite) |
| HL만도 | OMP_PHM | [OMP_PHM](https://github.com/sw-mobility/OMP_PHM) |
| KETI | SDV_AIFW | [SDV_AIFW](https://github.com/sw-mobility/SDV_AIFW) · 비공개, 접근 권한 필요 |
| ETRI | TANGO-SDV | [TANGO-SDV](https://github.com/sw-mobility/TANGO-SDV) |
| ETRI | SDV_agent | [SDV_agent](https://github.com/sw-mobility/SDV_agent) |
| 가천대학교 | Edge_Vision | [Edge_Vision](https://github.com/sw-mobility/Edge_Vision) |

비공개 저장소의 링크를 등록하더라도 소스 코드가 공개되거나 접근 권한이 부여되는 것은 아닙니다. 카탈로그에 입력하는 소개와 담당자 정보는 공개됩니다.

## 사용 기술과 선택 이유

| 구분 | 기술 | 역할 및 선택 이유 |
| --- | --- | --- |
| 공개 화면 | HTML, CSS, JavaScript | 검색·필터와 프로젝트별 상세 탭을 제공하는 가벼운 정적 웹사이트 |
| 페이지 생성 | Node.js 22, 자체 빌드 스크립트 | 데이터를 읽어 HTML을 미리 생성. 별도 애플리케이션 서버 운영 불필요 |
| 콘텐츠 | YAML, Markdown | 프로젝트별 정보를 하나의 파일로 통합하고 소개·설치·사용법은 Markdown으로 관리 |
| 웹 편집 | 호스팅형 Pages CMS | Git 명령어나 YAML 문법을 몰라도 폼으로 수정하고 GitHub에 저장 |
| 데이터 검사 | JSON Schema, Ajv, ajv-formats | 데이터 형식과 필수 항목 등을 검사하여 잘못된 정보의 배포 방지 |
| 본문 처리 | marked, sanitize-html | Markdown을 HTML로 변환하고 허용되지 않는 HTML 정리 |
| 자동화·배포 | GitHub Actions, GitHub Pages | 변경 시 검사·테스트·빌드·배포 자동 실행 |

별도 콘텐츠 DB 대신 GitHub의 파일과 변경 이력을 사용합니다. 공개 사이트는 정적으로 제공하고, 편집·인증은 외부 Pages CMS 서비스에 맡겨 자체 CMS 서버나 OAuth 중계 서버의 개발·운영 부담을 줄였습니다.

UI는 블루·화이트 테마이며, 프로젝트 상세 화면은 **개요 / 소스·문서 / 참여기관 / 개발 자료 / 운영 정보 / 문의·기여** 탭으로 구성됩니다.

## 기관 담당자: 기존 프로젝트 수정

1. 공개 사이트에서 담당 프로젝트의 상세 페이지를 엽니다.
2. **정보 수정**을 누르고 연결된 Pages CMS에 GitHub 계정으로 로그인합니다.
3. 담당 프로젝트의 폼을 작성합니다.
4. **정보 확인일**을 갱신하고 **Save**를 누릅니다.
5. 자동 검사와 배포가 끝나면 공개 사이트에서 내용을 확인합니다.

처음 이용할 때는 운영 관리자가 Pages CMS GitHub App의 저장소 연결과 담당 계정의 편집 권한을 확인해야 합니다. 소스 코드 저장소가 아니라 **이 카탈로그 저장소(`sw-mobility/open-sdv`)를 수정할 수 있는 권한**이 필요합니다.

### 입력 항목과 공개 화면의 대응

| CMS 입력 항목 | 공개 화면 |
| --- | --- |
| 프로젝트 이름·한 줄 소개 | 목록 카드 및 상세 페이지 상단 |
| 프로젝트 소개와 사용법 | 개요 본문 |
| 저장소·개발 문서·프로젝트 홈페이지 | 소스·문서 탭 및 프로젝트 링크 |
| 저장소 공개 상태 | 공개·비공개·확인 중 안내 |
| 기술 분류 | 목록 카드와 분류 필터 |
| 사용 기술·SDV 적용 계층 | 개발 자료 탭 |
| 연관 프로젝트 | 상세 페이지의 연관 프로젝트 링크 |
| 프로젝트 담당자 | 참여기관 및 문의·기여 탭 |
| 라이선스·정보 확인일 | 개요 및 운영 정보 탭 |

소개와 사용법에는 목적, 지원 환경, 설치 방법, 실행 예제, 기여 방법을 작성하면 됩니다. 별도의 프로젝트 README를 이 저장소에서 수정할 필요는 없습니다.

- 선택 항목은 정보가 없으면 비워두세요. 한 줄 소개는 비워두거나 30~260자로 작성합니다.
- 연관 프로젝트는 실제 연동·활용 관계가 있는 등록 프로젝트를 선택합니다.
- 담당자는 공개 가능한 이름 또는 팀명과 역할을 입력합니다. GitHub 계정은 선택사항입니다.
- 비밀번호, 토큰, 비공개 자료, 개인 전화번호 등은 입력하지 마세요. 저장소와 수정 이력에도 남습니다.

### 저장과 배포 시 주의사항

현재 CMS는 `main` 브랜치를 편집하며, **Save하면 승인 대기 없이 커밋되고 자동 배포가 시작됩니다.** 저장 즉시 공개 화면이 바뀌는 것은 아니며 검사·빌드·배포 완료 후 반영됩니다.

검사나 빌드가 실패하면 기존 사이트는 유지됩니다. [GitHub Actions 실행 내역](https://github.com/sw-mobility/open-sdv/actions)에서 원인을 확인하고 입력값을 수정하거나 관리자에게 문의하세요.

기관별 CMS 메뉴는 편집 편의를 위한 구분이며, 기관별 파일 접근 권한을 강제하는 보안 경계가 아닙니다. 신뢰할 수 있는 담당자에게만 권한을 부여하세요. 현재 자동 PR·승인 흐름은 구현되어 있지 않습니다.

## 운영 관리자: 신규 프로젝트 등록

현재 CMS에서는 기존 프로젝트 수정만 제공하고 생성·이름 변경·삭제는 제한합니다. 신규 프로젝트는 관리자가 등록 틀을 만든 뒤 기관 담당자가 내용을 채웁니다.

1. 새 기관이면 `catalog/organizations/{기관}.yaml`에 기관 정보를 추가합니다.
2. 기존 프로젝트와 스키마를 참고하여 `catalog/projects/{기관}/{프로젝트}/project.yaml`을 추가합니다.
3. 전체 카탈로그에서 고유한 `slug`와 올바른 기관 식별자를 지정합니다.
4. `npm run cms:config`로 `.pages.yml`을 갱신합니다.
5. 아래 검사·테스트·빌드를 실행하고 데이터 파일과 CMS 설정을 함께 커밋합니다.
6. 배포 후 기관 담당자에게 CMS 편집 방법을 안내합니다.

기존 프로젝트의 일반적인 본문·정보 수정에는 CMS 설정 재생성이 필요하지 않습니다. 프로젝트 추가·삭제 등 목록 구조가 바뀌면 설정도 갱신해야 합니다.

## 데이터와 파일 구성

```text
catalog/
  organizations/                 # 기관 정보
  projects/{기관}/{프로젝트}/
    project.yaml                 # 메타데이터 + body(Markdown 본문)
schemas/project.schema.json      # 프로젝트 데이터 규칙
site/                            # 스타일, 브라우저 동작, 상세 화면 템플릿, 이미지
scripts/                         # 빌드, CMS 설정 생성, 데이터 검사와 테스트
.pages.yml                       # Pages CMS 메뉴와 입력 폼 설정
.github/workflows/               # 자동 검사 및 GitHub Pages 배포
dist/                            # 빌드 결과물(자동 생성)
```

프로젝트 데이터의 단일 원본은 `project.yaml`입니다. 웹 폼으로 수정해도 이 파일이 변경되며, `dist/`나 생성된 HTML을 직접 수정하지 않습니다.

## 로컬 개발 및 검사

Node.js 22를 기준으로 실행합니다.

```bash
npm ci
npm run check
npm run test:cms
npm run build
npm run test:site
npm run serve
```

기본 미리보기 주소는 `http://localhost:4173`입니다. 로컬 공개 화면의 **정보 수정** 버튼도 실제 Pages CMS로 연결되므로 저장하면 실제 GitHub 브랜치에 기록될 수 있습니다.

GitHub Pages의 `/open-sdv/` 하위 경로를 재현하려면 다음과 같이 빌드합니다.

```bash
BASE_PATH=open-sdv npm run build
```

Windows PowerShell:

```powershell
$env:BASE_PATH = 'open-sdv'
npm run build
```

일반 로컬 경로로 돌아가려면 해당 환경 변수를 해제하고 다시 빌드합니다.

```powershell
Remove-Item Env:BASE_PATH
npm run build
```

## 자동 배포 구조

`main`에 변경이 올라오면 `.github/workflows/pages.yml`이 다음 작업을 실행합니다.

1. Node.js 22 환경 구성 및 `npm ci`
2. `npm run check`로 카탈로그 검사
3. `npm run test:cms`로 CMS 데이터 처리·화면 렌더링 테스트
4. 저장소 하위 경로를 적용하여 `npm run build`
5. `npm run test:site`로 생성된 페이지의 브랜드와 공통 메뉴 검사
6. `dist/` 결과물을 GitHub Pages에 배포

GitHub 저장소의 Pages 배포 소스는 **GitHub Actions**를 사용합니다. 방문자 조회를 위해 별도 Node.js 서버를 띄울 필요는 없습니다.

## 라이선스

이 저장소의 라이선스는 [Apache License 2.0](LICENSE)을 참고하세요. 연결된 각 프로젝트의 라이선스는 해당 소스 저장소의 안내를 확인해야 하며, 기관 로고 등 제3자 자산에는 별도의 권리가 적용될 수 있습니다.
