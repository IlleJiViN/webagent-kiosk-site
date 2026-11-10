# 바이브 카페 수업용 주문 앱

`workbook/`은 HTML·CSS·JavaScript 주문서다. 기존 키오스크 스튜디오와 구분된 화면으로, 워크북의 필드·메뉴·가격 규칙을 그대로 사용한다.

주문은 Supabase `public.cafe_menu03`에 저장한다. 저장 응답을 확인한 뒤에만 `주문이 접수되었습니다!`를 표시한다. 방문객에게는 INSERT만 허용하며 주문 목록 읽기·수정·삭제는 허용하지 않는다. DB가 가격을 다시 계산하고 입력값을 검증한다.

## 연결과 배포

1. 연결한 Supabase 프로젝트에 `supabase/migrations/202611100001_cafe_menu03.sql`을 적용한다. 같은 이름의 테이블이 이미 있으면 기존 구조를 먼저 확인한다.
2. Vercel에 이 저장소를 연결하고 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`를 설정한다. 공개 publishable 또는 legacy anon 키만 사용한다. service_role·secret 키를 웹 코드나 이 저장소에 넣지 않는다.
3. 루트의 `vercel.json`은 `workbook/`을 정적 출력 폴더로 배포한다. 빌드 명령은 의존성 설치 없이 공개 클라이언트 설정 파일을 생성한다. Vercel 설정과 환경 변수가 반영된 실제 배포를 확인한다.
4. GitHub Pages에서는 `workbook/config.js`의 공개 설정이 적용된 상태로 `/workbook/` 경로를 사용한다.

## 확인

- 빈 이름을 제출하면 `이름을 입력해주세요` 알림이 뜨며 저장하지 않는다.
- 음료 미선택 시 예상 금액은 0원이다. 아메리카노 S 옵션 없음 2잔은 7,000원, 카페모카 L 시럽 추가 1잔은 5,800원이다.
- 실제 주문 제출 후 접수 완료 화면과 Supabase Table Editor의 동일 주문 ID·금액을 대조한다.
- `supabase/verify.sql`은 DB의 입력 검증·권한·중복 ID를 점검하고 테스트 데이터를 롤백한다.
- 계정 연결·마이그레이션 적용·실제 주문 저장·배포를 확인하기 전에는 완료된 연동으로 보고하지 않는다.

공식 문서: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Vercel 정적 설정](https://vercel.com/docs/project-configuration/vercel-json).
