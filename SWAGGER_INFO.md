# API 스펙 업데이트 (2026-02-07)

## Firm API - OpenAPI 3.1.0

- **Base URL**: `https://찰떡상회.com`
- **버전**: v1

---

## 주요 변경사항

### 1. Admin - 공지사항 관리
- `GET /api/v1/admin/notices` - 공지 목록 조회
- `PUT /api/v1/admin/notices` - 공지 업서트 (없으면 생성, 있으면 수정)
- `GET /api/v1/notices/{type}` - 타입별 공지 조회 (고객용)
- `DELETE /api/v1/admin/notices/{type}` - 공지 삭제
- **공지 타입**: `ORDER_FORM` (주문서), `DEPOSIT_CONFIRMATION` (입금 확인)

### 2. Admin - 알림 로그 (KAKAO/SMS) 
- `GET /api/v1/admin/notifications` - 알림 로그 최신순 조회
- `GET /api/v1/admin/notifications/by-template` - 템플릿 코드로 필터
- `GET /api/v1/admin/notifications/by-status` - 상태로 필터
- **채널**: KAKAO, SMS
- **템플릿**: ORDER_CREATED, PAYMENT_PAID, ORDER_COMPLETED, DELIVERY_DELIVERED, DELIVERY_STARTED, ORDER_CONFIRMED

### 3. Admin - 카테고리 관리
- `GET /api/v1/admin/product-categories` - 카테고리 목록 (전체)
- `GET /api/v1/admin/product-categories/active` - 카테고리 목록 (활성만)
- `GET /api/v1/admin/product-categories/{categoryId}` - 단건 조회
- `POST /api/v1/admin/product-categories` - 카테고리 생성
- `PATCH /api/v1/admin/product-categories/{categoryId}` - 카테고리 수정
- `DELETE /api/v1/admin/product-categories/{categoryId}` - 카테고리 비활성화

### 4. Admin - 기능 설정 (Feature Flag, 참고)
- `GET /api/v1/admin/features` - 기능 목록 조회
- `PUT /api/v1/admin/features/{key}?enabled=true|false` - 기능 ON/OFF
- **기능 키**: `ORDER`, `DELIVERY_ORDER` (UI에서 미노출)

### 5. Admin - 상품 정렬
- `PUT /api/v1/admin/products/reorder` - 상품 정렬 순서 변경 (드래그앤드롭)

### 6. Admin - 주문 관리
- `DELETE /api/v1/admin/orders/{orderId}` - 주문 논리삭제 (soft delete)
- `POST /api/v1/admin/orders/{orderId}/restore` - 주문 복구
- `GET /api/v1/admin/orders` - includeDeleted 파라미터로 삭제된 주문 포함 조회

### 7. 배송 정보
- `OrderDeliveryStartRequest`에 `carrier` 필드 필수 (택배사)
- `OrderResponse`에 `carrier`, `trackingNo` 필드 포함

### 7. 배송비 규칙
- `zipPrefix` → `zipCode` (전체 5자리 우편번호)
- `ZIP_PREFIX_FEE` → `ZIP_CODE_DISCOUNT`

### 9. 정책 관리 (할인/배송비)
- 배송비 정책: CRUD, 룰 관리
- 할인 정책: CRUD, 룰 관리 (BANK_TRANSFER_FIXED, QTY_FIXED, BANK_TRANSFER_RATE, QTY_RATE)

---

## API 태그별 요약

| 태그 | 설명 |
|------|------|
| Admin - Sales Stats | 매출 통계 (일/주/월) |
| Admin - Notice | 공지사항 관리 |
| Admin - Feature | 기능 ON/OFF |
| Admin - Notification | 알림 로그 조회 |
| Admin - Review Match | 입금 매칭 review |
| Admin - Customer | 고객 관리 |
| Admin - Product Categories | 상품 카테고리 |
| Admin - Policy | 할인/배송비 정책 |
| Admin - Bankda | 뱅크다 거래내역/매칭 |
| Admin - Product | 상품/재고 관리 |
| Admin - Inventory | 재고/품절 관리 |
| Admin - Order | 주문 관리 |

---

## 주의사항

1. 모든 카테고리 관련 처리는 API 기반
2. 상품의 category는 categoryId(숫자)로 관리
3. 우편번호는 전체 5자리 사용 (zipCode)
4. 재고 수정은 PUT `/api/v1/admin/products/{productId}/stock` 사용
