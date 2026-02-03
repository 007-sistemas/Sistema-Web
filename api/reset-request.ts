import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

const connectionString = process.env.DATABASE_URL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESET_FROM_EMAIL || 'no-reply@idev.app';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const hashCode = (code: string) => crypto.createHash('sha256').update(code).digest('hex');
const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

function sendCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function sendEmail(to: string, code: string, username: string) {
  // 1) Preferir SMTP se estiver configurado
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    try {
      // @ts-ignore - módulo será resolvido em produção (Vercel)
      const nodemailerMod: any = await import('nodemailer');
      const transporter = nodemailerMod.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
      const info = await transporter.sendMail({
        from: FROM_EMAIL || SMTP_USER,
        to,
        subject: 'Idev - Código de redefinição de senha',
        text: `Olá ${username},\n\nUse este código para redefinir sua senha: ${code}\nEle expira em 15 minutos.\n\nSe não foi você, ignore este email.`,
      });
      console.log('[RESET] SMTP enviado. MessageId:', (info as any)?.messageId);
      return { sent: true, smtp: true };
    } catch (smtpErr: any) {
      console.error('[RESET] Falha SMTP:', smtpErr?.message || smtpErr);
      // Continua tentando via Resend se disponível
    }
  }

  // 2) Tentar Resend se chave estiver presente
  if (RESEND_API_KEY) {
    // Se FROM_EMAIL for um domínio não verificado (ex. Gmail), usar o remetente de onboarding
    const fromCandidate = (!FROM_EMAIL || FROM_EMAIL.endsWith('@gmail.com'))
      ? 'onboarding@resend.dev'
      : FROM_EMAIL;

    const payload = {
      from: fromCandidate,
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
      console.error('[RESET] Falha ao enviar email via Resend:', text);
      return { sent: false, reason: text };
    }
    return { sent: true, resend: true };
  }

  console.warn('[RESET] Nenhum provedor de email configurado. Código (dev):', code);
  return { sent: false, reason: 'No email provider configured' };
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

    // Verificar cooldown: impedir múltiplas solicitações em curto intervalo
    const recentResets = await sql`
      SELECT id, created_at, expires_at, used FROM password_resets
      WHERE manager_id = ${manager.id}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (recentResets && recentResets.length > 0) {
      const last = recentResets[0] as any;
      const createdAt = new Date(last.created_at);
      const ageMs = Date.now() - createdAt.getTime();
      const cooldownMs = 2 * 60 * 1000; // 2 minutos de cooldown
      if (!last.used && ageMs < cooldownMs) {
        const retrySeconds = Math.ceil((cooldownMs - ageMs) / 1000);
        res.setHeader('Retry-After', String(retrySeconds));
        return res.status(429).json({ ok: false, error: 'Aguarde antes de solicitar novo código.', retryAfter: retrySeconds });
      }
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const codeHash = hashCode(code);
    const resetId = crypto.randomUUID();

    // Limpar códigos anteriores não utilizados para evitar confusão
    await sql`DELETE FROM password_resets WHERE manager_id = ${manager.id} AND used = false;`;

    await sql`
      INSERT INTO password_resets (id, manager_id, code_hash, expires_at, used)
      VALUES (${resetId}, ${manager.id}, ${codeHash}, ${expiresAt}, false)
    `;

    const emailResult = manager.email ? await sendEmail(manager.email, code, manager.username) : { sent: false, reason: 'No email configured' };
    const provider = (emailResult as any)?.smtp ? 'smtp' : (emailResult as any)?.resend ? 'resend' : undefined;
    const response: any = { ok: true, expiresAt, emailSent: emailResult.sent, provider };

    // Sempre retornar motivo do erro se houver, para facilitar suporte
    if (!emailResult.sent && (emailResult as any)?.reason) {
      response.emailError = (emailResult as any).reason;
    }

    // Em não-produção, incluir código para testes manuais
    const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
    if (!isProd) {
      response.devCode = code;
    }

    return res.status(200).json(response);
  } catch (err: any) {
    console.error('[RESET] Erro geral:', err);
    return res.status(500).json({ error: err?.message || 'Erro desconhecido' });
  }
}
