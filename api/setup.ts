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

    // Drop existing tables to recreate with correct schema
    await sql`DROP TABLE IF EXISTS audit_logs CASCADE;`;
    await sql`DROP TABLE IF EXISTS biometrias CASCADE;`;
    await sql`DROP TABLE IF EXISTS biometrics CASCADE;`;
    await sql`DROP TABLE IF EXISTS pontos CASCADE;`;
    await sql`DROP TABLE IF EXISTS hospitals CASCADE;`;
    await sql`DROP TABLE IF EXISTS managers CASCADE;`;
    await sql`DROP TABLE IF EXISTS cooperados CASCADE;`;
    await sql`DROP TABLE IF EXISTS users CASCADE;`;

    await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`;

    await sql`
      CREATE TABLE cooperados (
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

    await sql`
      CREATE TABLE managers (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        cpf TEXT UNIQUE,
        email TEXT,
        permissoes JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;

    await sql`
      CREATE TABLE hospitals (
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

    await sql`
      CREATE TABLE pontos (
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
        validado_por TEXT,
        justificativa JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;

    await sql`
      CREATE TABLE biometrias (
        id TEXT PRIMARY KEY,
        cooperado_id TEXT NOT NULL REFERENCES cooperados(id) ON DELETE CASCADE,
        finger_index INTEGER,
        hash TEXT NOT NULL,
        created_at TEXT,
        created_at_db TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;

    await sql`
      CREATE TABLE audit_logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        details TEXT,
        timestamp TEXT NOT NULL,
        user_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;

    await sql`
      CREATE TABLE justificativas (
        id TEXT PRIMARY KEY,
        cooperado_id TEXT NOT NULL REFERENCES cooperados(id) ON DELETE CASCADE,
        cooperado_nome TEXT NOT NULL,
        ponto_id TEXT REFERENCES pontos(id) ON DELETE SET NULL,
        motivo TEXT NOT NULL,
        descricao TEXT,
        data_solicitacao TIMESTAMPTZ NOT NULL,
        status TEXT DEFAULT 'Pendente',
        aprovado_por TEXT,
        data_aprovacao TIMESTAMPTZ,
        motivo_rejeicao TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;

    res.status(200).json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
}
