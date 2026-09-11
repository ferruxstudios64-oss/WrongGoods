// Server-only HTTPS transport. No privileged key is exported to client components.
export type SupabaseSettings = { url: string; key: string; bucket: string };
export async function supabaseRequest(config: SupabaseSettings, path: string, init: RequestInit = {}) {
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.url) || !config.key) throw new Error('Supabase is not configured.');
  const response = await fetch(config.url + path, { ...init, headers: { apikey: config.key, ...(config.key.startsWith('eyJ') ? { Authorization: `Bearer ${config.key}` } : {}), ...init.headers }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
  return response;
}
export async function rpc(config: SupabaseSettings, operations: {name: string; args: unknown[]}[]) {
  const response = await supabaseRequest(config, '/rest/v1/rpc/wg_storefront_batch', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({operations}) });
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as {code?: string};
    if (error.code === '23505') throw new Error('UNIQUE constraint conflict.');
    throw new Error('Supabase database request failed.');
  }
  return response.json() as Promise<{results: Record<string, unknown>[]; success: boolean; meta:{changes:number}}[]>;
}
export function supabaseStorage(config: SupabaseSettings) {
  const path = (key: string) => `/storage/v1/object/${encodeURIComponent(config.bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;
  return {
    async put(key: string, bytes: Uint8Array, options?: {httpMetadata?:{contentType?:string}}) {
      const response = await supabaseRequest(config,path(key),{method:'POST',headers:{'Content-Type':options?.httpMetadata?.contentType||'application/octet-stream','x-upsert':'false'},body:bytes as BodyInit});
      if (!response.ok) throw new Error('Private file upload failed.');
    },
    async get(key: string) { const response=await supabaseRequest(config,path(key)); if(response.status===404||response.status===400)return null; if(!response.ok)throw new Error('Private storage is unavailable.');return {body:response.body}; },
    async head(key: string) { const response=await supabaseRequest(config,path(key),{method:'HEAD'});if(response.status===404||response.status===400)return null;if(!response.ok)throw new Error('Private storage is unavailable.');return {key}; },
    async delete(key: string) { const response=await supabaseRequest(config,`/storage/v1/object/${encodeURIComponent(config.bucket)}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[key]})});if(!response.ok)throw new Error('Private file removal failed.'); },
  };
}
