import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {validateOwnerToken,OWNER_COOKIE} from '@/lib/server/supabase-auth';

export const metadata={robots:{index:false,follow:false}};

export default async function GoodsLayout({children}:{children:React.ReactNode}){
  const token=(await cookies()).get(OWNER_COOKIE)?.value||'';
  try{await validateOwnerToken(token);}catch{redirect('/owner');}
  return children;
}
