import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const env = readFileSync('.env.local','utf8');
const secret = env.match(/^BOARD_API_SECRET=(.+)$/m)?.[1]?.trim();
if (!secret || !/^[a-f0-9]{64}$/.test(secret)) throw new Error('Set BOARD_API_SECRET to a random 32-byte hex value in .env.local first.');
const schema = readFileSync('supabase/schema.sql','utf8').replaceAll('__BOARD_SECRET_SHA256__',createHash('sha256').update(secret).digest('hex'));
mkdirSync('work',{recursive:true});
writeFileSync('work/schema-configured.sql',schema);
console.log('Prepared work/schema-configured.sql. It contains the hash, not the secret.');
