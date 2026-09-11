import {CustomerForm} from '@/components/customer-forms';
export const metadata = {title:'Contact'};
export default function Contact() { return <main id="main" className="prose"><span className="eyebrow">DIRECT LINE / NO HOLD MUSIC</span><h1>TELL US ABOUT IT.</h1><p className="lead">A world in progress. A release question. A missing receipt.</p><p>Use the form or email <a className="text-link" href="mailto:tawseen@wronggoods.com">tawseen@wronggoods.com</a>.</p><CustomerForm kind="contact"/></main>; }
