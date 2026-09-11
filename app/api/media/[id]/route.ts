import { serveImage } from '@/lib/server/media';
import { failure } from '@/lib/server/auth';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) { try { return await serveImage((await context.params).id); } catch (e) { return failure(e); } }
