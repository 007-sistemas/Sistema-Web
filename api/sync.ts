import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;

export default async function handler(req: any, res: any) {
  if (!connectionString) {
    return res.status(500).json({ error: "Missing DATABASE_URL env var" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const sql = neon(connectionString);

    // Parse body defensivamente: em produção o Vercel já entrega JSON, mas
    // chamadas manuais (curl) podem chegar como string.
    let parsed = req.body;

    // Vercel (Node) pode entregar req.body já parseado, string ou stream.
    if (!parsed) {
      // Ler stream manualmente (Node runtime)
      const chunks: any[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      if (chunks.length) {
        parsed = Buffer.concat(chunks).toString();
      }
    }

    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch (err) {
        return res.status(400).json({ error: "Invalid JSON" });
      }
    }

    const { action, data } = parsed || {};

    if (!action || !data) {
      return res.status(400).json({ error: "Missing action or data" });
    }

    // Sync Cooperados
    if (action === "sync_cooperado") {
      const { id, nome, cpf, email, telefone, especialidade, status } = data;
      
      await sql`
        INSERT INTO cooperados (id, name, cpf, email, phone, specialty, status, updated_at)
        VALUES (${id}, ${nome}, ${cpf}, ${email}, ${telefone}, ${especialidade}, ${status}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = ${nome},
          cpf = ${cpf},
          email = ${email},
          phone = ${telefone},
          specialty = ${especialidade},
          status = ${status},
          updated_at = NOW()
      `;

      return res.status(200).json({ ok: true });
    }

    // Sync Ponto
    if (action === "sync_ponto") {
      const { id, cooperadoId, timestamp, tipo, local, status, isManual } = data;
      
      await sql`
        INSERT INTO pontos (id, cooperado_id, timestamp, tipo, local, status, is_manual, created_at)
        VALUES (${id}, ${cooperadoId}, ${timestamp}, ${tipo}, ${local}, ${status}, ${isManual}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          timestamp = ${timestamp},
          tipo = ${tipo},
          local = ${local},
          status = ${status},
          is_manual = ${isManual}
      `;

      return res.status(200).json({ ok: true });
    }

    // Sync Biometria
    if (action === "sync_biometria") {
      const { id, cooperadoId, fingerIndex, hash, createdAt } = data;
      
      await sql`
        INSERT INTO biometrias (id, cooperado_id, finger_index, hash, created_at)
        VALUES (${id}, ${cooperadoId}, ${fingerIndex}, ${hash}, ${createdAt})
        ON CONFLICT (id) DO UPDATE SET
          finger_index = ${fingerIndex},
          hash = ${hash}
      `;

      return res.status(200).json({ ok: true });
    }

    // Sync Audit Log
    if (action === "sync_audit") {
      const { id, action: auditAction, details, timestamp, user } = data;
      
      await sql`
        INSERT INTO audit_logs (id, action, details, timestamp, user_id)
        VALUES (${id}, ${auditAction}, ${details}, ${timestamp}, ${user})
      `;

      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err: any) {
    console.error("[SYNC ERROR]", err);
    return res.status(500).json({ error: err?.message || "Unknown error" });
  }
}
