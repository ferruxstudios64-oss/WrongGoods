import {env} from 'cloudflare:workers';
import {CustomerError, readCustomerRequest, saveContact, throttle} from '@/lib/customer';
export async function POST(request: Request) {
  try {
    const body = await readCustomerRequest(request);
    if (!env.DB) throw new CustomerError('The contact form is not connected yet. Please email tawseen@wronggoods.com.', 503);
    await throttle(env.DB, `contact:${request.headers.get('cf-connecting-ip') || 'local'}`, 5);
    return Response.json(await saveContact(env.DB, body), {headers: {'Cache-Control':'no-store'}});
  } catch (error) {
    return Response.json({error: error instanceof CustomerError ? error.message : 'Your enquiry was not saved. Please email tawseen@wronggoods.com.'}, {status: error instanceof CustomerError ? error.status : 503, headers: {'Cache-Control':'no-store'}});
  }
}
