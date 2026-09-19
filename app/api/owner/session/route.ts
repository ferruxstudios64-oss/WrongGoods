import {requestAdminLink,signOutAdmin} from '@/lib/server/admin-auth';
import {failure} from '@/lib/server/auth';
import {CustomerError} from '@/lib/customer';
export async function POST(request:Request){try{return await requestAdminLink(request);}catch(error){if(error instanceof CustomerError)return Response.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}});return failure(error);}}
export async function DELETE(request:Request){try{return await signOutAdmin(request);}catch(error){return failure(error);}}
