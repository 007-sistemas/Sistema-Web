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

  const sql = neon(connectionString);

  try {
    if (req.method === 'GET') {
      // Garantir colunas esperadas em bases antigas
      await sql`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS usuario_acesso text`;
      await sql`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS senha text`;
      await sql`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS endereco jsonb`;
      await sql`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS permissoes jsonb`;
      await sql`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS setores jsonb`;

      const rows = await sql`SELECT id, nome, slug, usuario_acesso, senha, endereco, permissoes, setores FROM hospitals ORDER BY created_at DESC`;
      res.status(200).json(rows);
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
}
