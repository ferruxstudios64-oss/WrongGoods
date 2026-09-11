import {products as concepts, type Product} from '@/lib/catalog';
import {listPublished} from '@/lib/server/catalog';
export async function storefrontCatalogue(): Promise<{products: Product[]; unavailable: boolean}> {
  try {
    const published = await listPublished();
    return {products: [...published, ...concepts.filter(c => !published.some(p => p.slug === c.slug))], unavailable: false};
  } catch { return {products: concepts, unavailable: true}; }
}
