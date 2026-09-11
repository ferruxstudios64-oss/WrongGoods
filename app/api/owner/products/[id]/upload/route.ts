import { requireOwner, failure, json, HttpError } from '@/lib/server/auth';
import { saveDraft } from '@/lib/server/catalog';
import { ownerProduct } from '@/lib/server/owner';
import { bucket, database } from '@/lib/server/env';
import { ARCHIVE_LIMIT, inspectUpload } from '@/lib/server/uploads';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireOwner(request); const p = await ownerProduct((await context.params).id);
    if (p.state === 'published') throw new HttpError(409, 'Archive this product before editing its files.');
    const length = Number(request.headers.get('content-length')); if (!Number.isFinite(length) || length <= 0) throw new HttpError(411, 'A content length is required.'); if (length > ARCHIVE_LIMIT + 1024 * 1024) throw new HttpError(413, 'Upload is too large.');
    const form = await request.formData(); const file = form.get('file'); const kind = String(form.get('kind'));
    if (!(file instanceof File)) throw new HttpError(400, 'Choose a file.'); if (kind === 'image' && p.images.length >= 12) throw new HttpError(400, 'A product supports up to 12 images.');
    const bytes = new Uint8Array(await file.arrayBuffer()); const type = inspectUpload(bytes, kind, file.name); const id = crypto.randomUUID(); const key = `${kind}/${p.id}/${id}`;
    const asset = { id, key, name: file.name.replace(/[\\/\x00-\x1f]/g, '_').slice(0, 200), type, size: bytes.length };
    await bucket().put(key, bytes, { httpMetadata: { contentType: type } });
    try { await database().prepare('INSERT INTO assets (id,product_id,object_key,kind,name,mime,size) VALUES (?,?,?,?,?,?,?)').bind(id, p.id, key, kind, asset.name, type, bytes.length).run();
      const product = await saveDraft({ ...p, images: kind === 'image' ? [...p.images, asset] : p.images, archive: kind === 'archive' ? asset : p.archive, providerDeliveryVerified: false }, p.revision); return json({ product });
    } catch (e) { await bucket().delete(key); await database().prepare('DELETE FROM assets WHERE id=?').bind(id).run(); throw e; }
  } catch (e) { return failure(e); }
}
