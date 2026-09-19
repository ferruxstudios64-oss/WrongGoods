import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {validateAdminSession,ADMIN_COOKIE} from '@/lib/server/admin-auth';

export const metadata={robots:{index:false,follow:false}};

export default async function GoodsLayout({children}:{children:React.ReactNode}){
  const token=(await cookies()).get(ADMIN_COOKIE)?.value||'';
  try{await validateAdminSession(token);}catch{redirect('/owner');}
  return children;
}
