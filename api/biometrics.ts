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
      const rows = await sql`SELECT b.id, b.cooperado_id, b.device_id, b.captured_at FROM biometrics b ORDER BY b.captured_at DESC LIMIT 100`;
      res.status(200).json(rows);
      return;
    }

    if (req.method === "POST") {
      const { cooperado_id, template, device_id } = req.body || {};
      if (!cooperado_id || !template) {
        res.status(400).json({ error: "Missing cooperado_id or template" });
        return;
      }
      const rows = await sql`INSERT INTO biometrics (cooperado_id, template, device_id) VALUES (${cooperado_id}, ${template}, ${device_id}) RETURNING id`;
      res.status(201).json({ id: rows[0]?.id });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
}
