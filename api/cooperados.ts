import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!connectionString) {
    res.status(500).json({ error: "Missing DATABASE_URL env var" });
    return;
  }

  const sql = neon(connectionString);

  try {
    if (req.method === "GET") {
      const rows = await sql`SELECT id, name, cpf, email, phone, created_at FROM cooperados ORDER BY created_at DESC LIMIT 100`;
      res.status(200).json(rows);
      return;
    }

    if (req.method === "POST") {
      const { name, cpf, email, phone } = req.body || {};
      if (!name) {
        res.status(400).json({ error: "Missing name" });
        return;
      }
      const rows = await sql`INSERT INTO cooperados (name, cpf, email, phone) VALUES (${name}, ${cpf}, ${email}, ${phone}) RETURNING id`;
      res.status(201).json({ id: rows[0]?.id });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
}
