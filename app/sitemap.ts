import {products} from '@/lib/catalog';
export default function sitemap(){return ['','/about','/licence','/privacy',...products.map(p=>`/goods/${p.slug}`)].map(path=>({url:`https://wronggoods.com${path}`}))}
