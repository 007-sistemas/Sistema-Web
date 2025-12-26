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
      const { id, nome, cpf, email, telefone, especialidade, matricula, status } = data;
      
      await sql`
        INSERT INTO cooperados (id, name, cpf, email, phone, specialty, matricula, status, updated_at)
        VALUES (${id}, ${nome}, ${cpf}, ${email}, ${telefone}, ${especialidade}, ${matricula}, ${status}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = ${nome},
          cpf = ${cpf},
          email = ${email},
          phone = ${telefone},
          matricula = ${matricula},
          specialty = ${especialidade},
          status = ${status},
          updated_at = NOW()
      `;

      return res.status(200).json({ ok: true });
    }

    // Sync Hospital
    if (action === "sync_hospital") {
      const { id, nome, slug, usuarioAcesso, senha, endereco, permissoes, setores } = data;
      await sql`
        INSERT INTO hospitals (id, nome, slug, usuario_acesso, senha, endereco, permissoes, setores)
        VALUES (${id}, ${nome}, ${slug}, ${usuarioAcesso}, ${senha}, ${endereco ? JSON.stringify(endereco) : null}, ${permissoes ? JSON.stringify(permissoes) : null}, ${setores ? JSON.stringify(setores) : null})
        ON CONFLICT (id) DO UPDATE SET
          nome = ${nome},
          slug = ${slug},
          usuario_acesso = ${usuarioAcesso},
          senha = ${senha},
          endereco = ${endereco ? JSON.stringify(endereco) : null},
          permissoes = ${permissoes ? JSON.stringify(permissoes) : null},
          setores = ${setores ? JSON.stringify(setores) : null};
      `;

      return res.status(200).json({ ok: true });
    }

    // Sync Ponto
    if (action === "sync_ponto") {
      const { id, codigo, cooperadoId, cooperadoNome, timestamp, tipo, local, hospitalId, setorId, observacao, relatedId, status, isManual } = data;
      
      await sql`
        INSERT INTO pontos (id, codigo, cooperado_id, cooperado_nome, timestamp, tipo, local, hospital_id, setor_id, observacao, related_id, status, is_manual, created_at)
        VALUES (${id}, ${codigo}, ${cooperadoId}, ${cooperadoNome}, ${timestamp}, ${tipo}, ${local}, ${hospitalId}, ${setorId}, ${observacao}, ${relatedId}, ${status}, ${isManual}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          timestamp = ${timestamp},
          tipo = ${tipo},
          local = ${local},
          codigo = ${codigo},
          cooperado_nome = ${cooperadoNome},
          hospital_id = ${hospitalId},
          setor_id = ${setorId},
          observacao = ${observacao},
          related_id = ${relatedId},
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
    return res.status(500).json({ error: err?.message || "Unknown error", detail: err?.stack || String(err) });
  }
}
