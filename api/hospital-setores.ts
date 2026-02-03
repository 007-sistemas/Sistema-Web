import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!connectionString) {
    return res.status(500).json({ error: 'DATABASE_URL não configurada' });
  }

  const sql = neon(connectionString);

  try {
    // GET /api/hospital-setores?hospitalId=xxx - Listar setores de um hospital
    if (req.method === 'GET') {
      const { hospitalId } = req.query;
      if (!hospitalId) {
        return res.status(400).json({ error: 'hospitalId é obrigatório' });
      }

      const setores = await sql`
        SELECT s.id, s.nome 
        FROM setores s
        INNER JOIN hospital_setores hs ON s.id = hs.setor_id
        WHERE hs.hospital_id = ${hospitalId as string}
        ORDER BY s.nome ASC
      `;
      return res.status(200).json(setores);
    }

    // POST /api/hospital-setores { hospitalId, setorId } - Vincular setor a hospital
    if (req.method === 'POST') {
      const { hospitalId, setorId } = req.body;
      if (!hospitalId || !setorId) {
        return res.status(400).json({ error: 'hospitalId e setorId são obrigatórios' });
      }

      await sql`
        INSERT INTO hospital_setores (hospital_id, setor_id) 
        VALUES (${hospitalId}, ${setorId})
        ON CONFLICT DO NOTHING
      `;
      return res.status(201).json({ ok: true });
    }

    // DELETE /api/hospital-setores?hospitalId=xxx&setorId=yyy - Desvincular setor
    if (req.method === 'DELETE') {
      const { hospitalId, setorId } = req.query;
      if (!hospitalId || !setorId) {
        return res.status(400).json({ error: 'hospitalId e setorId são obrigatórios' });
      }

      await sql`
        DELETE FROM hospital_setores 
        WHERE hospital_id = ${hospitalId as string} 
        AND setor_id = ${setorId as string}
      `;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (err: any) {
    console.error('[HOSPITAL-SETORES API] Erro:', err);
    return res.status(500).json({ error: err.message || 'Erro desconhecido' });
  }
}
