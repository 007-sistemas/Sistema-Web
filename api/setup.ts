import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";

// Expects DATABASE_URL set in Vercel project environment variables
const connectionString = process.env.DATABASE_URL;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!connectionString) {
    res.status(500).json({ error: "Missing DATABASE_URL env var" });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const sql = neon(connectionString);

    // Create tables if they do not exist
    await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`;

    await sql`
      CREATE TABLE IF NOT EXISTS cooperados (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cpf TEXT UNIQUE,
        email TEXT,
        phone TEXT,
        specialty TEXT,
        matricula TEXT,
        status TEXT DEFAULT 'ATIVO',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;

    // Garantir colunas novas
    await sql`ALTER TABLE cooperados ADD COLUMN IF NOT EXISTS matricula TEXT;`;
    await sql`ALTER TABLE cooperados ADD COLUMN IF NOT EXISTS specialty TEXT;`;
    await sql`ALTER TABLE cooperados ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ATIVO';`;

    await sql`
      CREATE TABLE IF NOT EXISTS hospitals (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        slug TEXT UNIQUE,
        usuario_acesso TEXT,
        senha TEXT,
        endereco JSONB,
        permissoes JSONB,
        setores JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;

    await sql`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS slug TEXT;`;
    await sql`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS usuario_acesso TEXT;`;
    await sql`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS senha TEXT;`;
    await sql`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS endereco JSONB;`;
    await sql`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS permissoes JSONB;`;
    await sql`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS setores JSONB;`;

    await sql`
      CREATE TABLE IF NOT EXISTS pontos (
        id TEXT PRIMARY KEY,
        codigo TEXT,
        cooperado_id TEXT NOT NULL REFERENCES cooperados(id) ON DELETE CASCADE,
        cooperado_nome TEXT,
        timestamp TEXT NOT NULL,
        tipo TEXT NOT NULL,
        local TEXT,
        hospital_id TEXT,
        setor_id TEXT,
        observacao TEXT,
        related_id TEXT,
        status TEXT DEFAULT 'Aberto',
        is_manual BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;

    await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS codigo TEXT;`;
    await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS cooperado_nome TEXT;`;
    await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS hospital_id TEXT;`;
    await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS setor_id TEXT;`;
    await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS observacao TEXT;`;
    await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS related_id TEXT;`;

    await sql`
      CREATE TABLE IF NOT EXISTS biometrias (
        id TEXT PRIMARY KEY,
        cooperado_id TEXT NOT NULL REFERENCES cooperados(id) ON DELETE CASCADE,
        finger_index INTEGER,
        hash TEXT NOT NULL,
        created_at TEXT,
        created_at_db TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        details TEXT,
        timestamp TEXT NOT NULL,
        user_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;

    res.status(200).json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
}
