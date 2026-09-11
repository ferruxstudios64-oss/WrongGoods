-- Additive migration: preserve every pre-existing public catalogue table and storage bucket.
CREATE SCHEMA IF NOT EXISTS wg_storefront;
REVOKE ALL ON SCHEMA wg_storefront FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA wg_storefront TO service_role;
SET search_path TO wg_storefront, pg_catalog;
CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','published','archived')), data TEXT NOT NULL, revision BIGINT NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), object_key TEXT NOT NULL UNIQUE, kind TEXT NOT NULL CHECK(kind IN ('image','archive')), name TEXT NOT NULL, mime TEXT NOT NULL, size BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS assets_product ON assets(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS products_provider_variant ON products((data::jsonb->>'providerVariantId')) WHERE (data::jsonb->>'providerVariantId') <> '';

-- Provider delivery is authoritative. These rows are private payment-status mirrors.
CREATE TABLE IF NOT EXISTS checkout_sessions (
  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, slug TEXT NOT NULL,
  variant_id TEXT NOT NULL, provider_product_id TEXT NOT NULL,
  test_mode BIGINT NOT NULL CHECK(test_mode IN (0,1)),
  created_at BIGINT NOT NULL, expires_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS commerce_orders (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL, slug TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','failed','paid','refunded')),
  test_mode BIGINT NOT NULL CHECK(test_mode IN (0,1)), updated_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES checkout_sessions(id)
);
CREATE INDEX IF NOT EXISTS commerce_orders_session ON commerce_orders(session_id);
CREATE TABLE IF NOT EXISTS commerce_events (
  digest TEXT PRIMARY KEY, order_id TEXT NOT NULL, event_name TEXT NOT NULL, received_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS launch_signups (
  email TEXT PRIMARY KEY,
  consent_text TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS request_limits (
  key TEXT PRIMARY KEY,
  "window" BIGINT NOT NULL,
  count BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS request_limits_window ON request_limits("window");

ALTER TABLE wg_storefront.products ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON wg_storefront.products FROM PUBLIC, anon, authenticated;
GRANT ALL ON wg_storefront.products TO service_role;
ALTER TABLE wg_storefront.assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON wg_storefront.assets FROM PUBLIC, anon, authenticated;
GRANT ALL ON wg_storefront.assets TO service_role;
ALTER TABLE wg_storefront.checkout_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON wg_storefront.checkout_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON wg_storefront.checkout_sessions TO service_role;
ALTER TABLE wg_storefront.commerce_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON wg_storefront.commerce_orders FROM PUBLIC, anon, authenticated;
GRANT ALL ON wg_storefront.commerce_orders TO service_role;
ALTER TABLE wg_storefront.commerce_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON wg_storefront.commerce_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON wg_storefront.commerce_events TO service_role;
ALTER TABLE wg_storefront.launch_signups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON wg_storefront.launch_signups FROM PUBLIC, anon, authenticated;
GRANT ALL ON wg_storefront.launch_signups TO service_role;
ALTER TABLE wg_storefront.contact_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON wg_storefront.contact_messages FROM PUBLIC, anon, authenticated;
GRANT ALL ON wg_storefront.contact_messages TO service_role;
ALTER TABLE wg_storefront.request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON wg_storefront.request_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON wg_storefront.request_limits TO service_role;
RESET search_path;
GRANT SELECT (id,user_id,not_after) ON auth.sessions TO service_role;
CREATE OR REPLACE FUNCTION public.wg_storefront_batch(operations jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = wg_storefront, pg_catalog AS $$
DECLARE op jsonb; args jsonb; rows jsonb; changes bigint; output jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(operations) <> 'array' OR jsonb_array_length(operations) > 20 THEN RAISE EXCEPTION 'Invalid operations'; END IF;
  FOR op IN SELECT value FROM jsonb_array_elements(operations) LOOP
    args := op->'args';
    IF jsonb_typeof(args) <> 'array' THEN RAISE EXCEPTION 'Invalid arguments'; END IF;
    CASE op->>'name'
    WHEN 'delete_6fe9e59b19cb' THEN
      -- DELETE FROM assets WHERE id=?
      IF jsonb_array_length(args) <> 1 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (DELETE FROM assets WHERE id=(args->>0) RETURNING 1 AS changed) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'delete_427b425f9f74' THEN
      -- DELETE FROM assets WHERE product_id=? AND EXISTS (SELECT 1 FROM products WHERE id=? AND revision=? AND state='draft')
      IF jsonb_array_length(args) <> 3 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (DELETE FROM assets WHERE product_id=(args->>0) AND EXISTS (SELECT 1 FROM products WHERE id=(args->>1) AND revision=(args->>2)::bigint AND state='draft') RETURNING 1 AS changed) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'delete_8d8c4ceca707' THEN
      -- DELETE FROM launch_signups WHERE email=?
      IF jsonb_array_length(args) <> 1 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (DELETE FROM launch_signups WHERE email=(args->>0) RETURNING 1 AS changed) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'delete_4759b2f50705' THEN
      -- DELETE FROM products WHERE id=? AND revision=? AND state='draft'
      IF jsonb_array_length(args) <> 2 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (DELETE FROM products WHERE id=(args->>0) AND revision=(args->>1)::bigint AND state='draft' RETURNING 1 AS changed) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'delete_003d82777b11' THEN
      -- DELETE FROM request_limits WHERE window < ?
      IF jsonb_array_length(args) <> 1 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (DELETE FROM request_limits WHERE "window" < (args->>0)::bigint RETURNING 1 AS changed) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'insert_ff16b2c82682' THEN
      -- INSERT INTO assets (id,product_id,object_key,kind,name,mime,size) VALUES (?,?,?,?,?,?,?)
      IF jsonb_array_length(args) <> 7 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (INSERT INTO assets (id,product_id,object_key,kind,name,mime,size) VALUES ((args->>0),(args->>1),(args->>2),(args->>3),(args->>4),(args->>5),(args->>6)::bigint) RETURNING 1 AS changed) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'insert_04c81a1163d6' THEN
      -- INSERT INTO checkout_sessions (id,token_hash,slug,variant_id,provider_product_id,test_mode,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)
      IF jsonb_array_length(args) <> 8 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (INSERT INTO checkout_sessions (id,token_hash,slug,variant_id,provider_product_id,test_mode,created_at,expires_at) VALUES ((args->>0),(args->>1),(args->>2),(args->>3),(args->>4),(args->>5)::bigint,(args->>6)::bigint,(args->>7)::bigint) RETURNING 1 AS changed) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'insert_9c18a7c45843' THEN
      -- INSERT INTO commerce_orders (id,session_id,slug,variant_id,state,test_mode,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at WHERE commerce_orders.state!='refunded' AND commerce_orders.session_id=excluded.session_id AND (excluded.state='refunded' OR excluded.updated_at>=commerce_orders.updated_at)
      IF jsonb_array_length(args) <> 7 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (INSERT INTO commerce_orders (id,session_id,slug,variant_id,state,test_mode,updated_at) VALUES ((args->>0),(args->>1),(args->>2),(args->>3),(args->>4),(args->>5)::bigint,(args->>6))
      ON CONFLICT(id) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at
      WHERE commerce_orders.state!='refunded' AND commerce_orders.session_id=excluded.session_id
      AND (excluded.state='refunded' OR excluded.updated_at>=commerce_orders.updated_at) RETURNING 1 AS changed) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'insert_e49a406a872e' THEN
      -- INSERT INTO contact_messages (id, name, email, message, created_at) VALUES (?, ?, ?, ?, ?)
      IF jsonb_array_length(args) <> 5 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (INSERT INTO contact_messages (id, name, email, message, created_at) VALUES ((args->>0), (args->>1), (args->>2), (args->>3), (args->>4)) RETURNING 1 AS changed) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'insert_090a866dfae3' THEN
      -- INSERT INTO launch_signups (email, consent_text, consent_version, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO NOTHING
      IF jsonb_array_length(args) <> 4 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (INSERT INTO launch_signups (email, consent_text, consent_version, created_at) VALUES ((args->>0), (args->>1), (args->>2), (args->>3)) ON CONFLICT(email) DO NOTHING RETURNING 1 AS changed) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'insert_c6025e4fa5d5' THEN
      -- INSERT INTO products (id,slug,state,data,revision,updated_at) VALUES (?,?,?,?,?,?)
      IF jsonb_array_length(args) <> 6 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (INSERT INTO products (id,slug,state,data,revision,updated_at) VALUES ((args->>0),(args->>1),(args->>2),(args->>3),(args->>4)::bigint,(args->>5)) RETURNING 1 AS changed) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'insert_44f3196abe7e' THEN
      -- INSERT INTO request_limits (key, window, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count
      IF jsonb_array_length(args) <> 2 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (INSERT INTO request_limits (key, "window", count) VALUES ((args->>0), (args->>1)::bigint, 1) ON CONFLICT(key) DO UPDATE SET count = request_limits.count + 1 RETURNING count) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'insert_c42a20276769' THEN
      -- INSERT OR IGNORE INTO commerce_events (digest,order_id,event_name,received_at) VALUES (?,?,?,?)
      IF jsonb_array_length(args) <> 4 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (INSERT INTO commerce_events (digest,order_id,event_name,received_at) VALUES ((args->>0),(args->>1),(args->>2),(args->>3)::bigint) ON CONFLICT DO NOTHING RETURNING 1 AS changed) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'select_c512e8240685' THEN
      -- SELECT * FROM checkout_sessions WHERE id=?
      IF jsonb_array_length(args) <> 1 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (SELECT * FROM checkout_sessions WHERE id=(args->>0)) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'select_47ff0aed019b' THEN
      -- SELECT a.object_key,a.mime,p.data,p.state FROM assets a JOIN products p ON p.id=a.product_id WHERE a.id=? AND a.kind='image'
      IF jsonb_array_length(args) <> 1 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (SELECT a.object_key,a.mime,p.data,p.state FROM assets a JOIN products p ON p.id=a.product_id WHERE a.id=(args->>0) AND a.kind='image') SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'select_27803d04f0cc' THEN
      -- SELECT data,state,revision,updated_at FROM products ORDER BY updated_at DESC
      IF jsonb_array_length(args) <> 0 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (SELECT data,state,revision,updated_at FROM products ORDER BY updated_at DESC) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'select_7ed76605fb80' THEN
      -- SELECT data,state,revision,updated_at FROM products WHERE id=?
      IF jsonb_array_length(args) <> 1 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (SELECT data,state,revision,updated_at FROM products WHERE id=(args->>0)) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'select_ce1c8d95e2ac' THEN
      -- SELECT data,state,revision,updated_at FROM products WHERE json_extract(data,'$.providerVariantId')=? AND state='published'
      IF jsonb_array_length(args) <> 1 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (SELECT data,state,revision,updated_at FROM products WHERE (data::jsonb->>'providerVariantId')=(args->>0) AND state='published') SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'select_106106bcaa1d' THEN
      -- SELECT data,state,revision,updated_at FROM products WHERE slug=? AND state='published'
      IF jsonb_array_length(args) <> 1 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (SELECT data,state,revision,updated_at FROM products WHERE slug=(args->>0) AND state='published') SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'select_c61342f6d168' THEN
      -- SELECT data,state,revision,updated_at FROM products WHERE state='published' ORDER BY updated_at DESC
      IF jsonb_array_length(args) <> 0 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (SELECT data,state,revision,updated_at FROM products WHERE state='published' ORDER BY updated_at DESC) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'select_0c9c5b8ef85f' THEN
      -- SELECT digest FROM commerce_events WHERE digest=?
      IF jsonb_array_length(args) <> 1 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (SELECT digest FROM commerce_events WHERE digest=(args->>0)) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'select_2621daa35f17' THEN
      -- SELECT email,consent_text,created_at FROM launch_signups ORDER BY created_at DESC LIMIT 1000
      IF jsonb_array_length(args) <> 0 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (SELECT email,consent_text,created_at FROM launch_signups ORDER BY created_at DESC LIMIT 1000) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'select_2bd455ebc11f' THEN
      -- SELECT id,name,email,message,created_at FROM contact_messages ORDER BY created_at DESC LIMIT 200
      IF jsonb_array_length(args) <> 0 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (SELECT id,name,email,message,created_at FROM contact_messages ORDER BY created_at DESC LIMIT 200) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'select_ea39eb992bce' THEN
      -- SELECT state FROM commerce_orders WHERE session_id=? ORDER BY CASE state WHEN 'refunded' THEN 0 WHEN 'paid' THEN 1 ELSE 2 END,updated_at DESC LIMIT 1
      IF jsonb_array_length(args) <> 1 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (SELECT state FROM commerce_orders WHERE session_id=(args->>0) ORDER BY CASE state WHEN 'refunded' THEN 0 WHEN 'paid' THEN 1 ELSE 2 END,updated_at DESC LIMIT 1) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'update_72d9e8e87023' THEN
      -- UPDATE products SET slug=?,state=?,data=?,revision=?,updated_at=? WHERE id=? AND revision=?
      IF jsonb_array_length(args) <> 7 THEN RAISE EXCEPTION 'Invalid parameter count'; END IF;
      WITH result AS (UPDATE products SET slug=(args->>0),state=(args->>1),data=(args->>2),revision=(args->>3)::bigint,updated_at=(args->>4) WHERE id=(args->>5) AND revision=(args->>6)::bigint RETURNING 1 AS changed) SELECT coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb), count(*) INTO rows, changes FROM result;
    WHEN 'owner_session_active' THEN
      SELECT jsonb_build_array(jsonb_build_object('active',EXISTS(SELECT 1 FROM auth.sessions WHERE id=(args->>0)::uuid AND user_id=(args->>1)::uuid AND (not_after IS NULL OR not_after > now())))) INTO rows; changes := 1;
    ELSE RAISE EXCEPTION 'Unknown operation';
    END CASE;
    output := output || jsonb_build_array(jsonb_build_object('results',rows,'success',true,'meta',jsonb_build_object('changes',changes)));
  END LOOP;
  RETURN output;
END;
$$;
REVOKE ALL ON FUNCTION public.wg_storefront_batch(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wg_storefront_batch(jsonb) TO service_role;

INSERT INTO wg_storefront.products(id,slug,state,data,revision,updated_at)
SELECT p.id::text,p.slug,'draft',jsonb_build_object('id',p.id::text,'slug',p.slug,'code',p.product_code,'name',p.name,'category',coalesce(d.name,'Fictional brands'),'tone',CASE WHEN p.tone::text ILIKE '%satir%' THEN 'Satirical' ELSE 'Straight-faced' END,'description',coalesce(p.description,''),'contents','[]'::jsonb,'formats','[]'::jsonb,'compatibility','','licence','','priceGBP',p.price_gbp,'providerVariantId',coalesce(p.lemon_squeezy_variant_id,''),'providerDeliveryVerified',false,'images','[]'::jsonb,'archive',null,'state','draft','revision',1,'updatedAt',now())::text,1,now()::text FROM public.products p LEFT JOIN public.departments d ON d.id=p.department_id ON CONFLICT DO NOTHING;
