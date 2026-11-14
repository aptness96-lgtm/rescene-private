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

## 60분마다 공식 공지 수집 (추가 기능)

- `.github/workflows/collect-notices.yml`이 매시 17분(UTC)에 실행됩니다. GitHub 스케줄은 혼잡 시 지연/누락될 수 있습니다.
- `scripts/collect_notices.py`는 공개 Mnet Plus 리센느 #notice 목록의 공식 글 링크만 수집합니다. 사이트 구조나 접근 제한이 바뀌면 0건 수집 또는 실패할 수 있습니다. X/Instagram 수집은 아직 지원하지 않습니다.
- 신규 공식 글은 `candidates` 테이블의 pending 상태로만 추가됩니다. 승인 시에만 캘린더에 반영됩니다. 수집은 최근 최대 20개 링크를 대상으로 합니다.
- AI 요약·날짜 추출은 `OPENAI_API_KEY` 설정 시에만 활성화됩니다. 없으면 공식 글을 검토 대기함에 넣고 날짜는 비워 둡니다. AI가 추출한 날짜도 반드시 원문과 비교하세요.

### 필수 초기 설정
1. Supabase SQL Editor에서 `supabase/collector-migration.sql` 실행 (기존 후보의 같은 출처 중복이 있으면 먼저 정리).
2. Supabase Authentication > Users에서 본인 계정의 **User UID** 복사.
3. GitHub Settings > Secrets and variables > Actions > **Secrets**에 `OWNER_USER_ID` (본인 User UID)와 `SUPABASE_SECRET_KEY` (Supabase API Keys의 **Secret key**, `sb_secret_...`)를 각각 등록. 이 값은 Repository Variables나 `VITE_` 변수에 절대 넣지 마세요.
4. 선택사항: GitHub Actions **Secrets**에 `OPENAI_API_KEY` 등록 (OpenAI API 과금이 발생할 수 있음). 미등록 시 AI 없이 공식 공지 원문을 수집합니다.
5. GitHub Actions > Collect RESCENE notices > Run workflow 수동 실행하여 로그의 Discovered/Added 개수와 사이트 승인 대기함 확인.
6. 정기 실행은 워크플로가 기본 브랜치(main)에 존재하면 자동 시작합니다.

GitHub Actions의 `SUPABASE_URL`은 기존 `VITE_SUPABASE_URL` Repository Variable을 사용하며, 반드시 `https://프로젝트ID.supabase.co` 형식이어야 합니다. `/rest/v1`을 추가하지 마세요.

보안: Supabase Secret key는 RLS를 우회할 수 있으므로 Actions Secret으로만 저장하고 로그에 출력하지 마세요. 이 워크플로는 본인 UID를 명시해 삽입합니다. 사이트의 직접 일정 등록 및 승인·거절 기능은 기존대로 유지됩니다.
