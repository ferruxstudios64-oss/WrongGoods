import type { Metadata } from 'next';
import './globals.css';
import { Header, Footer } from '@/components/store';
export const metadata:Metadata={metadataBase:new URL('https://wronggoods.com'),title:{default:'WrongGoods — Fictional brands. Real character.',template:'%s | WrongGoods'},description:'Independent fictional brands, signs and graphic props for games, film and invented worlds. Explore the first WrongGoods collections.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en-GB"><body><a className="skip" href="#main">Skip to content</a><Header/>{children}<Footer/></body></html>}
