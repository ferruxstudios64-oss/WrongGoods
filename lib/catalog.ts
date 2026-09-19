export type Product = {slug:string; code:string; name:string; category:string; tone:'Straight-faced'|'Satirical'; description:string; contents:string[]; formats:string[]; status:'in-development'|'available'; priceGBP:number|null; checkoutUrl:string|null; image:string; images?:string[]; compatibility?:string; licence?:string; providerReady?:boolean};

// Publish only after the downloadable files, licence and hosted checkout have been verified.
export const products:Product[] = [
  {
    slug:'dayshift',
    code:'WG-EF-001',
    name:'DAYSHIFT',
    category:'World systems',
    tone:'Straight-faced',
    description:'A British neighbourhood convenience-store world. Identity, packaging, signage, shelf graphics, paperwork and everyday store props built as one coherent system.',
    contents:[
      'Core DAYSHIFT identity system',
      'Storefront and environmental signage',
      'Packaging and carrier-bag artwork',
      'Shelf, price and promotional graphics',
      'Receipt, document and everyday print assets',
      'Production notes and usage guidance'
    ],
    formats:['Final formats confirmed at release'],
    status:'in-development',
    priceGBP:null,
    checkoutUrl:null,
    image:'/images/dayshift.webp'
  }
];

export const categories=['All goods','World systems','Signs & graphics','Props & paperwork'];
export function purchasable(p:Product){return p.status==='available' && typeof p.priceGBP==='number' && Number.isFinite(p.priceGBP) && p.priceGBP>0 && p.providerReady===true;}
