import { setting } from './env';

export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const decode = (part: string) => Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
export async function verifyAccessToken(token: string, issuer: string, audience: string, emails: string[], fetcher: typeof fetch = fetch): Promise<string> {
  try {
    const parts = token.split('.'); if (parts.length !== 3) throw new Error();
    const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    const claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
    const now = Date.now() / 1000;
    if (header.alg !== 'RS256' || !header.kid || claims.iss !== issuer || !Array.isArray(claims.aud) || !claims.aud.includes(audience) || typeof claims.exp !== 'number' || claims.exp <= now || typeof claims.iat !== 'number' || claims.iat > now + 60 || (claims.nbf && claims.nbf > now + 60)) throw new Error();
    const response = await fetcher(`${issuer}/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error();
    const jwks = await response.json() as { keys: (JsonWebKey & { kid?: string })[] };
    const jwk = jwks.keys.find(key => key.kid === header.kid && key.kty === 'RSA'); if (!jwk) throw new Error();
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))) throw new Error();
    const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : '';
    if (!emails.includes(email)) throw new HttpError(403, 'This account does not have owner access.');
    return email;
  } catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(401, 'Sign in through the owner access gateway.'); }
}
export async function requireOwner(request: Request): Promise<string> {
  if (setting('SUPABASE_URL')) return (await import('./supabase-auth')).requireSupabaseOwner(request);
  const issuer = setting('CF_ACCESS_ISSUER').replace(/\/$/, ''); const audience = setting('CF_ACCESS_AUD');
  const emails = setting('OWNER_EMAILS').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) || !audience || !emails.length) throw new HttpError(503, 'Owner access is not configured.');
  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin !== new URL(request.url).origin) throw new HttpError(403, 'Request origin was rejected.');
  }
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) throw new HttpError(401, 'Sign in through the owner access gateway.');
  return verifyAccessToken(token, issuer, audience, emails);
}
export function failure(error: unknown): Response { return Response.json({ error: error instanceof HttpError ? error.message : 'The service is unavailable. Please try again.' }, { status: error instanceof HttpError ? error.status : 503, headers: { 'Cache-Control': 'no-store' } }); }
export function json(data: unknown, status = 200): Response { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } }); }
