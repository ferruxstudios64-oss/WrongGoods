import { requireOwner, failure, json, HttpError } from '@/lib/server/auth';
import { saveDraft } from '@/lib/server/catalog';
import { ownerProduct, body, revision } from '@/lib/server/owner';
export async function DELETE(request: Request, context: { params: Promise<{ id: string; assetId: string }> }) {
  try { await requireOwner(request); const { id, assetId } = await context.params; const p = await ownerProduct(id); revision(await body(request), p.revision);
    if (p.state === 'published') throw new HttpError(409, 'Archive this product before editing its files.');
    if (!p.images.some(a => a.id === assetId) && p.archive?.id !== assetId) throw new HttpError(404, 'File not found.');
    return json({ product: await saveDraft({ ...p, images: p.images.filter(a => a.id !== assetId), archive: p.archive?.id === assetId ? null : p.archive, providerDeliveryVerified: false }, p.revision) });
  } catch (e) { return failure(e); }
}
