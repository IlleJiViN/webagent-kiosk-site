# 카페 주문 데이터베이스 연결

`public.cafe_menu03`에 주문을 저장합니다. 고객은 주문 추가만 할 수 있고, 조회·수정·삭제는 할 수 없습니다. 실제 주문 내역은 프로젝트 관리자 또는 서버의 `service_role`로 확인합니다.

## 적용

1. 연결한 Supabase 프로젝트의 SQL Editor를 관리자 권한으로 엽니다.
2. `migrations/202611100001_cafe_menu03.sql` 전체를 실행합니다. 테이블과 검증 함수가 새로 생성되고, RLS와 INSERT 전용 권한이 함께 적용됩니다. 기존 테이블이나 같은 이름의 함수가 있으면 전체 작업이 실패합니다. 기존 구조를 먼저 확인하고 별도 변경안을 검토하세요.
3. 같은 SQL Editor에서 `verify.sql` 전체를 실행합니다. 권한·RLS·가격 덮어쓰기·입력 검증·중복 UUID를 확인하고 마지막에 `ROLLBACK`하므로 검증용 주문은 남지 않습니다. 오류가 발생하면 `ROLLBACK;`을 실행하고 원인을 해결한 뒤 다시 검증합니다.
4. 웹앱에는 프로젝트 URL과 공개용 publishable/anon 키만 설정합니다. `service_role` 키나 데이터베이스 비밀번호를 HTML·JavaScript·저장소에 넣지 마세요.
5. 웹앱에서 주문 후 관리자의 Table Editor로 `cafe_menu03`에 저장된 행과 금액을 확인합니다.

## 브라우저 요청

- UUID는 브라우저에서 새로 생성해 `id`로 전송합니다. 같은 UUID를 다시 전송하면 중복 주문으로 거절됩니다.
- REST 요청은 `Prefer: return=minimal`을 사용합니다. Supabase JavaScript SDK라면 `.insert(payload)`만 호출하고 `.select()`를 붙이지 않습니다. 고객의 SELECT 권한이 없으므로 반환 행을 요청하면 실패합니다.
- `customer_name`, `drink`, `size`, `options`, `quantity`, `requests`를 전송합니다. `total_price`는 보내거나 생략할 수 있지만, 저장되는 금액은 항상 데이터베이스가 계산합니다.
- 이름은 앞뒤 공백을 제거해 1~60자, 요청사항은 최대 500자, 수량은 1~20입니다. 음료와 사이즈는 워크북의 메뉴만 허용하고, 옵션은 네 종류 중 중복 없이 최대 네 개입니다.

가격은 `(음료 가격 + 사이즈 추가금 + 옵션 추가금) × 수량`입니다. 아메리카노 3,500원, 카페라떼 4,000원, 나머지 세 음료 4,500원입니다. S·M·L 추가금은 0·500·1,000원이고, 샷·크림·시럽·디카페인 추가금은 500·500·300·0원입니다.

SQL 파일 작성과 실제 프로젝트 적용·실행은 별개입니다. 적용 후 `verify.sql`이 오류 없이 끝나고 실제 주문 저장까지 확인되어야 연결 검증이 완료됩니다.

참고: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [PostgreSQL CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html), [PostgREST 반환 방식](https://docs.postgrest.org/en/stable/references/api/preferences.html#return-representation).
