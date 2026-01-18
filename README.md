# Chaldduck Admin Dashboard

React + TypeScript 기반의 관리자 대시보드입니다.

## 기능

- **고객 관리**: 고객 식별/생성, 프로필 조회, 주소 관리 (CRUD)
- **주문 관리**: 주문 조회, 주문 상세 보기
- **결제 관리**: 결제 생성, 결제 완료 처리, 결제 상세 보기
- **뱅크다 관리**: 거래내역 조회/저장, 자동 매칭
- **알림 로그**: 알림 로그 조회 및 필터링

## 기술 스택

- React 18
- TypeScript
- Vite
- Ant Design
- React Router
- React Query (TanStack Query)
- Axios

## 설치 및 실행

1. 의존성 설치:
```bash
npm install
```

2. 환경 변수 설정:
`.env` 파일을 생성하고 다음 내용을 추가하세요:
```
VITE_API_BASE_URL=http://localhost:8080
```

3. 개발 서버 실행:
```bash
npm run dev
```

4. 빌드:
```bash
npm run build
```

## 프로젝트 구조

```
src/
├── components/       # 공통 컴포넌트
│   └── Layout.tsx   # 레이아웃 컴포넌트
├── pages/           # 페이지 컴포넌트
│   ├── Dashboard.tsx
│   ├── CustomerIdentify.tsx
│   ├── CustomerProfile.tsx
│   ├── OrdersByCustomer.tsx
│   ├── OrderDetail.tsx
│   ├── PaymentDetail.tsx
│   ├── BankdaTransactions.tsx
│   ├── BankdaMatch.tsx
│   └── Notifications.tsx
├── services/         # API 서비스
│   └── api.ts       # API 클라이언트
├── types/           # TypeScript 타입 정의
│   └── api.ts
├── App.tsx          # 메인 앱 컴포넌트
├── main.tsx         # 진입점
└── index.css        # 전역 스타일
```

## API 엔드포인트

모든 API 호출은 `src/services/api.ts`에서 관리됩니다.

- Base URL: `http://localhost:8080` (환경 변수로 변경 가능)
- 모든 응답은 `JsonBody<T>` 형식으로 래핑됩니다.

## 주요 기능 설명

### 고객 관리
- 고객 식별: 이름과 전화번호로 고객을 식별하거나 생성
- 고객 프로필: 고객 정보와 주소 목록 조회
- 주소 관리: 주소 추가, 수정, 삭제

### 주문 관리
- 고객별 주문 목록 조회
- 주문 상세 정보 및 상품 목록 확인
- 주문에 대한 결제 생성

### 결제 관리
- 주문에 대한 결제 생성
- 결제 완료 처리 (입금 확인)
- 결제 상세 정보 조회

### 뱅크다 관리
- 거래내역 조회 및 DB 저장
- 거래내역 조회 + 저장 + 자동 매칭 (한 번에 실행)
- 저장된 거래내역 자동 매칭

### 알림 로그
- 전체 알림 로그 조회
- 템플릿 코드로 필터링
- 상태로 필터링

## 라이선스

MIT
