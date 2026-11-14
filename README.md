# RESCENE PRIVATE

리센느(RESCENE) 개인 전용 일정 관리 사이트입니다.

## 기능
- Supabase 이메일/비밀번호 로그인
- 관리자 직접 일정 등록, 수정, 삭제
- 월간 캘린더 및 카테고리 필터
- 다가오는 일정 목록

**AI 공지 자동 수집 및 수동 수집 버튼은 제거했습니다.** 공지 승인 대기함도 화면에서 제거했습니다. 기존 일정 데이터는 유지됩니다.

## 배포
- GitHub Pages: https://aptness96-lgtm.github.io/rescene-private/
- React + Vite + Supabase
- GitHub Actions의 Deploy Pages 워크플로가 main 변경 시 배포합니다.
- GitHub Actions Variables: VITE_SUPABASE_URL (프로젝트 기본 URL), VITE_SUPABASE_ANON_KEY (publishable key)
- Supabase SQL: supabase/schema.sql

## 보안
공개 회원가입을 비활성화하고, Supabase RLS 정책을 유지하세요. 현재 RLS는 **사용자별 데이터 분리**이며 특정 관리자 UID만 허용하는 정책은 아닙니다. 다른 계정을 추가할 계획이라면 역할별 읽기/쓰기 권한을 별도로 설계해야 합니다.

## 불필요한 설정 정리
자동 수집 기능용으로 생성한 GitHub Actions Secrets (SUPABASE_SECRET_KEY, OWNER_USER_ID, OPENAI_API_KEY) 및 Supabase Edge Function Secrets (GITHUB_DISPATCH_TOKEN 등)는 더 이상 사용하지 않습니다. 생성했다면 각각 삭제하거나 GitHub 토큰을 폐기할 수 있습니다. Supabase의 candidates 테이블은 데이터 손실 방지를 위해 자동 삭제하지 않았습니다.
