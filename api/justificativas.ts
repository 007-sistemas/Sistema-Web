import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
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
    const rows = await sql`
      SELECT 
        id,
        cooperado_id      AS "cooperadoId",
        cooperado_nome    AS "cooperadoNome",
        ponto_id          AS "pontoId",
        motivo,
        descricao,
        data_solicitacao  AS "dataSolicitacao",
        status,
        aprovado_por      AS "aprovadoPor",
        rejeitado_por     AS "rejeitadoPor",
        motivo_rejeicao   AS "motivoRejeicao",
        setor_id          AS "setorId",
        created_at        AS "createdAt",
        updated_at        AS "updatedAt",
        data_aprovacao    AS "dataAprovacao"
      FROM justificativas
      ORDER BY data_solicitacao DESC
    `;

    res.status(200).json(rows);
  } catch (err: any) {
    console.error('[justificativas] Erro:', err);
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
}
