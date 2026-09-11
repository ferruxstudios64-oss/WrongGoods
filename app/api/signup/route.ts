import {env} from 'cloudflare:workers';
import {CustomerError, readCustomerRequest, saveSignup, throttle} from '@/lib/customer';
export async function POST(request: Request) {
  try {
    const body = await readCustomerRequest(request);
    if (!env.DB) throw new CustomerError('Release updates are not connected yet. Please email tawseen@wronggoods.com.', 503);
    await throttle(env.DB, `signup:${request.headers.get('cf-connecting-ip') || 'local'}`);
    return Response.json(await saveSignup(env.DB, body), {headers: {'Cache-Control':'no-store'}});
  } catch (error) {
    return Response.json({error: error instanceof CustomerError ? error.message : 'Your signup was not saved. Please try again or email us.'}, {status: error instanceof CustomerError ? error.status : 503, headers: {'Cache-Control':'no-store'}});
  }
}
