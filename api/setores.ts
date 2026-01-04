import { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL!;
const sql = neon(connectionString);

// POST /api/setores { nome }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'nome obrigatório' });
    try {
      const inserted = await sql`
        INSERT INTO setores (nome) 
        VALUES (${nome})
        RETURNING id, nome
      `;
      return res.status(201).json(inserted[0]);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'GET') {
    try {
      const result = await sql`SELECT id, nome FROM setores ORDER BY nome ASC`;
      return res.status(200).json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'PUT') {
    const { id, nome } = req.body;
    if (!id || !nome) return res.status(400).json({ error: 'id e nome obrigatórios' });
    try {
      await sql`UPDATE setores SET nome = ${nome} WHERE id = ${id}`;
      const updated = await sql`SELECT id, nome FROM setores WHERE id = ${id}`;
      return res.status(200).json(updated[0]);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id obrigatório' });
    try {
      // Primeiro, remover relacionamentos em hospital_setores
      await sql`DELETE FROM hospital_setores WHERE setor_id = ${id as string}`;
      // Depois, remover o setor
      await sql`DELETE FROM setores WHERE id = ${id as string}`;
      return res.status(200).json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).json({ error: 'Método não permitido' });
}
