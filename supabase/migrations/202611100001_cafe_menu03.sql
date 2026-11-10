-- Apply as the Supabase project administrator. This migration is atomic.
-- Never replace or alter an existing classroom table without reviewing it.
BEGIN;

DO $preflight$
BEGIN
  IF pg_catalog.to_regclass('public.cafe_menu03') IS NOT NULL THEN
    RAISE EXCEPTION 'public.cafe_menu03 already exists; review its schema before applying this migration'
      USING ERRCODE = '42P07';
  END IF;
  IF pg_catalog.to_regprocedure('public.cafe_menu03_validate_insert()') IS NOT NULL THEN
    RAISE EXCEPTION 'public.cafe_menu03_validate_insert() already exists; review it before applying this migration'
      USING ERRCODE = '42723';
  END IF;
END;
$preflight$;

CREATE TABLE public.cafe_menu03 (
  id uuid PRIMARY KEY,
  customer_name text NOT NULL,
  drink text NOT NULL,
  size text NOT NULL,
  options text[] NOT NULL DEFAULT ARRAY[]::text[],
  quantity integer NOT NULL,
  requests text NOT NULL DEFAULT '',
  total_price integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),

  CONSTRAINT cafe_menu03_customer_name_check CHECK (
    pg_catalog.char_length(customer_name) BETWEEN 1 AND 60
    AND customer_name = pg_catalog.regexp_replace(
      customer_name, '^[[:space:]]+|[[:space:]]+$', '', 'g'
    )
  ),
  CONSTRAINT cafe_menu03_drink_check CHECK (
    drink IN ('아메리카노', '카페라떼', '카페모카', '바닐라라떼', '녹차라떼')
  ),
  CONSTRAINT cafe_menu03_size_check CHECK (size IN ('S', 'M', 'L')),
  CONSTRAINT cafe_menu03_options_check CHECK (
    pg_catalog.cardinality(options) <= 4
    AND COALESCE(pg_catalog.array_ndims(options), 1) = 1
    AND pg_catalog.array_position(options, NULL) IS NULL
    AND options <@ ARRAY['샷 추가', '크림 추가', '시럽 추가', '디카페인']::text[]
  ),
  CONSTRAINT cafe_menu03_quantity_check CHECK (quantity BETWEEN 1 AND 20),
  CONSTRAINT cafe_menu03_requests_check CHECK (pg_catalog.char_length(requests) <= 500),
  CONSTRAINT cafe_menu03_total_price_check CHECK (
    total_price = (
      CASE drink
        WHEN '아메리카노' THEN 3500
        WHEN '카페라떼' THEN 4000
        ELSE 4500
      END
      + CASE size WHEN 'S' THEN 0 WHEN 'M' THEN 500 ELSE 1000 END
      + CASE WHEN '샷 추가' = ANY(options) THEN 500 ELSE 0 END
      + CASE WHEN '크림 추가' = ANY(options) THEN 500 ELSE 0 END
      + CASE WHEN '시럽 추가' = ANY(options) THEN 300 ELSE 0 END
    ) * quantity
  )
);

CREATE FUNCTION public.cafe_menu03_validate_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $validate$
DECLARE
  v_base integer;
  v_size integer;
  v_option text;
  v_option_price integer := 0;
  v_seen text[] := ARRAY[]::text[];
BEGIN
  IF NEW.customer_name IS NULL THEN
    RAISE EXCEPTION 'customer_name is required' USING ERRCODE = '23514';
  END IF;
  NEW.customer_name := pg_catalog.regexp_replace(
    NEW.customer_name, '^[[:space:]]+|[[:space:]]+$', '', 'g'
  );
  IF pg_catalog.char_length(NEW.customer_name) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'customer_name must contain 1 to 60 characters after trimming'
      USING ERRCODE = '23514';
  END IF;

  v_base := CASE NEW.drink
    WHEN '아메리카노' THEN 3500
    WHEN '카페라떼' THEN 4000
    WHEN '카페모카' THEN 4500
    WHEN '바닐라라떼' THEN 4500
    WHEN '녹차라떼' THEN 4500
    ELSE NULL
  END;
  IF v_base IS NULL THEN
    RAISE EXCEPTION 'unsupported drink' USING ERRCODE = '23514';
  END IF;

  v_size := CASE NEW.size WHEN 'S' THEN 0 WHEN 'M' THEN 500 WHEN 'L' THEN 1000 ELSE NULL END;
  IF v_size IS NULL THEN
    RAISE EXCEPTION 'size must be S, M or L' USING ERRCODE = '23514';
  END IF;
  IF NEW.quantity IS NULL OR NEW.quantity NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'quantity must be between 1 and 20' USING ERRCODE = '23514';
  END IF;
  IF NEW.requests IS NULL OR pg_catalog.char_length(NEW.requests) > 500 THEN
    RAISE EXCEPTION 'requests must contain at most 500 characters' USING ERRCODE = '23514';
  END IF;

  IF NEW.options IS NULL
     OR pg_catalog.cardinality(NEW.options) > 4
     OR COALESCE(pg_catalog.array_ndims(NEW.options), 1) <> 1 THEN
    RAISE EXCEPTION 'options must be a one-dimensional array of at most four choices'
      USING ERRCODE = '23514';
  END IF;
  FOREACH v_option IN ARRAY NEW.options LOOP
    IF v_option IS NULL OR v_option NOT IN ('샷 추가', '크림 추가', '시럽 추가', '디카페인') THEN
      RAISE EXCEPTION 'unsupported option' USING ERRCODE = '23514';
    END IF;
    IF v_option = ANY(v_seen) THEN
      RAISE EXCEPTION 'duplicate options are not allowed' USING ERRCODE = '23514';
    END IF;
    v_seen := pg_catalog.array_append(v_seen, v_option);
    v_option_price := v_option_price + CASE v_option
      WHEN '샷 추가' THEN 500
      WHEN '크림 추가' THEN 500
      WHEN '시럽 추가' THEN 300
      ELSE 0
    END;
  END LOOP;

  -- Ignore the price supplied by the browser. The database owns pricing.
  NEW.total_price := (v_base + v_size + v_option_price) * NEW.quantity;
  RETURN NEW;
END;
$validate$;

CREATE TRIGGER cafe_menu03_before_insert
BEFORE INSERT ON public.cafe_menu03
FOR EACH ROW EXECUTE FUNCTION public.cafe_menu03_validate_insert();

REVOKE ALL ON FUNCTION public.cafe_menu03_validate_insert() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.cafe_menu03 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cafe_menu03 FROM PUBLIC, anon, authenticated;
GRANT INSERT ON TABLE public.cafe_menu03 TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cafe_menu03 TO service_role;

CREATE POLICY cafe_menu03_insert_only
ON public.cafe_menu03
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

COMMIT;
