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
        status TEXT DEFAULT 'ATIVO',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS biometrics (
        id TEXT PRIMARY KEY,
        cooperado_id TEXT NOT NULL REFERENCES cooperados(id) ON DELETE CASCADE,
        template TEXT,
        device_id TEXT,
        captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS pontos (
        id TEXT PRIMARY KEY,
        cooperado_id TEXT NOT NULL REFERENCES cooperados(id) ON DELETE CASCADE,
        timestamp TEXT NOT NULL,
        tipo TEXT NOT NULL,
        local TEXT,
        status TEXT DEFAULT 'Aberto',
        is_manual BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;

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
