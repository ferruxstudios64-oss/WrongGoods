import { requireOwner, failure, json } from '@/lib/server/auth';
import { listDrafts, editable, saveDraft } from '@/lib/server/catalog';
import { body } from '@/lib/server/owner';
import {getBindings,setting} from '@/lib/server/env';
export async function GET(request: Request) { try { const email = await requireOwner(request); return json({ products: await listDrafts(), email, capabilities:{uploads:Boolean(setting('SUPABASE_URL') ? setting('SUPABASE_SECRET_KEY') && setting('SUPABASE_PRIVATE_BUCKET') : getBindings().BUCKET)} }); } catch (e) { return failure(e); } }
export async function POST(request: Request) { try { await requireOwner(request); return json({ product: await saveDraft(editable(await body(request))) }, 201); } catch (e) { return failure(e); } }
