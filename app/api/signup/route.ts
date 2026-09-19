import {database} from '@/lib/server/env';
import {CustomerError, readCustomerRequest, saveSignup, throttle} from '@/lib/customer';
import {confirmSignup,savedButEmailFailed} from '@/lib/server/signup-confirmation';

export async function POST(request: Request) {
  try {
    const body = await readCustomerRequest(request);
    const db = database();
    const requestKey=request.headers.get('cf-connecting-ip') || 'local';
    await throttle(db, `signup:${requestKey}`);
    await saveSignup(db, body);
    const address=String(body.email).trim().toLowerCase();
    try {
      const message=await confirmSignup(address,requestKey);
      return Response.json({message},{headers:{'Cache-Control':'no-store'}});
    } catch(error) {
      console.error('Signup saved but confirmation delivery failed.',error);
      return Response.json({error:savedButEmailFailed},{status:502,headers:{'Cache-Control':'no-store'}});
    }
  } catch (error) {
    return Response.json({error: error instanceof CustomerError ? error.message : 'Your signup was not saved. Please try again or email us.'}, {status: error instanceof CustomerError ? error.status : 503, headers: {'Cache-Control':'no-store'}});
  }
}
