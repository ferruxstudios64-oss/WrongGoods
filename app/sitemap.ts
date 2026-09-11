import {storefrontCatalogue} from '@/lib/storefront';
export default async function sitemap(){const {products}=await storefrontCatalogue();return ['','/about','/licence','/privacy','/contact',...products.map(p=>`/goods/${p.slug}`)].map(path=>({url:`https://wronggoods.com${path}`}))}
