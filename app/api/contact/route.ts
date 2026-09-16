import {database} from '@/lib/server/env';
import {CustomerError, readCustomerRequest, saveContact, throttle} from '@/lib/customer';
export async function POST(request: Request) {
  try {
    const body = await readCustomerRequest(request);
    const db = database();
    await throttle(db, `contact:${request.headers.get('cf-connecting-ip') || 'local'}`, 5);
    return Response.json(await saveContact(db, body), {headers: {'Cache-Control':'no-store'}});
  } catch (error) {
    return Response.json({error: error instanceof CustomerError ? error.message : 'Your enquiry was not saved. Please email hello@wronggoods.com.'}, {status: error instanceof CustomerError ? error.status : 503, headers: {'Cache-Control':'no-store'}});
  }
}
