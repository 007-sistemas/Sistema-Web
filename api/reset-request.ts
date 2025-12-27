import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

const connectionString = process.env.DATABASE_URL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESET_FROM_EMAIL || 'no-reply@digitall.app';

const hashCode = (code: string) => crypto.createHash('sha256').update(code).digest('hex');
const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

function sendCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function sendEmail(to: string, code: string, username: string) {
  if (!RESEND_API_KEY) {
    console.warn('[RESET] RESEND_API_KEY ausente. Código:', code);
    return { sent: false, reason: 'RESEND_API_KEY missing' };
  }

  const payload = {
    from: FROM_EMAIL,
    to,
    subject: 'DigitAll - Código de redefinição de senha',
    text: `Olá ${username},\n\nUse este código para redefinir sua senha: ${code}\nEle expira em 15 minutos.\n\nSe não foi você, ignore este email.`,
  };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[RESET] Falha ao enviar email:', text);
    return { sent: false, reason: text };
  }

  return { sent: true };
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

    // Garantir tabela de resets
    await sql`CREATE TABLE IF NOT EXISTS password_resets (
      id text PRIMARY KEY,
      manager_id text NOT NULL,
      code_hash text NOT NULL,
      expires_at timestamptz NOT NULL,
      used boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    );`;

    // Parse seguro do body
    let parsed: any = req.body;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
    }
    const { identifier } = parsed || {};
    if (!identifier) return res.status(400).json({ error: 'identifier é obrigatório (usuário ou email)' });

    const managers = await sql`
      SELECT id, username, email FROM managers 
      WHERE username = ${identifier} OR email = ${identifier}
      LIMIT 1
    `;

    // Resposta genérica para não vazar existência de usuário
    if (!managers || managers.length === 0) {
      return res.status(200).json({ ok: true, message: 'Se existir, o código foi enviado.' });
    }

    const manager = managers[0];
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const codeHash = hashCode(code);
    const resetId = crypto.randomUUID();

    await sql`DELETE FROM password_resets WHERE manager_id = ${manager.id} AND used = false;`;
    await sql`
      INSERT INTO password_resets (id, manager_id, code_hash, expires_at, used)
      VALUES (${resetId}, ${manager.id}, ${codeHash}, ${expiresAt}, false)
    `;

    const emailResult = manager.email ? await sendEmail(manager.email, code, manager.username) : { sent: false };

    const response: any = { ok: true, expiresAt, emailSent: emailResult.sent };
    if (process.env.NODE_ENV !== 'production') {
      response.devCode = code; // Facilita teste em dev
    }

    return res.status(200).json(response);
  } catch (err: any) {
    console.error('[RESET] Erro geral:', err);
    return res.status(500).json({ error: err?.message || 'Erro desconhecido' });
  }
}
