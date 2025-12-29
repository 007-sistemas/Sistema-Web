import { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL!;
const sql = neon(connectionString);

// POST /api/setores { id, nome }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    const { id, nome } = req.body;
    if (!id || !nome) return res.status(400).json({ error: 'id e nome obrigatórios' });
    try {
      await sql`INSERT INTO setores (id, nome) VALUES (${id}, ${nome})`;
      return res.status(201).json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }
  if (req.method === 'GET') {
    try {
      const result = await sql`SELECT * FROM setores`;
      return res.status(200).json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }
  res.status(405).json({ error: 'Método não permitido' });
}
