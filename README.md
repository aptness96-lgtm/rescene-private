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
공개 회원가입을 비활성화하고, Supabase RLS 정책을 유지하세요. 새 초대 권한 SQL을 적용하면 관리자는 쓰기 가능, 초대받은 회원은 공유 캘린더/이미지 조회만 가능합니다. SQL을 적용하기 전에는 기존 사용자별 RLS가 유지됩니다.

## 불필요한 설정 정리
자동 수집 기능용으로 생성한 GitHub Actions Secrets (SUPABASE_SECRET_KEY, OWNER_USER_ID, OPENAI_API_KEY) 및 Supabase Edge Function Secrets (GITHUB_DISPATCH_TOKEN 등)는 더 이상 사용하지 않습니다. 생성했다면 각각 삭제하거나 GitHub 토큰을 폐기할 수 있습니다. Supabase의 candidates 테이블은 데이터 손실 방지를 위해 자동 삭제하지 않았습니다.

## 선택 이미지 첨부 설정 (필수 1회)
Supabase Dashboard > SQL Editor에서 [supabase/event-images-migration.sql](supabase/event-images-migration.sql)을 실행하세요. 이 SQL은 events.image_path 컬럼을 추가하고, 비공개 event-images Storage 버킷 및 사용자별 읽기/업로드/삭제 RLS 정책을 만듭니다. SQL 실행 전에는 새로운 웹 버전에서 일정 저장이 image_path 컬럼 누락으로 실패할 수 있습니다.

- 공식 출처 URL과 이미지 첨부는 모두 선택 항목입니다.
- JPG/PNG/WEBP/GIF, 최대 5MB. 이미지는 본인 계정 폴더에 비공개 저장하고 조회 시 1시간 유효한 서명 URL을 발급합니다.
- 첨부 이미지가 있는 일정은 다가오는 일정 목록에 미리보기를 표시합니다.
- UI 기본 강조 색상은 사용자가 제공한 #889CA5 블루그레이입니다.

## 여러 사진 및 진행 중인 일정
1. 기존 [supabase/event-images-migration.sql](supabase/event-images-migration.sql)이 아직 실행되지 않았다면 먼저 실행합니다.
2. Supabase SQL Editor에서 [supabase/multiple-event-images.sql](supabase/multiple-event-images.sql)을 **한 번** 실행합니다. 이 작업은 기존 image_path 사진을 새 event_images 테이블로 연결하며 기존 파일은 삭제하지 않습니다.
3. GitHub Pages 배포 완료 후 사진 여러 장을 첨부해 일정 저장/수정/상세보기 테스트를 진행합니다.
4. 사진 최대 10장, 장당 5MB, JPG/PNG/WEBP/GIF. 비공개 Storage 버킷을 그대로 사용합니다.
5. 현재 진행 중인 일정은 시작 <= 현재 시각 <= 종료이고 종료 시간이 입력된 일정만 해당합니다. 1분 간격으로 상태를 갱신합니다.

**주의:** 새 SQL을 실행하기 전에는 일정 목록의 event_images 조회가 실패할 수 있습니다. 먼저 SQL을 적용하세요.

## 관리자 이메일 초대 + 조회 전용 권한 적용 (반드시 순서대로)
1. **Supabase SQL Editor**에서 [supabase/admin-invite-readonly.sql](supabase/admin-invite-readonly.sql)을 열고 `ADMIN_EMAIL_HERE`를 **기존 관리자 로그인 이메일**로 바꿉니다. 현재 관리자 이메일을 확인한 다음 전체 SQL을 **한 번 실행**하세요. 기존 일정 및 이미지 데이터는 삭제하지 않습니다. 이 파일은 앞서 두 이미지 마이그레이션 SQL이 적용되어 있어야 합니다.
2. Supabase Dashboard → **Authentication → Providers → Email**에서 공개 회원가입(**Allow new users to sign up**)을 **비활성화** 상태로 유지합니다. 이 설정이 켜져 있으면 새 가입자에게 viewer 역할이 자동 발급되므로 초대 전용이라는 보장이 깨집니다.
3. Supabase Dashboard → **Authentication → URL Configuration**의 **Site URL**을 `https://aptness96-lgtm.github.io/rescene-private/`로 설정하고, Redirect URLs에도 해당 주소를 추가합니다.
4. Supabase Dashboard → **Authentication → Users → Invite user**에서 초대할 이메일을 입력합니다. **반드시 위 SQL을 적용한 다음에** 초대하세요. 신규 계정은 DB 트리거가 자동으로 viewer로 등록합니다.
5. 사용자는 이메일의 초대 링크를 열어 비밀번호(8자 이상)를 설정하고 로그인합니다. 공유된 일정/사진은 조회 가능하지만 등록·수정·삭제 UI가 없고 RLS에서도 차단됩니다.
6. SQL Editor에서 확인: `select u.email,m.role from public.app_members m join auth.users u on u.id=m.user_id;` (관리자는 admin, 초대받은 사용자는 viewer).

**주의:** GitHub Pages는 정적 웹사이트라 초대 이메일 발송을 위한 비밀 관리자 키를 안전하게 보관할 수 없습니다. 초대 발송은 Supabase Dashboard에서 관리자가 직접 수행합니다. Supabase service_role/secret 키를 VITE_ 변수에 넣지 마세요.

**주의:** 이미 Auth Users에 만들어진 기존 사용자에게는 트리거가 소급 적용되지 않습니다. 이 경우 관리자가 SQL Editor에서 `insert into public.app_members(user_id,role) select id,'viewer' from auth.users where email='초대받은_기존_사용자_이메일' on conflict(user_id) do nothing;`을 실행해야 합니다. 이 작업은 실제로 초대할 사용자에게만 수행하세요.

**권한 철회:** 관리자가 Supabase Authentication → Users에서 해당 계정을 삭제하면 app_members도 삭제되어 공유 접근이 차단됩니다. 계정을 유지하면서 접근만 철회하려면 SQL Editor에서 해당 사용자의 app_members 행을 삭제하세요. 기존 로그인 세션이 있어도 RLS가 즉시 조회를 거부합니다.

**테스트:** 관리자 로그인 후 일정 등록/수정/사진 업로드 확인 → 초대 계정으로 로그인하여 동일 일정 및 사진 조회 확인 → 초대 계정에서 Supabase REST API로 직접 쓰기를 시도해도 RLS가 차단하는지 확인. 배포/SQL/실사용 검증은 별도입니다.
