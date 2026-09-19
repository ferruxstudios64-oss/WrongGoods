import {products as concepts, type Product} from '@/lib/catalog';
import {listPublished} from '@/lib/server/catalog';

const retiredSlugs=new Set(['public-notice','false-authority']);

export async function storefrontCatalogue(): Promise<{products: Product[]; unavailable: boolean}> {
  try {
    const published=(await listPublished()).filter(product=>!retiredSlugs.has(product.slug));
    return {products: [...published, ...concepts.filter(c => !published.some(p => p.slug === c.slug))], unavailable: false};
  } catch {
    return {products: concepts, unavailable: true};
  }
}
