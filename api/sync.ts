import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;

export default async function handler(req: any, res: any) {
  console.log('[SYNC] Requisição recebida:', req.method);
  
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
        console.error('[SYNC] Erro ao parsear JSON:', err);
        return res.status(400).json({ error: "Invalid JSON" });
      }
    }

    const { action, data } = parsed || {};
    console.log('[SYNC] Action:', action, 'Data keys:', data ? Object.keys(data) : 'none');

    if (!action || !data) {
      console.error('[SYNC] Missing action or data');
      return res.status(400).json({ error: "Missing action or data" });
    }

    // Sync Cooperados
    if (action === "sync_cooperado") {
      console.log('[SYNC] Sincronizando cooperado:', data.id);
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

      console.log('[SYNC] Cooperado sincronizado com sucesso');
      return res.status(200).json({ ok: true });
    }

    // Sync Manager
    if (action === "sync_manager") {
      console.log('[SYNC] Sincronizando manager:', data.id);
      const { id, username, password, permissoes } = data;

      // 1) Tenta atualizar pelo ID
      const byId = await sql`SELECT id FROM managers WHERE id = ${id}`;
      if (byId && byId.length > 0) {
        await sql`
          UPDATE managers
          SET username = ${username},
              password = ${password},
              permissoes = ${permissoes ? JSON.stringify(permissoes) : null}
          WHERE id = ${id}
        `;
        console.log('[SYNC] Manager atualizado por id');
        return res.status(200).json({ ok: true });
      }

      // 2) Se não existe por ID, tenta atualizar pelo username (único)
      const byUser = await sql`SELECT id FROM managers WHERE username = ${username}`;
      if (byUser && byUser.length > 0) {
        await sql`
          UPDATE managers
          SET password = ${password},
              permissoes = ${permissoes ? JSON.stringify(permissoes) : null}
          WHERE username = ${username}
        `;
        console.log('[SYNC] Manager atualizado por username');
        return res.status(200).json({ ok: true });
      }

      // 3) Caso não exista, insere novo
      await sql`
        INSERT INTO managers (id, username, password, permissoes)
        VALUES (${id}, ${username}, ${password}, ${permissoes ? JSON.stringify(permissoes) : null})
      `;
      console.log('[SYNC] Manager inserido');
      return res.status(200).json({ ok: true });
    }

    // Sync Hospital
    if (action === "sync_hospital") {
      console.log('[SYNC] Sincronizando hospital:', data.id);
      const { id, nome, slug, usuarioAcesso, senha, endereco, permissoes, setores } = data;
      
      // Primeiro tenta deletar se existir com slug diferente
      await sql`DELETE FROM hospitals WHERE slug = ${slug} AND id != ${id}`;
      
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
          setores = ${setores ? JSON.stringify(setores) : null}
      `;

      console.log('[SYNC] Hospital sincronizado com sucesso');
      return res.status(200).json({ ok: true });
    }

    // Sync Ponto
    if (action === "sync_ponto") {
      console.log('[SYNC] Sincronizando ponto:', data.id);
      const { id, codigo, cooperadoId, cooperadoNome, timestamp, tipo, local, hospitalId, setorId, observacao, relatedId, status, isManual, validadoPor, justificativa } = data;
      
      // Verificar se cooperado existe antes de inserir
      const cooperadoExists = await sql`SELECT id FROM cooperados WHERE id = ${cooperadoId}`;
      if (!cooperadoExists || cooperadoExists.length === 0) {
        console.warn(`[SYNC] Cooperado ${cooperadoId} não encontrado, ignorando ponto ${id}`);
        return res.status(200).json({ ok: true, skipped: true });
      }
      
      await sql`
        INSERT INTO pontos (id, codigo, cooperado_id, cooperado_nome, timestamp, tipo, local, hospital_id, setor_id, observacao, related_id, status, is_manual, validado_por, justificativa, created_at)
        VALUES (${id}, ${codigo}, ${cooperadoId}, ${cooperadoNome}, ${timestamp}, ${tipo}, ${local}, ${hospitalId}, ${setorId}, ${observacao}, ${relatedId}, ${status}, ${isManual}, ${validadoPor}, ${justificativa ? JSON.stringify(justificativa) : null}, NOW())
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
          is_manual = ${isManual},
          validado_por = ${validadoPor},
          justificativa = ${justificativa ? JSON.stringify(justificativa) : null}
      `;

      console.log('[SYNC] Ponto sincronizado com sucesso');
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
        ON CONFLICT (id) DO NOTHING
      `;

      return res.status(200).json({ ok: true });
    }

    // Sync Justificativa
    if (action === "sync_justificativa") {
      console.log('[SYNC] Sincronizando justificativa:', data.id);
      const { id, cooperadoId, cooperadoNome, pontoId, motivo, descricao, dataSolicitacao, status, aprovadoPor, dataAprovacao, motivoRejeicao } = data;
      
      await sql`
        INSERT INTO justificativas (id, cooperado_id, cooperado_nome, ponto_id, motivo, descricao, data_solicitacao, status, aprovado_por, data_aprovacao, motivo_rejeicao, updated_at)
        VALUES (${id}, ${cooperadoId}, ${cooperadoNome}, ${pontoId}, ${motivo}, ${descricao}, ${dataSolicitacao}, ${status}, ${aprovadoPor}, ${dataAprovacao}, ${motivoRejeicao}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          status = ${status},
          aprovado_por = ${aprovadoPor},
          data_aprovacao = ${dataAprovacao},
          motivo_rejeicao = ${motivoRejeicao},
          updated_at = NOW()
      `;

      console.log('[SYNC] Justificativa sincronizada com sucesso');
      return res.status(200).json({ ok: true });
    }

    // Delete Manager
    if (action === "delete_manager") {
      console.log('[SYNC] Excluindo manager:', data.id);
      await sql`DELETE FROM managers WHERE id = ${data.id}`;
      console.log('[SYNC] Manager excluído com sucesso');
      return res.status(200).json({ ok: true });
    }

    // Delete Cooperado
    if (action === "delete_cooperado") {
      console.log('[SYNC] Excluindo cooperado:', data.id);
      await sql`DELETE FROM cooperados WHERE id = ${data.id}`;
      console.log('[SYNC] Cooperado excluído com sucesso');
      return res.status(200).json({ ok: true });
    }

    // Delete Hospital
    if (action === "delete_hospital") {
      console.log('[SYNC] Excluindo hospital:', data.id);
      await sql`DELETE FROM hospitals WHERE id = ${data.id}`;
      console.log('[SYNC] Hospital excluído com sucesso');
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err: any) {
    console.error("[SYNC ERROR]", err);
    return res.status(500).json({ error: err?.message || "Unknown error", detail: err?.stack || String(err) });
  }
}
