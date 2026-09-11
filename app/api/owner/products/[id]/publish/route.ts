import { requireOwner, failure, json, HttpError } from '@/lib/server/auth';
import { publicationErrors, saveDraft } from '@/lib/server/catalog';
import { ownerProduct, body, revision } from '@/lib/server/owner';
import { bucket } from '@/lib/server/env';
import { verifyProviderVariant } from '@/lib/server/commerce';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireOwner(request); const p = await ownerProduct((await context.params).id); const input = await body(request); revision(input, p.revision);
    if (input.confirm !== true || input.providerDeliveryVerified !== true) throw new HttpError(400, 'Preview the product and confirm that the provider delivery files match your uploaded archive.');
    const errors = publicationErrors(p); if (errors.length) throw new HttpError(409, `Cannot publish: ${errors.join('; ')}.`);
    for (const asset of [...p.images, p.archive!]) if (!await bucket().head(asset.key)) throw new HttpError(409, `Stored file missing: ${asset.name}. Upload it again.`);
    try { await verifyProviderVariant(p.providerVariantId, p.priceGBP!, p.archive!.name); }
    catch (error) { throw new HttpError(409, error instanceof Error ? error.message : 'Provider delivery could not be verified.'); }
    return json({ product: await saveDraft({ ...p, state: 'published', providerDeliveryVerified: true }, p.revision) });
  } catch (e) { return failure(e); }
}
