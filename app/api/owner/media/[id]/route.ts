import { serveImage } from '@/lib/server/media';
import { failure, requireOwner } from '@/lib/server/auth';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { try { await requireOwner(request); return await serveImage((await context.params).id, true); } catch (e) { return failure(e); } }
