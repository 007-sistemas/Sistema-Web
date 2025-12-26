import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!connectionString) return res.status(500).json({ error: "Missing DATABASE_URL" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const sql = neon(connectionString);

    // 1) Deduplicar hospitals por slug (mantém o mais recente)
    const r1 = await sql`
      WITH ranked AS (
        SELECT id, slug, created_at,
               ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at DESC) AS rn
        FROM hospitals
      )
      DELETE FROM hospitals h
      USING ranked r
      WHERE h.id = r.id AND r.rn > 1
      RETURNING h.id
    `;

    // 2) Garantir cooperados para pontos órfãos
    const r2 = await sql`
      INSERT INTO cooperados (id, name, created_at, updated_at)
      SELECT p.cooperado_id, COALESCE(p.cooperado_nome, 'Sem Nome'), NOW(), NOW()
      FROM pontos p
      LEFT JOIN cooperados c ON c.id = p.cooperado_id
      WHERE c.id IS NULL
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
      RETURNING id
    `;

    // 3) Deduplicar managers por username (mantém o mais recente)
    const r3 = await sql`
      WITH ranked AS (
        SELECT id, username, created_at,
               ROW_NUMBER() OVER (PARTITION BY username ORDER BY created_at DESC) AS rn
        FROM managers
      )
      DELETE FROM managers m
      USING ranked r
      WHERE m.id = r.id AND r.rn > 1
      RETURNING m.id
    `;

    // 4) Garantir cooperados para biometrias órfãs
    const r4 = await sql`
      INSERT INTO cooperados (id, name, created_at, updated_at)
      SELECT b.cooperado_id, 'Sem Nome', NOW(), NOW()
      FROM biometrias b
      LEFT JOIN cooperados c ON c.id = b.cooperado_id
      WHERE c.id IS NULL
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `;

    // 5) Ajustar justificativas órfãs
    const r5a = await sql`
      UPDATE justificativas j
      SET ponto_id = NULL
      WHERE j.ponto_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM pontos p WHERE p.id = j.ponto_id)
      RETURNING j.id
    `;

    const r5b = await sql`
      INSERT INTO cooperados (id, name, created_at, updated_at)
      SELECT j.cooperado_id, COALESCE(j.cooperado_nome, 'Sem Nome'), NOW(), NOW()
      FROM justificativas j
      LEFT JOIN cooperados c ON c.id = j.cooperado_id
      WHERE c.id IS NULL
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `;

    res.status(200).json({
      ok: true,
      changes: {
        hospitalsDedup: r1.length,
        cooperadosFromPontos: r2.length,
        managersDedup: r3.length,
        cooperadosFromBiometrias: r4.length,
        justificativasNullPonto: r5a.length,
        cooperadosFromJustificativas: r5b.length,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
}
