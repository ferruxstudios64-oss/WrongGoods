import {rpc,type SupabaseSettings} from './supabase';
import {queryNames} from './supabase-queries';

// Preserve the repository's prepared-query interface while moving execution to
// fixed Postgres operations. Batch calls are one Postgres transaction.
export function supabaseDatabase(config: SupabaseSettings): D1Database {
  class Statement {
    constructor(readonly name: string, readonly args: unknown[] = []) {}
    bind(...args: unknown[]) { return new Statement(this.name,args); }
    async all<T>() { return (await rpc(config,[this]))[0] as unknown as D1Result<T>; }
    async run<T>() { return this.all<T>(); }
    async first<T>() { return (await this.all<T>()).results[0] ?? null; }
  }
  return {
    prepare(query: string) { const name=queryNames[query.replace(/\s+/g,' ').trim()];if(!name)throw new Error('Unsupported database operation.');return new Statement(name); },
    async batch(statements: Statement[]) {return rpc(config,statements);},
  } as unknown as D1Database;
}
