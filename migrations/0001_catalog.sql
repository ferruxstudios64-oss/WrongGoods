CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','published','archived')), data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), object_key TEXT NOT NULL UNIQUE, kind TEXT NOT NULL CHECK(kind IN ('image','archive')), name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS assets_product ON assets(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS products_provider_variant ON products(json_extract(data,'$.providerVariantId')) WHERE json_extract(data,'$.providerVariantId') <> '';
