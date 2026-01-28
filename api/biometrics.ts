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
      // Buscar todos os campos relevantes para o frontend
      const rows = await sql`SELECT b.id, b.cooperado_id, b.finger_index, b.hash, b.created_at, b.template FROM biometrias b ORDER BY b.created_at DESC LIMIT 100`;
      res.status(200).json(rows);
      return;
    }

    if (req.method === "DELETE") {
      // Aceita id tanto por query quanto por body
      let id = req.query.id;
      if (!id && req.body) {
        try {
          const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
          id = body.id;
        } catch {}
      }
      if (!id) {
        res.status(400).json({ error: "Missing biometria id" });
        return;
      }
      try {
        await sql`DELETE FROM biometrias WHERE id = ${id}`;
        res.status(204).end();
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "Unknown error" });
      }
      return;
    }


    if (req.method === "POST") {
      const { cooperado_id, template, device_id } = req.body || {};
      if (!cooperado_id || !template) {
        res.status(400).json({ error: "Missing cooperado_id or template" });
        return;
      }
      const rows = await sql`INSERT INTO biometrias (cooperado_id, template, device_id) VALUES (${cooperado_id}, ${template}, ${device_id}) RETURNING id`;
      res.status(201).json({ id: rows[0]?.id });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
}
