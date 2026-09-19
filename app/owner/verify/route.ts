import {verifyAdminLink} from '@/lib/server/admin-auth';
export async function GET(request:Request){return verifyAdminLink(request);}
