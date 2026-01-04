import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

const connectionString = process.env.DATABASE_URL;
const hashCode = (code: string) => crypto.createHash('sha256').update(code).digest('hex');

function sendCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  sendCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!connectionString) {
    return res.status(500).json({ error: 'Missing DATABASE_URL env var' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = neon(connectionString);

    await sql`CREATE TABLE IF NOT EXISTS password_resets (
      id text PRIMARY KEY,
      manager_id text NOT NULL,
      code_hash text NOT NULL,
      expires_at timestamptz NOT NULL,
      used boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    );`;

    let parsed: any = req.body;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
    }

    const { identifier, code, newPassword } = parsed || {};
    if (!identifier || !code || !newPassword) {
      return res.status(400).json({ error: 'identifier, code e newPassword são obrigatórios' });
    }

    // Validação básica de força da senha
    const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPassword);
    if (!strong) {
      return res.status(400).json({ error: 'Senha fraca. Use no mínimo 8 caracteres, com letras maiúsculas, minúsculas e números.' });
    }

    const managers = await sql`
      SELECT id, username FROM managers WHERE username = ${identifier} OR email = ${identifier} LIMIT 1
    `;
    if (!managers || managers.length === 0) {
      return res.status(400).json({ error: 'Código inválido ou expirado' });
    }
    const manager = managers[0];

    const resets = await sql`
      SELECT * FROM password_resets
      WHERE manager_id = ${manager.id} AND used = false AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!resets || resets.length === 0) {
      return res.status(400).json({ error: 'Código inválido ou expirado' });
    }

    const resetRow = resets[0];
    const incomingHash = hashCode(code);
    if (incomingHash !== resetRow.code_hash) {
      return res.status(400).json({ error: 'Código inválido ou expirado' });
    }

    await sql`
      UPDATE managers SET password = ${newPassword} WHERE id = ${manager.id}
    `;

    await sql`
      UPDATE password_resets SET used = true WHERE id = ${resetRow.id}
    `;

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[RESET-CONFIRM] Erro geral:', err);
    return res.status(500).json({ error: err?.message || 'Erro desconhecido' });
  }
}
