import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const rows = await sql`SELECT id, username, password, cpf, email, permissoes FROM managers ORDER BY created_at DESC`;
    res.status(200).json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
}
