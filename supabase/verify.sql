-- Run the whole file as the Supabase project administrator, after migration.
-- Every fixture uses the name '워크북 검증용'. No fixture survives ROLLBACK.
BEGIN;

DO $permissions$
DECLARE
  v_role text;
  v_rls boolean;
BEGIN
  SELECT relrowsecurity INTO v_rls
    FROM pg_catalog.pg_class
    WHERE oid = 'public.cafe_menu03'::regclass;
  IF v_rls IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'RLS must be enabled';
  END IF;
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated']::text[] LOOP
    IF NOT pg_catalog.has_table_privilege(v_role, 'public.cafe_menu03', 'INSERT')
       OR pg_catalog.has_table_privilege(v_role, 'public.cafe_menu03', 'SELECT')
       OR pg_catalog.has_table_privilege(v_role, 'public.cafe_menu03', 'UPDATE')
       OR pg_catalog.has_table_privilege(v_role, 'public.cafe_menu03', 'DELETE')
       OR pg_catalog.has_table_privilege(v_role, 'public.cafe_menu03', 'TRUNCATE')
       OR pg_catalog.has_table_privilege(v_role, 'public.cafe_menu03', 'TRIGGER') THEN
      RAISE EXCEPTION '% must have INSERT only', v_role;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_catalog.pg_policies
      WHERE schemaname = 'public' AND tablename = 'cafe_menu03'
        AND cmd = 'INSERT' AND policyname = 'cafe_menu03_insert_only') <> 1 THEN
    RAISE EXCEPTION 'expected INSERT policy is missing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies
      WHERE schemaname = 'public' AND tablename = 'cafe_menu03' AND cmd <> 'INSERT') THEN
    RAISE EXCEPTION 'unexpected read/update/delete policy';
  END IF;
END;
$permissions$;

SET LOCAL ROLE anon;

-- The browser must not request RETURNING/.select(). A false price is replaced.
INSERT INTO public.cafe_menu03
  (id, customer_name, drink, size, options, quantity, total_price)
VALUES
  ('5e863193-6608-4f23-9596-1f6d32ad1001', '  워크북 검증용  ', '아메리카노', 'S', ARRAY[]::text[], 2, 1);

-- total_price may be omitted: BEFORE INSERT calculates it before NOT NULL checks.
INSERT INTO public.cafe_menu03
  (id, customer_name, drink, size, options, quantity)
VALUES
  ('5e863193-6608-4f23-9596-1f6d32ad1002', '워크북 검증용', '카페모카', 'L', ARRAY['시럽 추가'], 1);

INSERT INTO public.cafe_menu03
  (id, customer_name, drink, size, options, quantity)
VALUES
  ('5e863193-6608-4f23-9596-1f6d32ad1005', '워크북 검증용', '카페라떼', 'M', ARRAY['샷 추가'], 1),
  ('5e863193-6608-4f23-9596-1f6d32ad1006', '워크북 검증용', '녹차라떼', 'S', ARRAY['디카페인'], 1);

DO $anonymous_checks$
DECLARE
  v_case integer;
  v_candidate public.cafe_menu03%ROWTYPE;
  v_id uuid;
BEGIN
  -- Reject each invalid value at the database boundary, not just in JavaScript.
  FOR v_case IN 1..17 LOOP
    v_candidate := ROW(
      '5e863193-6608-4f23-9596-1f6d32ad1099'::uuid,
      '워크북 검증용', '아메리카노', 'S', ARRAY[]::text[], 1, '', 0, pg_catalog.now()
    )::public.cafe_menu03;
    CASE v_case
      WHEN 1 THEN v_candidate.customer_name := E' \t\n ';
      WHEN 2 THEN v_candidate.customer_name := pg_catalog.repeat('가', 61);
      WHEN 3 THEN v_candidate.drink := '허용하지 않은 음료';
      WHEN 4 THEN v_candidate.size := 'XL';
      WHEN 5 THEN v_candidate.quantity := 0;
      WHEN 6 THEN v_candidate.quantity := 21;
      WHEN 7 THEN v_candidate.options := NULL;
      WHEN 8 THEN v_candidate.options := ARRAY['허용하지 않은 옵션'];
      WHEN 9 THEN v_candidate.options := ARRAY['샷 추가', '샷 추가'];
      WHEN 10 THEN v_candidate.options := ARRAY[NULL::text];
      WHEN 11 THEN v_candidate.options := ARRAY[['샷 추가', '크림 추가']];
      WHEN 12 THEN v_candidate.options := ARRAY['샷 추가', '크림 추가', '시럽 추가', '디카페인', '샷 추가'];
      WHEN 13 THEN v_candidate.requests := pg_catalog.repeat('가', 501);
      WHEN 14 THEN v_candidate.customer_name := NULL;
      WHEN 15 THEN v_candidate.requests := NULL;
      WHEN 16 THEN v_candidate.quantity := NULL;
      WHEN 17 THEN v_candidate.quantity := 2147483647;
    END CASE;
    BEGIN
      INSERT INTO public.cafe_menu03 SELECT v_candidate.*;
      RAISE EXCEPTION 'invalid fixture % was unexpectedly accepted', v_case;
    EXCEPTION WHEN check_violation THEN
      NULL;
    END;
  END LOOP;

  BEGIN
    INSERT INTO public.cafe_menu03
      (id, customer_name, drink, size, options, quantity)
    VALUES ('5e863193-6608-4f23-9596-1f6d32ad1001', '워크북 검증용', '아메리카노', 'S', ARRAY[]::text[], 1);
    RAISE EXCEPTION 'duplicate UUID was unexpectedly accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    PERFORM id FROM public.cafe_menu03 LIMIT 1;
    RAISE EXCEPTION 'anon SELECT was unexpectedly permitted';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    UPDATE public.cafe_menu03 SET requests = '수정 테스트';
    RAISE EXCEPTION 'anon UPDATE was unexpectedly permitted';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    DELETE FROM public.cafe_menu03;
    RAISE EXCEPTION 'anon DELETE was unexpectedly permitted';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    INSERT INTO public.cafe_menu03
      (id, customer_name, drink, size, options, quantity)
    VALUES ('5e863193-6608-4f23-9596-1f6d32ad1004', '워크북 검증용', '카페라떼', 'M', ARRAY[]::text[], 1)
    RETURNING id INTO v_id;
    RAISE EXCEPTION 'anon INSERT RETURNING was unexpectedly permitted';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$anonymous_checks$;

RESET ROLE;
SET LOCAL ROLE authenticated;

INSERT INTO public.cafe_menu03
  (id, customer_name, drink, size, options, quantity, requests, total_price)
VALUES (
  '5e863193-6608-4f23-9596-1f6d32ad1003', '워크북 검증용', '바닐라라떼', 'L',
  ARRAY['샷 추가', '크림 추가', '시럽 추가', '디카페인'], 20, pg_catalog.repeat('가', 500), -999
);

DO $authenticated_checks$
BEGIN
  BEGIN
    PERFORM id FROM public.cafe_menu03 LIMIT 1;
    RAISE EXCEPTION 'authenticated SELECT was unexpectedly permitted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.cafe_menu03 SET requests = '수정 테스트';
    RAISE EXCEPTION 'authenticated UPDATE was unexpectedly permitted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.cafe_menu03;
    RAISE EXCEPTION 'authenticated DELETE was unexpectedly permitted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$authenticated_checks$;

RESET ROLE;
SET LOCAL ROLE service_role;

DO $stored_values$
DECLARE
  v_name text;
  v_total integer;
  v_created_at timestamptz;
BEGIN
  SELECT customer_name, total_price, created_at INTO STRICT v_name, v_total, v_created_at
    FROM public.cafe_menu03 WHERE id = '5e863193-6608-4f23-9596-1f6d32ad1001';
  IF v_name <> '워크북 검증용' OR v_total <> 7000 OR v_created_at IS NULL THEN
    RAISE EXCEPTION 'trim, price overwrite or timestamp test failed';
  END IF;
  SELECT total_price INTO STRICT v_total FROM public.cafe_menu03
    WHERE id = '5e863193-6608-4f23-9596-1f6d32ad1002';
  IF v_total <> 5800 THEN RAISE EXCEPTION 'cafe mocha total must be 5800'; END IF;
  SELECT total_price INTO STRICT v_total FROM public.cafe_menu03
    WHERE id = '5e863193-6608-4f23-9596-1f6d32ad1003';
  IF v_total <> 136000 THEN RAISE EXCEPTION 'maximum permitted total must be 136000'; END IF;
  SELECT total_price INTO STRICT v_total FROM public.cafe_menu03
    WHERE id = '5e863193-6608-4f23-9596-1f6d32ad1005';
  IF v_total <> 5000 THEN RAISE EXCEPTION 'cafe latte total must be 5000'; END IF;
  SELECT total_price INTO STRICT v_total FROM public.cafe_menu03
    WHERE id = '5e863193-6608-4f23-9596-1f6d32ad1006';
  IF v_total <> 4500 THEN RAISE EXCEPTION 'green tea latte total must be 4500'; END IF;
END;
$stored_values$;

RESET ROLE;
ROLLBACK;

-- Expected result: no errors, and no fixture rows persisted.
