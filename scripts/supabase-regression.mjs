// Emit a rollback-only Postgres integration check for the reviewed RPC operations.
import {readFileSync,writeFileSync} from 'node:fs';
const text=readFileSync('lib/server/supabase-queries.ts','utf8');const queries=JSON.parse(text.slice(text.indexOf('{'),text.lastIndexOf(';')));
const find=prefix=>{const entry=Object.entries(queries).find(([sql])=>sql.startsWith(prefix));if(!entry)throw Error(prefix);return entry[1];};
const op=(prefix,args=[])=>({name:find(prefix),args});
const id='wg-regression-draft',asset='wg-regression-image',session='wg-regression-session';
const draft=JSON.stringify({id,slug:id,name:'Verification fixture',images:[{id:asset}],providerVariantId:'verification'});
const operations=[
  op('INSERT INTO products',[id,id,'draft',draft,1,'2026-09-11T00:00:00Z']),
  op('SELECT data,state,revision,updated_at FROM products WHERE id',[id]),
  op('UPDATE products',[id,'draft',draft,2,'2026-09-11T00:01:00Z',id,1]),
  op('INSERT INTO assets',[asset,id,'verification/key','image','preview.png','image/png',67]),
  op('SELECT a.object_key',[asset]),
  op('INSERT INTO request_limits',['wg-regression-rate',999999]),
  op('INSERT INTO request_limits',['wg-regression-rate',999999]),
  op('DELETE FROM request_limits',[0]),
  op('INSERT INTO launch_signups',['verification@example.test','Verification consent','test','2026-09-11T00:00:00Z']),
  op('INSERT INTO contact_messages',['wg-regression-contact','Verification','verification@example.test','Rollback-only verification message','2026-09-11T00:00:00Z']),
  op('SELECT id,name,email,message,created_at'),op('SELECT email,consent_text,created_at'),
  op('INSERT INTO checkout_sessions',[session,'test-hash',id,'1','1',1,1,9999999999999]),
  op('SELECT * FROM checkout_sessions',[session]),
  op('INSERT INTO commerce_orders',['wg-regression-order',session,id,'1','refunded',1,'2026-09-11T00:02:00Z']),
  op('INSERT INTO commerce_orders',['wg-regression-order',session,id,'1','paid',1,'2026-09-11T00:03:00Z']),
  op('INSERT OR IGNORE INTO commerce_events',['wg-regression-event','wg-regression-order','order_refunded',1]),
  op('SELECT digest FROM commerce_events',['wg-regression-event']),
  op('SELECT state FROM commerce_orders',[session]),
  op('SELECT data,state,revision,updated_at FROM products ORDER'),
  op("SELECT data,state,revision,updated_at FROM products WHERE state='published'"),
  op('SELECT data,state,revision,updated_at FROM products WHERE slug',[id]),
  op('SELECT data,state,revision,updated_at FROM products WHERE json_extract',['verification']),
  op('DELETE FROM assets WHERE id',[asset]),
  op('DELETE FROM assets WHERE product_id',[id,id,2]),
  op('DELETE FROM products',[id,2]),
  op('DELETE FROM launch_signups',['verification@example.test']),
  {name:'owner_session_active',args:['00000000-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000000']},
];
const sql=`BEGIN; SET LOCAL ROLE service_role;
DO $verify$
DECLARE result jsonb;
BEGIN
result := public.wg_storefront_batch($ops$${JSON.stringify(operations.slice(0,14))}$ops$::jsonb) || public.wg_storefront_batch($ops$${JSON.stringify(operations.slice(14))}$ops$::jsonb);
IF result->1->'results'->0->>'data' IS NULL THEN RAISE EXCEPTION 'Draft not persisted'; END IF;
IF (result->6->'results'->0->>'count')::int <> 2 THEN RAISE EXCEPTION 'Rate limiter not atomic'; END IF;
IF result->18->'results'->0->>'state' <> 'refunded' THEN RAISE EXCEPTION 'Late payment revived refund'; END IF;
IF (result->25->'meta'->>'changes')::int <> 1 THEN RAISE EXCEPTION 'Draft deletion failed'; END IF;
IF (result->27->'results'->0->>'active')::boolean THEN RAISE EXCEPTION 'Missing owner session accepted'; END IF;
END;
$verify$;
ROLLBACK;
SELECT 'passed: prepared queries, atomic rates, draft CRUD, private media metadata, inbox, terminal refund, session rejection; all test writes rolled back' AS verification;`;
writeFileSync('.sites-runtime/supabase-regression.sql',sql);console.log('Prepared rollback-only Supabase regression.');
