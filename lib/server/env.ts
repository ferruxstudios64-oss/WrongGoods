import { env } from 'cloudflare:workers';
import {supabaseDatabase} from './supabase-database';
import {supabaseStorage} from './supabase';

export type Bindings = { DB?: D1Database; BUCKET?: R2Bucket; [key: string]: unknown };
export function getBindings(): Bindings { return env as unknown as Bindings; }
export function setting(name: string): string { const value = getBindings()[name]; return typeof value === 'string' ? value : ''; }
export function supabaseConfig() {return {url:setting('SUPABASE_URL'),key:setting('SUPABASE_SECRET_KEY'),bucket:setting('SUPABASE_PRIVATE_BUCKET')};}
export function database(): D1Database { if(setting('SUPABASE_URL'))return supabaseDatabase(supabaseConfig());const db = getBindings().DB; if (!db) throw new Error('Database is not configured.'); return db; }
export function bucket(): Pick<R2Bucket,'put'|'get'|'head'|'delete'> { if(setting('SUPABASE_URL')){const config=supabaseConfig();if(!config.bucket)throw new Error('Private storage is not configured.');return supabaseStorage(config) as unknown as Pick<R2Bucket,'put'|'get'|'head'|'delete'>;}const store = getBindings().BUCKET; if (!store) throw new Error('Private storage is not configured.'); return store; }
