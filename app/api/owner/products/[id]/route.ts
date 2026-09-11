import { requireOwner, failure, json, HttpError } from '@/lib/server/auth';
import { editable, saveDraft } from '@/lib/server/catalog';
import { ownerProduct, body, revision } from '@/lib/server/owner';
import { database } from '@/lib/server/env';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) { try { await requireOwner(request); return json({ product: await ownerProduct((await context.params).id) }); } catch (e) { return failure(e); } }
export async function PUT(request: Request, context: Context) { try { await requireOwner(request); const p = await ownerProduct((await context.params).id); const input = await body(request); revision(input, p.revision); return json({ product: await saveDraft(editable(input, p), p.revision) }); } catch (e) { return failure(e); } }
export const PATCH = PUT;
export async function DELETE(request: Request, context: Context) { try { await requireOwner(request); const p = await ownerProduct((await context.params).id); if (p.state !== 'draft') throw new HttpError(409, 'Only unpublished drafts can be deleted.'); const input = await body(request); revision(input, p.revision); const db = database(); const results = await db.batch([
  db.prepare("DELETE FROM assets WHERE product_id=? AND EXISTS (SELECT 1 FROM products WHERE id=? AND revision=? AND state='draft')").bind(p.id, p.id, p.revision),
  db.prepare("DELETE FROM products WHERE id=? AND revision=? AND state='draft'").bind(p.id, p.revision),
]); if (!results[1].meta.changes) throw new HttpError(409, 'Product changed. Reload first.'); return json({ deleted: true }); } catch (e) { return failure(e); } }
