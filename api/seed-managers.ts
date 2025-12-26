import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!connectionString) {
    res.status(500).json({ error: 'Missing DATABASE_URL env var' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const sql = neon(connectionString);

    // Garantir colunas esperadas
    await sql`ALTER TABLE managers ADD COLUMN IF NOT EXISTS cpf text`;
    await sql`ALTER TABLE managers ADD COLUMN IF NOT EXISTS email text`;
    await sql`ALTER TABLE managers ADD COLUMN IF NOT EXISTS permissoes jsonb DEFAULT '{}'::jsonb`;

    // Verificar se já existem gestores
    const existing = await sql`SELECT COUNT(*) as cnt FROM managers`;
    if (existing[0]?.cnt > 0) {
      res.status(200).json({ message: 'Managers already exist', count: existing[0].cnt });
      return;
    }

    // Inserir gestor padrão (master)
    const defaultPerms = {
      dashboard: true,
      ponto: true,
      relatorio: true,
      cadastro: true,
      hospitais: true,
      biometria: true,
      auditoria: true,
      gestao: true,
      espelho: false,
      autorizacao: true,
      perfil: true
    };

    const master = await sql`
      INSERT INTO managers (username, password, cpf, email, permissoes, created_at, updated_at)
      VALUES (
        'gabriel',
        'gabriel',
        '000.000.000-00',
        'gabriel@coop.com',
        ${JSON.stringify(defaultPerms)}::jsonb,
        NOW(),
        NOW()
      )
      RETURNING id, username, email
    `;

    res.status(200).json({
      message: 'Master user created',
      user: master[0]
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
}
