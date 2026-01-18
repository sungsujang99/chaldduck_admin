# Swagger API 문서

## Swagger UI 주소

API 서버의 Swagger UI에 접속하려면 다음 주소를 사용하세요:

### 프로덕션 환경
- **Swagger UI**: `https://찰떡상회.com/swagger-ui.html`
- **또는**: `https://찰떡상회.com/swagger-ui/index.html`
- **OpenAPI JSON**: `https://찰떡상회.com/v3/api-docs`

### 개발 환경 (로컬)
- **Swagger UI**: `http://localhost:8080/swagger-ui.html`
- **또는**: `http://localhost:8080/swagger-ui/index.html`
- **OpenAPI JSON**: `http://localhost:8080/v3/api-docs`

## API 정보

- **API 버전**: v1
- **OpenAPI 버전**: 3.1.0
- **서버 URL**: `https://찰떡상회.com`
- **API Base Path**: `/api/v1`

## 주요 API 태그

1. **Admin - Bankda**: 뱅크다 거래내역 조회/저장/자동매칭(운영용)
2. **Admin - Policy**: 할인/배송비 정책 관리
3. **Order**: 주문 생성/조회 (MVP)
4. **Admin - Product**: 상품/재고 관리
5. **Payment**: 결제(MVP, 실연동 제외) - 생성/완료 처리
6. **Admin - Inventory**: 재고/품절 관리
7. **Admin - Notification**: 알림 로그 조회(MVP)
8. **Admin - Review Match**: 입금 매칭 review 목록/확정
9. **Order - Pricing**: 주문서 계산/재고 상태
10. **Customer**: 고객(비회원) 식별/주소 관리

## 참고사항

- Swagger UI가 위 주소에서 작동하지 않는다면, 백엔드 서버 설정을 확인하세요.
- Spring Boot를 사용하는 경우, `springdoc-openapi` 또는 `springfox` 설정을 확인하세요.
- CORS 설정이 필요할 수 있습니다.
