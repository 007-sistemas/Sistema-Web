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
    const { cooperadoId } = req.query;

    let rows;
    
    if (cooperadoId) {
      // Buscar pontos de um cooperado específico
      rows = await sql`
        SELECT 
          id, codigo, cooperado_id as "cooperadoId", cooperado_nome as "cooperadoNome",
          date, tipo, entrada, saida, hospital_id as "hospitalId", setor_id as "setorId",
          local, observacao, related_id as "relatedId", status, is_manual as "isManual",
          validado_por as "validadoPor", justificativa,
          biometria_entrada_hash as "biometriaEntradaHash", 
          biometria_saida_hash as "biometriaSaidaHash",
          timestamp, created_at as "createdAt"
        FROM pontos 
        WHERE cooperado_id = ${cooperadoId as string}
        ORDER BY timestamp DESC
      `;
    } else {
      // Buscar todos os pontos
      rows = await sql`
        SELECT 
          id, codigo, cooperado_id as "cooperadoId", cooperado_nome as "cooperadoNome",
          date, tipo, entrada, saida, hospital_id as "hospitalId", setor_id as "setorId",
          local, observacao, related_id as "relatedId", status, is_manual as "isManual",
          validado_por as "validadoPor", justificativa,
          biometria_entrada_hash as "biometriaEntradaHash", 
          biometria_saida_hash as "biometriaSaidaHash",
          timestamp, created_at as "createdAt"
        FROM pontos 
        ORDER BY timestamp DESC
      `;
    }

    res.status(200).json(rows);
  } catch (err: any) {
    console.error('[pontos] Erro:', err);
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
}
