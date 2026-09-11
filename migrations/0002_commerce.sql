-- Provider delivery is authoritative. These rows are private payment-status mirrors.
CREATE TABLE IF NOT EXISTS checkout_sessions (
  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, slug TEXT NOT NULL,
  variant_id TEXT NOT NULL, provider_product_id TEXT NOT NULL,
  test_mode INTEGER NOT NULL CHECK(test_mode IN (0,1)),
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS commerce_orders (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL, slug TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','failed','paid','refunded')),
  test_mode INTEGER NOT NULL CHECK(test_mode IN (0,1)), updated_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES checkout_sessions(id)
);
CREATE INDEX IF NOT EXISTS commerce_orders_session ON commerce_orders(session_id);
CREATE TABLE IF NOT EXISTS commerce_events (
  digest TEXT PRIMARY KEY, order_id TEXT NOT NULL, event_name TEXT NOT NULL, received_at INTEGER NOT NULL
);
