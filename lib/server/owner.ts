import { HttpError } from './auth';
import { getDraft } from './catalog';
export async function ownerProduct(id: string) { const product = await getDraft(id); if (!product) throw new HttpError(404, 'Product not found.'); return product; }
export async function body(request: Request): Promise<Record<string, unknown>> { if (Number(request.headers.get('content-length') || 0) > 50000) throw new HttpError(413, 'Request too large.'); try { const text = await request.text(); if (text.length > 50000) throw new Error(); const data = JSON.parse(text); if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error(); return data; } catch { throw new HttpError(400, 'Invalid request.'); } }
export function revision(input: Record<string, unknown>, current: number) { if (input.revision !== current) throw new HttpError(409, 'This product changed. Reload before continuing.'); }
