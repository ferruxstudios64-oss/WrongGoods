import {database} from '@/lib/server/env';
import {CustomerError, readCustomerRequest, saveSignup, throttle} from '@/lib/customer';
export async function POST(request: Request) {
  try {
    const body = await readCustomerRequest(request);
    const db = database();
    await throttle(db, `signup:${request.headers.get('cf-connecting-ip') || 'local'}`);
    return Response.json(await saveSignup(db, body), {headers: {'Cache-Control':'no-store'}});
  } catch (error) {
    return Response.json({error: error instanceof CustomerError ? error.message : 'Your signup was not saved. Please try again or email us.'}, {status: error instanceof CustomerError ? error.status : 503, headers: {'Cache-Control':'no-store'}});
  }
}
