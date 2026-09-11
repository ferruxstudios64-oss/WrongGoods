import {NextResponse, type NextRequest} from 'next/server';
export function middleware(request: NextRequest) {
  const response=NextResponse.next();
  response.headers.set('X-Content-Type-Options','nosniff');
  response.headers.set('X-Frame-Options','DENY');
  response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  if(!['wronggoods.com','www.wronggoods.com'].includes(request.nextUrl.hostname)||/^\/(owner|order|api)(\/|$)/.test(request.nextUrl.pathname)) response.headers.set('X-Robots-Tag','noindex, nofollow');
  return response;
}
