import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!connectionString) return res.status(500).json({ error: "Missing DATABASE_URL" });
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const sql = neon(connectionString);

    const duplicateHospitals = await sql`
      SELECT slug, COUNT(*) as qty
      FROM hospitals
      GROUP BY slug
      HAVING COUNT(*) > 1
    `;

    const orphanPontos = await sql`
      SELECT p.id, p.cooperado_id, p.cooperado_nome
      FROM pontos p
      LEFT JOIN cooperados c ON c.id = p.cooperado_id
      WHERE c.id IS NULL
    `;

    const duplicateManagers = await sql`
      SELECT username, COUNT(*) as qty
      FROM managers
      GROUP BY username
      HAVING COUNT(*) > 1
    `;

    const orphanBiometrias = await sql`
      SELECT b.id, b.cooperado_id
      FROM biometrias b
      LEFT JOIN cooperados c ON c.id = b.cooperado_id
      WHERE c.id IS NULL
    `;

    const orphanJustificativasCoop = await sql`
      SELECT j.id, j.cooperado_id
      FROM justificativas j
      LEFT JOIN cooperados c ON c.id = j.cooperado_id
      WHERE c.id IS NULL
    `;

    const orphanJustificativasPonto = await sql`
      SELECT j.id, j.ponto_id
      FROM justificativas j
      LEFT JOIN pontos p ON p.id = j.ponto_id
      WHERE j.ponto_id IS NOT NULL AND p.id IS NULL
    `;

    res.status(200).json({
      ok: true,
      summary: {
        duplicateHospitals: duplicateHospitals.length,
        orphanPontos: orphanPontos.length,
        duplicateManagers: duplicateManagers.length,
        orphanBiometrias: orphanBiometrias.length,
        orphanJustificativasCoop: orphanJustificativasCoop.length,
        orphanJustificativasPonto: orphanJustificativasPonto.length,
      },
      details: {
        duplicateHospitals,
        orphanPontos,
        duplicateManagers,
        orphanBiometrias,
        orphanJustificativasCoop,
        orphanJustificativasPonto,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
}
