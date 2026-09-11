import { requireOwner, failure, json } from '@/lib/server/auth';
import { listDrafts, editable, saveDraft } from '@/lib/server/catalog';
import { body } from '@/lib/server/owner';
export async function GET(request: Request) { try { const email = await requireOwner(request); return json({ products: await listDrafts(), email }); } catch (e) { return failure(e); } }
export async function POST(request: Request) { try { await requireOwner(request); return json({ product: await saveDraft(editable(await body(request))) }, 201); } catch (e) { return failure(e); } }
