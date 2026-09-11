import { requireOwner, failure, json } from '@/lib/server/auth';
import { saveDraft } from '@/lib/server/catalog';
import { ownerProduct, body, revision } from '@/lib/server/owner';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { try { await requireOwner(request); const p = await ownerProduct((await context.params).id); revision(await body(request), p.revision); return json({ product: await saveDraft({ ...p, state: 'archived' }, p.revision) }); } catch (e) { return failure(e); } }
