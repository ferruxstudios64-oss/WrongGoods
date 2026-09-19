import type { Metadata } from 'next';
import './globals.css';
import { Header, Footer } from '@/app/storefront-ui';

export const metadata:Metadata={
  metadataBase:new URL('https://wronggoods.com'),
  title:{default:'WrongGoods — Fictional worlds need real brands.',template:'%s | WrongGoods'},
  description:'Independent fictional brand systems and production-ready graphic assets for games, film, television and invented worlds.',
  icons:{icon:'/brand/wg-mark-yellow.svg'}
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en-GB"><body><a className="skip" href="#main">Skip to content</a><Header/>{children}<Footer/></body></html>
}