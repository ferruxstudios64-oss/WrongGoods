import type { Product } from '../catalog';
import { database } from './env';
import { HttpError } from './auth';

export type Asset = { id: string; key: string; name: string; type: string; size: number };
export type Draft = { id: string; slug: string; code: string; name: string; category: string; tone: 'Straight-faced' | 'Satirical'; description: string; contents: string[]; formats: string[]; compatibility: string; licence: string; priceGBP: number | null; providerVariantId: string; providerDeliveryVerified: boolean; images: Asset[]; archive: Asset | null; state: 'draft' | 'published' | 'archived'; revision: number; updatedAt: string };
type Row = { data: string; state: Draft['state']; revision: number; updated_at: string };
const hydrate = (row: Row): Draft => ({ ...JSON.parse(row.data), state: row.state, revision: row.revision, updatedAt: row.updated_at });
export async function listDrafts(): Promise<Draft[]> { const rows = await database().prepare('SELECT data,state,revision,updated_at FROM products ORDER BY updated_at DESC').all<Row>(); return rows.results.map(hydrate); }
export async function getDraft(id: string): Promise<Draft | null> { const row = await database().prepare('SELECT data,state,revision,updated_at FROM products WHERE id=?').bind(id).first<Row>(); return row ? hydrate(row) : null; }
export type PublishedProduct = Product & { id: string; compatibility: string; licence: string; images: string[]; providerVariantId: string; providerReady: boolean };
function publicProduct(d: Draft): PublishedProduct { return { id: d.id, slug: d.slug, code: d.code, name: d.name, category: d.category, tone: d.tone, description: d.description, contents: d.contents, formats: d.formats, compatibility: d.compatibility, licence: d.licence, status: 'available', priceGBP: d.priceGBP, checkoutUrl: null, image: `/api/media/${d.images[0]?.id}`, images: d.images.map(a => `/api/media/${a.id}`), providerVariantId: d.providerVariantId, providerReady: d.providerDeliveryVerified }; }
export async function listPublished(): Promise<PublishedProduct[]> { const rows = await database().prepare("SELECT data,state,revision,updated_at FROM products WHERE state='published' ORDER BY updated_at DESC").all<Row>(); return rows.results.map(r => publicProduct(hydrate(r))); }
export async function getPublished(slug: string): Promise<PublishedProduct | null> { const row = await database().prepare("SELECT data,state,revision,updated_at FROM products WHERE slug=? AND state='published'").bind(slug).first<Row>(); return row ? publicProduct(hydrate(row)) : null; }
export const publishedProductBySlug = getPublished;
export async function productByVariant(variantId: string): Promise<PublishedProduct | null> { const row = await database().prepare("SELECT data,state,revision,updated_at FROM products WHERE json_extract(data,'$.providerVariantId')=? AND state='published'").bind(variantId).first<Row>(); return row ? publicProduct(hydrate(row)) : null; }
export function editable(input: Record<string, unknown>, previous?: Draft): Draft {
  const base: Draft = previous ?? { id: crypto.randomUUID(), slug: `draft-${crypto.randomUUID().slice(0, 8)}`, code: '', name: '', category: 'Fictional brands', tone: 'Straight-faced', description: '', contents: [], formats: [], compatibility: '', licence: '', priceGBP: null, providerVariantId: '', providerDeliveryVerified: false, images: [], archive: null, state: 'draft', revision: 1, updatedAt: new Date().toISOString() };
  const next = { ...base };
  for (const field of ['slug', 'code', 'name', 'category', 'description', 'compatibility', 'licence', 'providerVariantId'] as const) if (field in input) { if (typeof input[field] !== 'string' || input[field].length > (field === 'licence' ? 20000 : 5000)) throw new HttpError(400, `Invalid ${field}.`); next[field] = input[field].trim(); }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(next.slug) || next.slug.length > 100) throw new HttpError(400, 'Use a URL slug with lowercase letters, numbers and hyphens.');
  for (const field of ['contents', 'formats'] as const) if (field in input) { if (!Array.isArray(input[field]) || input[field].length > 100 || !input[field].every(v => typeof v === 'string' && v.length <= 1000)) throw new HttpError(400, `Invalid ${field}.`); next[field] = input[field].map(v => v.trim()).filter(Boolean); }
  if ('tone' in input) { if (!['Straight-faced', 'Satirical'].includes(String(input.tone))) throw new HttpError(400, 'Invalid tone.'); next.tone = input.tone as Draft['tone']; }
  if ('priceGBP' in input) { if (input.priceGBP !== null && (typeof input.priceGBP !== 'number' || !Number.isFinite(input.priceGBP) || input.priceGBP <= 0 || input.priceGBP > 10000 || Math.abs(input.priceGBP * 100 - Math.round(input.priceGBP * 100)) > .00001)) throw new HttpError(400, 'Enter a positive GBP price with at most two decimal places.'); next.priceGBP = input.priceGBP as number | null; }
  if (previous?.state === 'published') throw new HttpError(409, 'Archive this product before editing it.');
  next.providerDeliveryVerified = false; return next;
}
export function publicationErrors(d: Draft): string[] { const errors: string[] = []; for (const field of ['name', 'code', 'description', 'compatibility', 'licence'] as const) if (!d[field].trim()) errors.push(`${field} is required`); if (!d.contents.length) errors.push('actual file contents are required'); if (!d.formats.length) errors.push('file formats are required'); if (!d.priceGBP || d.priceGBP <= 0) errors.push('a price is required'); if (!/^\d+$/.test(d.providerVariantId)) errors.push('a Lemon Squeezy variant ID is required'); if (!d.archive) errors.push('a delivery archive is required'); if (!d.images.length) errors.push('at least one preview image is required'); return errors; }
export async function saveDraft(d: Draft, expectedRevision?: number): Promise<Draft> {
  const db = database(); const now = new Date().toISOString(); const next = { ...d, revision: expectedRevision === undefined ? 1 : expectedRevision + 1, updatedAt: now };
  try { if (expectedRevision === undefined) await db.prepare('INSERT INTO products (id,slug,state,data,revision,updated_at) VALUES (?,?,?,?,?,?)').bind(next.id, next.slug, next.state, JSON.stringify(next), next.revision, now).run();
    else { const result = await db.prepare('UPDATE products SET slug=?,state=?,data=?,revision=?,updated_at=? WHERE id=? AND revision=?').bind(next.slug, next.state, JSON.stringify(next), next.revision, now, next.id, expectedRevision).run(); if (!result.meta.changes) throw new HttpError(409, 'This product changed. Reload before saving.'); }
  } catch (error) { if (error instanceof Error && error.message.includes('UNIQUE')) throw new HttpError(409, 'That URL slug or provider variant is already used.'); throw error; } return next;
}
