import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";
import { normalizeNome } from "../services/normalize";

const connectionString = process.env.DATABASE_URL;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (!connectionString) {
    res.status(500).json({ error: "Missing DATABASE_URL env var" });
    return;
  }

  const sql = neon(connectionString);

  try {
    // Atualiza todos os nomes para caixa alta e sem acento
    await sql`
      UPDATE cooperados
      SET name = upper(unaccent(name))
      WHERE name IS NOT NULL
    `;
    res.status(200).json({ message: `Nomes atualizados com sucesso!` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
}
