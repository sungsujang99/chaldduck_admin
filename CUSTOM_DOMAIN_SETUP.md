# 커스텀 도메인 설정 가이드 (admin.찰떡상회.com)

## 1. Firebase Console에서 도메인 추가

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. `chaldduck-admin` 프로젝트 선택
3. 왼쪽 메뉴에서 **Hosting** 클릭
4. "도메인 추가" 또는 "Add custom domain" 버튼 클릭
5. `admin.찰떡상회.com` 입력
6. "계속" 또는 "Continue" 클릭

## 2. DNS 레코드 확인

Firebase가 다음 중 하나의 DNS 레코드를 제공합니다:

### 방법 1: A 레코드 (권장)
```
Type: A
Name: admin
Value: [Firebase가 제공하는 IP 주소들 - 여러 개]
```

### 방법 2: CNAME 레코드
```
Type: CNAME
Name: admin
Value: chaldduck-admin.web.app
```

## 3. 도메인 등록업체에서 DNS 설정

도메인 `찰떡상회.com`을 관리하는 곳(예: 가비아, 후이즈, AWS Route53 등)에서:

1. DNS 관리 페이지로 이동
2. Firebase가 제공한 DNS 레코드 추가:
   - **A 레코드**: Firebase가 제공한 IP 주소들을 모두 추가 (보통 2-4개)
   - 또는 **CNAME 레코드**: `chaldduck-admin.web.app` 추가

### 예시 (가비아 기준):
```
호스트: admin
레코드 타입: A (또는 CNAME)
값: [Firebase가 제공한 IP 주소 또는 CNAME 값]
TTL: 3600 (또는 기본값)
```

## 4. DNS 전파 대기

- DNS 변경사항이 전 세계에 전파되는데 보통 **5분 ~ 48시간** 소요
- 일반적으로 **10분 ~ 1시간** 내에 완료됨
- 온라인 DNS 체크 도구로 확인 가능:
  - https://dnschecker.org
  - https://www.whatsmydns.net

## 5. Firebase에서 도메인 확인

1. Firebase Console > Hosting > 도메인 목록에서 확인
2. 상태가 "연결됨" 또는 "Connected"로 변경되면 완료
3. SSL 인증서는 Firebase가 자동으로 발급 (보통 몇 분 소요)

## 6. 배포 확인

배포가 완료되면 다음 URL에서 접속 가능:
- `https://admin.찰떡상회.com`
- `https://chaldduck-admin.web.app` (기본 Firebase URL)

## 문제 해결

### DNS가 전파되지 않는 경우:
- DNS 캐시 클리어: `ipconfig /flushdns` (Windows) 또는 `sudo dscacheutil -flushcache` (Mac)
- 다른 네트워크에서 테스트
- DNS 서버 변경 (Google DNS: 8.8.8.8, Cloudflare DNS: 1.1.1.1)

### SSL 인증서 발급이 지연되는 경우:
- Firebase Console에서 도메인 상태 확인
- 보통 24시간 이내 자동 발급
- 문제가 지속되면 Firebase 지원팀에 문의

### 도메인이 연결되지 않는 경우:
- DNS 레코드가 올바르게 설정되었는지 확인
- TTL 값 확인 (너무 높으면 변경사항 반영이 느림)
- Firebase Console의 도메인 상태 메시지 확인

## 참고사항

- Firebase Hosting은 무료 플랜에서도 커스텀 도메인 지원
- SSL 인증서는 자동으로 발급되며 무료
- 여러 도메인을 동시에 연결 가능
- 도메인 연결 후에도 기본 Firebase URL(`.web.app`, `.firebaseapp.com`)은 계속 작동
