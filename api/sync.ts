import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!connectionString) {
    res.status(500).json({ error: 'Missing DATABASE_URL env var' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const sql = neon(connectionString);
    const { action, data } = req.body;

    console.log(`[sync] Ação: ${action}`, data);

    // Garantir que as tabelas existem
    await sql`
      CREATE TABLE IF NOT EXISTS managers (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        cpf TEXT UNIQUE,
        email TEXT,
        permissoes JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS justificativas (
        id TEXT PRIMARY KEY,
        cooperado_id TEXT NOT NULL,
        cooperado_nome TEXT,
        tipo TEXT NOT NULL,
        data TEXT NOT NULL,
        entrada TEXT,
        saida TEXT,
        motivo TEXT,
        observacao TEXT,
        status TEXT DEFAULT 'Pendente',
        aprovado_por TEXT,
        data_aprovacao TEXT,
        motivo_rejeicao TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS pontos (
        id TEXT PRIMARY KEY,
        cooperado_id TEXT NOT NULL,
        cooperado_nome TEXT,
        data TEXT NOT NULL,
        tipo TEXT NOT NULL,
        entrada TEXT,
        saida TEXT,
        hospital_id TEXT,
        setor_id TEXT,
        biometria_entrada_hash TEXT,
        biometria_saida_hash TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    if (action === 'sync_manager') {
      const manager = data;
      if (!manager.id || !manager.username) {
        return res.status(400).json({ error: 'Manager ID e username são obrigatórios' });
      }

      // Upsert: inserir se não existe, atualizar se existe
      const result = await sql`
        INSERT INTO managers (id, username, password, cpf, email, permissoes)
        VALUES (${manager.id}, ${manager.username}, ${manager.password}, ${manager.cpf || null}, ${manager.email || null}, ${JSON.stringify(manager.permissoes || {})})
        ON CONFLICT (id) DO UPDATE SET
          username = ${manager.username},
          password = ${manager.password},
          cpf = ${manager.cpf || null},
          email = ${manager.email || null},
          permissoes = ${JSON.stringify(manager.permissoes || {})}
        RETURNING id;
      `;
      console.log('[sync] Manager salvo com sucesso:', result);
      return res.status(200).json({ success: true, id: result[0]?.id });
    }

    if (action === 'delete_manager') {
      const { id } = data;
      if (!id) {
        return res.status(400).json({ error: 'Manager ID é obrigatório' });
      }

      // Não permitir deletar o usuário master
      if (id === 'master-001') {
        return res.status(403).json({ error: 'Usuário master não pode ser deletado' });
      }

      await sql`DELETE FROM managers WHERE id = ${id}`;
      console.log('[sync] Manager deletado:', id);
      return res.status(200).json({ success: true, deleted: id });
    }

    if (action === 'sync_justificativa') {
      const j = data;
      if (!j.id || !j.cooperadoId) {
        return res.status(400).json({ error: 'Justificativa ID e cooperadoId são obrigatórios' });
      }

      const result = await sql`
        INSERT INTO justificativas (
          id, cooperado_id, cooperado_nome, tipo, data, entrada, saida, 
          motivo, observacao, status, aprovado_por, data_aprovacao, motivo_rejeicao
        )
        VALUES (
          ${j.id}, ${j.cooperadoId}, ${j.cooperadoNome || null}, ${j.tipo}, ${j.data},
          ${j.entrada || null}, ${j.saida || null}, ${j.motivo || null}, ${j.observacao || null},
          ${j.status || 'Pendente'}, ${j.aprovadoPor || null}, ${j.dataAprovacao || null}, ${j.motivoRejeicao || null}
        )
        ON CONFLICT (id) DO UPDATE SET
          tipo = ${j.tipo},
          entrada = ${j.entrada || null},
          saida = ${j.saida || null},
          motivo = ${j.motivo || null},
          observacao = ${j.observacao || null},
          status = ${j.status || 'Pendente'},
          aprovado_por = ${j.aprovadoPor || null},
          data_aprovacao = ${j.dataAprovacao || null},
          motivo_rejeicao = ${j.motivoRejeicao || null}
        RETURNING id;
      `;
      console.log('[sync] Justificativa salva:', result);
      return res.status(200).json({ success: true, id: result[0]?.id });
    }

    if (action === 'sync_ponto') {
      const p = data;
      if (!p.id || !p.cooperadoId) {
        return res.status(400).json({ error: 'Ponto ID e cooperadoId são obrigatórios' });
      }

      const result = await sql`
        INSERT INTO pontos (
          id, cooperado_id, cooperado_nome, data, tipo, entrada, saida,
          hospital_id, setor_id, biometria_entrada_hash, biometria_saida_hash
        )
        VALUES (
          ${p.id}, ${p.cooperadoId}, ${p.cooperadoNome || null}, ${p.data}, ${p.tipo},
          ${p.entrada || null}, ${p.saida || null}, ${p.hospitalId || null}, ${p.setorId || null},
          ${p.biometriaEntradaHash || null}, ${p.biometriaSaidaHash || null}
        )
        ON CONFLICT (id) DO UPDATE SET
          tipo = ${p.tipo},
          entrada = ${p.entrada || null},
          saida = ${p.saida || null},
          hospital_id = ${p.hospitalId || null},
          setor_id = ${p.setorId || null},
          biometria_entrada_hash = ${p.biometriaEntradaHash || null},
          biometria_saida_hash = ${p.biometriaSaidaHash || null}
        RETURNING id;
      `;
      console.log('[sync] Ponto salvo:', result);
      return res.status(200).json({ success: true, id: result[0]?.id });
    }

    // Suporte a outras ações (hospital, cooperado, etc.)
    if (action === 'sync_cooperado' || action === 'sync_hospital' || action === 'delete_cooperado' || action === 'delete_hospital') {
      console.log(`[sync] ⚠️ Ação ${action} não implementada ainda, ignorando...`);
      return res.status(200).json({ success: true, message: 'Ação registrada (não implementada)' });
    }

    // Se chegar aqui, ação não reconhecida
    res.status(400).json({ error: `Ação desconhecida: ${action}` });
  } catch (err: any) {
    console.error('[sync] Erro:', err);
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
}
