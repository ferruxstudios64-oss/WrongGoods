import { bucket, database } from './env';
import { json } from './auth';
import type { Draft } from './catalog';
export async function serveImage(id: string, owner = false) {
  const row = await database().prepare("SELECT a.object_key,a.mime,p.data,p.state FROM assets a JOIN products p ON p.id=a.product_id WHERE a.id=? AND a.kind='image'").bind(id).first<{ object_key: string; mime: string; data: string; state: string }>();
  if (!row || (!owner && row.state !== 'published')) return json({ error: 'Image not found.' }, 404);
  const draft = JSON.parse(row.data) as Draft; if (!draft.images.some(a => a.id === id)) return json({ error: 'Image not found.' }, 404);
  const object = await bucket().get(row.object_key); if (!object) return json({ error: 'Image not found.' }, 404);
  return new Response(object.body as unknown as BodyInit, { headers: { 'Content-Type': row.mime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
}
