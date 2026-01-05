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

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const sql = neon(connectionString);
    const { action, data } = req.body;

    console.log(`[sync] Ação: ${action}`, data);

    // Garantir que as tabelas existem
    await sql`
      CREATE TABLE IF NOT EXISTS managers (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        cpf TEXT UNIQUE,
        email TEXT,
        permissoes JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    if (action === 'sync_manager') {
      const manager = data;
      if (!manager.id || !manager.username) {
        return res.status(400).json({ error: 'Manager ID e username são obrigatórios' });
      }

      // Upsert: inserir se não existe, atualizar se existe
      const result = await sql`
        INSERT INTO managers (id, username, password, cpf, email, permissoes)
        VALUES (${manager.id}, ${manager.username}, ${manager.password}, ${manager.cpf || null}, ${manager.email || null}, ${JSON.stringify(manager.permissoes || {})})
        ON CONFLICT (id) DO UPDATE SET
          username = ${manager.username},
          password = ${manager.password},
          cpf = ${manager.cpf || null},
          email = ${manager.email || null},
          permissoes = ${JSON.stringify(manager.permissoes || {})}
        RETURNING id;
      `;
      console.log('[sync] Manager salvo com sucesso:', result);
      return res.status(200).json({ success: true, id: result[0]?.id });
    }

    if (action === 'delete_manager') {
      const { id } = data;
      if (!id) {
        return res.status(400).json({ error: 'Manager ID é obrigatório' });
      }

      // Não permitir deletar o usuário master
      if (id === 'master-001') {
        return res.status(403).json({ error: 'Usuário master não pode ser deletado' });
      }

      await sql`DELETE FROM managers WHERE id = ${id}`;
      console.log('[sync] Manager deletado:', id);
      return res.status(200).json({ success: true, deleted: id });
    }

    // Se chegar aqui, ação não reconhecida
    res.status(400).json({ error: `Ação desconhecida: ${action}` });
  } catch (err: any) {
    console.error('[sync] Erro:', err);
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
}
