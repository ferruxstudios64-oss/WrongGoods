export default function sitemap(){
  return ['','/about','/licence','/terms','/refunds','/privacy','/contact'].map(path=>({url:`https://wronggoods.com${path}`}));
}