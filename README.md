# RESCENE PRIVATE

리센느 개인 전용 일정 관리 웹사이트 (React + Vite + Supabase + GitHub Pages).

## 현재 기능
- Supabase 이메일 로그인 및 사용자별 RLS
- 월별 캘린더, 일정 등록/수정/삭제, 카테고리 필터
- 공지 URL/본문 붙여넣기, 승인 대기함, 승인/거절

**AI가 자동으로 공식 공지를 검색하는 기능은 아직 미구현입니다.** 현재 날짜 추출은 단순 패턴 기반이며 시간은 검토 후 수정해야 합니다.

## 필수 설정
1. https://supabase.com 에서 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` 실행
3. Authentication > Users에서 본인 계정 생성. 공개 회원가입은 비활성화 권장
4. GitHub 저장소 Settings > Secrets and variables > Actions > Variables 에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 설정. service_role 키는 절대 입력하지 마세요.
5. GitHub Settings > Pages > Build and deployment > Source를 **GitHub Actions**로 선택
6. Actions > Deploy Pages 실행 결과 확인

예상 주소: https://aptness96-lgtm.github.io/rescene-private/

## 로컬 실행
Node.js 20 이상 설치 후 `npm install`, `.env.example`을 `.env`로 복사하고 Supabase 값 입력, `npm run dev` 실행.

GitHub Pages의 정적 코드와 로그인 화면은 공개될 수 있으나 Supabase RLS로 일정 데이터는 인증된 소유자만 접근하도록 제한합니다. 자동 AI 공지 수집은 서버 측 API와 공식 출처 접근 정책을 확인한 후 추가 개발해야 합니다.
