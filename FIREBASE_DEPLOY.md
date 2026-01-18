# Firebase Hosting 배포 가이드

## 1. Firebase CLI 설치

```bash
npm install -g firebase-tools
```

또는 로컬에만 설치:
```bash
npm install --save-dev firebase-tools
```

## 2. Firebase 로그인

```bash
firebase login
```

브라우저가 열리면 Google 계정으로 로그인하세요.

## 3. Firebase 프로젝트 생성/연결

### 새 프로젝트 생성:
1. [Firebase Console](https://console.firebase.google.com/)에 접속
2. "프로젝트 추가" 클릭
3. 프로젝트 이름 입력 (예: `chaldduck-admin`)
4. Google Analytics 설정 (선택사항)
5. 프로젝트 생성 완료

### 기존 프로젝트 연결:
```bash
firebase use --add
```
프로젝트 ID를 입력하거나 선택하세요.

### 프로젝트 ID 확인/설정:
`.firebaserc` 파일을 열어 프로젝트 ID를 설정하세요:
```json
{
  "projects": {
    "default": "your-firebase-project-id"
  }
}
```

## 4. 환경 변수 설정

`.env.production` 파일이 올바르게 설정되어 있는지 확인:
```
VITE_API_BASE_URL=https://찰떡상회.com
```

## 5. 빌드

```bash
npm run build
```

빌드된 파일은 `dist` 폴더에 생성됩니다.

## 6. 배포

### 배포 전 테스트 (로컬):
```bash
npm run firebase:serve
```

### 실제 배포:
```bash
npm run firebase:deploy
```

또는:
```bash
firebase deploy --only hosting
```

## 7. 커스텀 도메인 설정 (admin.찰떡상회.com)

### Firebase Console에서:
1. Firebase Console > Hosting > "도메인 추가" 클릭
2. "커스텀 도메인 추가" 선택
3. `admin.찰떡상회.com` 입력
4. Firebase가 제공하는 DNS 레코드를 도메인 등록업체에 추가:
   - A 레코드 또는 AAAA 레코드
   - 또는 CNAME 레코드 (권장)
5. DNS 전파 대기 (보통 몇 분 ~ 몇 시간)
6. SSL 인증서 자동 발급 (Firebase가 자동 처리)

### DNS 설정 예시:
```
Type: CNAME
Name: admin
Value: your-project-id.web.app
```

또는:
```
Type: A
Name: admin
Value: [Firebase가 제공하는 IP 주소]
```

## 8. 자동 배포 설정 (선택사항)

### GitHub Actions 사용:
`.github/workflows/firebase-deploy.yml` 파일 생성:

```yaml
name: Deploy to Firebase Hosting

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: your-firebase-project-id
```

## 9. 문제 해결

### 빌드 에러:
- `npm run build` 실행 시 에러 확인
- TypeScript 타입 에러 확인: `npm run lint`

### 배포 에러:
- Firebase 로그인 확인: `firebase login`
- 프로젝트 ID 확인: `.firebaserc` 파일 확인
- Firebase 프로젝트 권한 확인

### CORS 에러:
- 프로덕션에서는 Vite proxy가 작동하지 않음
- API 서버에서 CORS 설정 필요
- 또는 Firebase Functions를 사용하여 프록시 설정

### 라우팅 문제 (404 에러):
- `firebase.json`의 `rewrites` 설정 확인
- 모든 경로가 `index.html`로 리다이렉트되는지 확인

## 10. 배포 확인

배포 후 다음 URL에서 확인:
- 기본 URL: `https://your-project-id.web.app`
- 커스텀 도메인: `https://admin.찰떡상회.com`

## 참고사항

- Firebase Hosting은 무료 플랜에서도 충분한 트래픽 제공
- 자동 SSL 인증서 발급
- CDN을 통한 빠른 전 세계 배포
- 간단한 롤백 기능 제공
