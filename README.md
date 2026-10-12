# open-sdv

Open Software Defined Vehicle Framework

이 저장소에는 여러 기관의 SDV 공개 소프트웨어를 YAML과 Markdown으로 관리하고 정적 웹사이트로 생성하는 프로젝트 카탈로그가 포함되어 있습니다.

## Year 1: Project Launch

In the first year, each organization will independently manage its tasks and source code in its respective repository. Initial development will be conducted separately, with plans to integrate the projects in the following year.

## Subproject Repository List

| Organization | Repositories |
| --- | --- |
| HL Mando | [OMP_Xrite](https://github.com/sw-mobility/OMP_Xrite), [OMP_PHM](https://github.com/sw-mobility/OMP_PHM) |
| Korea Electronics Technology Institute | [SDV_AIFW](https://github.com/sw-mobility/SDV_AIFW) |
| Electronics and Telecommunication Research Institute | [TANGO-SDV](https://github.com/sw-mobility/TANGO-SDV), [SDV_agent](https://github.com/sw-mobility/SDV_agent) |
| Gachon University | [Edge_Vision](https://github.com/sw-mobility/Edge_Vision) |
| Perseus Inc | Repository URL to be added |
| Kookmin University | Repository URL to be added |
| Seoul National University | Repository URL to be added |

## SDV 공개 소프트웨어 카탈로그

기관별 프로젝트 메타데이터를 검증하고 목록·상세 페이지를 생성하는 정적 웹사이트 MVP입니다. 현재 일부 항목은 `demo: true`로 표시된 예시 데이터입니다.

## 로컬 실행

```bash
npm ci
npm run build
npm run serve
```

기본 미리보기 주소는 `http://localhost:4173`입니다.

## 콘텐츠 추가

1. `catalog/organizations/{기관}.yaml`에 기관 정보를 추가합니다.
2. `catalog/projects/{기관}/{프로젝트}/project.yaml`을 작성합니다.
3. 같은 폴더의 `README.md`에 소개와 사용법을 작성합니다.
4. `npm run check`로 스키마와 관계를 검사합니다.
5. Pull Request를 생성합니다.

`BASE_PATH` 환경 변수를 지정하면 GitHub Pages의 저장소 하위 경로에서도 사용할 수 있습니다.

```bash
BASE_PATH=open-sdv npm run build
```

Windows PowerShell에서는 다음과 같이 실행합니다.

```powershell
$env:BASE_PATH='open-sdv'; npm run build
```

## 라이선스

사이트 코드와 예제 스키마는 Apache-2.0 예시 정책을 전제로 합니다. 실제 운영 전 카탈로그 데이터, 로고와 문서의 라이선스 정책을 별도로 확정해야 합니다.
