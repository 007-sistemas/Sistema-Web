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
      await sql`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS permissoes jsonb`;

      const rows = await sql`SELECT id, nome, slug, usuario_acesso, senha, permissoes FROM hospitals ORDER BY created_at DESC`;
      res.status(200).json(rows);
      return;
    }

    if (req.method === 'POST') {
      const { id, nome, slug, usuarioAcesso, senha, permissoes } = req.body;
      
      if (!id || !nome || !usuarioAcesso || !senha) {
        res.status(400).json({ error: 'Campos obrigatórios: id, nome, usuarioAcesso, senha' });
        return;
      }

      await sql`
        INSERT INTO hospitals (id, nome, slug, usuario_acesso, senha, permissoes, created_at)
        VALUES (
          ${id}, 
          ${nome}, 
          ${slug || nome.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10)},
          ${usuarioAcesso},
          ${senha},
          ${JSON.stringify(permissoes || {})},
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          nome = EXCLUDED.nome,
          slug = EXCLUDED.slug,
          usuario_acesso = EXCLUDED.usuario_acesso,
          senha = EXCLUDED.senha,
          permissoes = EXCLUDED.permissoes
      `;

      res.status(201).json({ ok: true, id });
      return;
    }

    if (req.method === 'PUT') {
      const { id, nome, slug, usuarioAcesso, senha, permissoes } = req.body;
      
      if (!id) {
        res.status(400).json({ error: 'Campo obrigatório: id' });
        return;
      }

      await sql`
        UPDATE hospitals SET
          nome = ${nome},
          slug = ${slug},
          usuario_acesso = ${usuarioAcesso},
          senha = ${senha},
          permissoes = ${JSON.stringify(permissoes || {})}
        WHERE id = ${id}
      `;

      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id) {
        res.status(400).json({ error: 'Campo obrigatório: id' });
        return;
      }

      await sql`DELETE FROM hospitals WHERE id = ${id as string}`;
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
}
