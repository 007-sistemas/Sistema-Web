import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
  if (!connectionString) {
    res.status(500).json({ error: 'Missing DATABASE_URL env var' });
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const sql = neon(connectionString);

    // Garante colunas esperadas em bases antigas
    await sql`ALTER TABLE managers ADD COLUMN IF NOT EXISTS cpf text`;
    await sql`ALTER TABLE managers ADD COLUMN IF NOT EXISTS email text`;
    await sql`ALTER TABLE managers ADD COLUMN IF NOT EXISTS permissoes jsonb DEFAULT '{}'::jsonb`;
    await sql`ALTER TABLE managers ADD COLUMN IF NOT EXISTS preferences jsonb`;

    const rows = await sql`SELECT id, username, password, cpf, email, permissoes, preferences FROM managers ORDER BY created_at DESC`;
    res.status(200).json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
}
