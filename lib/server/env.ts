import { env } from 'cloudflare:workers';

export type Bindings = { DB?: D1Database; BUCKET?: R2Bucket; [key: string]: unknown };
export function getBindings(): Bindings { return env as unknown as Bindings; }
export function setting(name: string): string { const value = getBindings()[name]; return typeof value === 'string' ? value : ''; }
export function database(): D1Database { const db = getBindings().DB; if (!db) throw new Error('Database is not configured.'); return db; }
export function bucket(): R2Bucket { const store = getBindings().BUCKET; if (!store) throw new Error('Private storage is not configured.'); return store; }
