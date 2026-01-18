# 도메인 설정 문제 해결

## 문제: "올바른 도메인이 아니다" 오류

### 해결 방법 1: Punycode 변환 사용

한글 도메인(`찰떡상회.com`)의 경우 Punycode로 변환해야 할 수 있습니다:

**원본 도메인:**
- `admin.찰떡상회.com`

**Punycode 변환:**
- `admin.xn--331b04s38ifnk.com`

Firebase Console에서 `admin.xn--331b04s38ifnk.com`으로 입력해보세요.

### 해결 방법 2: 도메인 형식 확인

다음 형식으로 입력해야 합니다:
- ✅ `admin.찰떡상회.com` (공백 없음)
- ✅ `admin.xn--331b04s38ifnk.com` (Punycode)
- ❌ `admin. 찰떡상회.com` (공백 있음)
- ❌ `http://admin.찰떡상회.com` (프로토콜 포함)
- ❌ `https://admin.찰떡상회.com` (프로토콜 포함)

### 해결 방법 3: 도메인 등록 확인

1. `찰떡상회.com`이 실제로 등록되어 있는지 확인
2. 도메인 등록업체에서 도메인 상태 확인
3. 도메인이 만료되지 않았는지 확인

### 해결 방법 4: 다른 서브도메인 시도

만약 `admin` 서브도메인이 문제라면:
- `adm.찰떡상회.com`
- `admin-panel.찰떡상회.com`
- `manage.찰떡상회.com`

등으로 시도해보세요.

### 해결 방법 5: Firebase 지원팀 문의

위 방법들이 모두 실패하면:
1. Firebase Console > 프로젝트 설정 > 지원
2. 또는 Firebase 지원팀에 문의

## 참고: Punycode 변환 도구

온라인 Punycode 변환 도구:
- https://www.punycoder.com/
- https://www.charset.org/punycode

`찰떡상회.com` → `xn--331b04s38ifnk.com`
`admin.찰떡상회.com` → `admin.xn--331b04s38ifnk.com`
