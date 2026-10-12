# EdgeFleet Runtime

> 이 페이지는 카탈로그 기능 확인을 위한 더미 프로젝트입니다.

EdgeFleet Runtime은 차량 내부의 여러 ECU와 엣지 노드에서 컨테이너 워크로드를 일관된 방식으로 배포하는 예시 런타임입니다.

## 주요 사용 사례

- 차량 애플리케이션의 버전 고정 및 롤백
- 노드별 하드웨어 요구사항에 따른 워크로드 배치
- 연결이 불안정한 환경에서의 목표 상태 유지
- 차량 플릿 단위의 배포 상태 확인

## 빠른 시작

```yaml
workload:
  name: perception-demo
  image: registry.example/perception:v0.3.0
  target: vehicle-edge
```

## 연동

Vehicle Signal Bridge의 신호 스트림을 입력으로 받아 차량 애플리케이션에 전달하는 구성을 가정합니다.
