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

  try {
    const sql = neon(connectionString);

    // GET helpers (evita criar novo endpoint para listar justificativas)
    if (req.method === 'GET') {
      const actionParam = (req.query.action || req.query.resource || '').toString();
      if (actionParam === 'list_justificativas') {
        const rows = await sql`
          SELECT 
            j.id,
            j.cooperado_id      AS "cooperadoId",
            j.cooperado_nome    AS "cooperadoNome",
            j.ponto_id          AS "pontoId",
            j.motivo,
            j.descricao,
            j.data_solicitacao  AS "dataSolicitacao",
            j.status,
            j.aprovado_por      AS "aprovadoPor",
            j.rejeitado_por     AS "rejeitadoPor",
            j.motivo_rejeicao   AS "motivoRejeicao",
            j.setor_id          AS "setorId",
            j.created_at        AS "createdAt",
            j.updated_at        AS "updatedAt",
            j.data_aprovacao    AS "dataAprovacao",
            p.timestamp         AS "pontoTimestamp",
            p.entrada           AS "pontoEntrada",
            p.saida             AS "pontoSaida",
            p.tipo              AS "pontoTipo",
            p.date              AS "pontoDate",
            p.related_id        AS "pontoRelatedId"
          FROM justificativas j
          LEFT JOIN pontos p ON p.id = j.ponto_id
          ORDER BY j.data_solicitacao DESC
        `;

        return res.status(200).json(rows);
      }

      res.status(400).json({ error: 'Ação GET não suportada' });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { action, data } = req.body;

    console.log(`[sync] Ação: ${action}`, data);

    // Garantir que a tabela managers existe
    await sql`
      CREATE TABLE IF NOT EXISTS managers (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        cpf TEXT UNIQUE,
        email TEXT,
        permissoes JSONB DEFAULT '{}'::jsonb,
        preferences JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    try {
      await sql`ALTER TABLE managers ADD COLUMN IF NOT EXISTS preferences JSONB`;
    } catch (alterErr) {
      console.log('[sync] Erro ao garantir coluna preferences:', alterErr);
    }

    // Garantir que a tabela justificativas existe com o schema alinhado ao frontend
    await sql`
      CREATE TABLE IF NOT EXISTS justificativas (
        id TEXT PRIMARY KEY,
        cooperado_id TEXT NOT NULL,
        cooperado_nome TEXT,
        ponto_id TEXT,
        motivo TEXT,
        descricao TEXT,
        data_solicitacao TEXT,
        status TEXT DEFAULT 'Pendente',
        aprovado_por TEXT,
        rejeitado_por TEXT,
        motivo_rejeicao TEXT,
        setor_id TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // Tentar adicionar/ajustar colunas que possam estar faltando em bancos existentes
    try {
      await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS ponto_id TEXT`;
      await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS descricao TEXT`;
      await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS data_solicitacao TEXT`;
      await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS rejeitado_por TEXT`;
      await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS setor_id TEXT`;
      await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`;
      // Antigas colunas (tipo, date, entrada, saida, observacao) não são mais usadas
    } catch (alterErr) {
      console.log('[sync] Aviso ao ajustar schema de justificativas:', alterErr);
    }

    // Para a tabela pontos, verificar se as colunas existem e adicionar se necessário
    await sql`
      CREATE TABLE IF NOT EXISTS pontos (
        id TEXT PRIMARY KEY,
        cooperado_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
    
    // Adicionar colunas que podem estar faltando na tabela pontos
    try {
      await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS codigo TEXT`;
      await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS cooperado_nome TEXT`;
      await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS date TEXT`;
      await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS tipo TEXT`;
      await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS entrada TEXT`;
      await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS saida TEXT`;
      await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS hospital_id TEXT`;
      await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS setor_id TEXT`;
      await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS biometria_entrada_hash TEXT`;
      await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS biometria_saida_hash TEXT`;
      await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS related_id TEXT`;
      await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS status TEXT`;
      await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS is_manual BOOLEAN`;
      await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS local TEXT`;
      await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS validado_por TEXT`;
      await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS rejeitado_por TEXT`;
      await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS motivo_rejeicao TEXT`;
    } catch (alterErr) {
      console.log('[sync] Erro ao adicionar colunas (pode ser ignorado se já existirem):', alterErr);
    }

    if (action === 'sync_manager') {
      const manager = data;
      if (!manager.id || !manager.username) {
        return res.status(400).json({ error: 'Manager ID e username são obrigatórios' });
      }

      // Upsert: inserir se não existe, atualizar se existe
      const result = await sql`
        INSERT INTO managers (id, username, password, cpf, email, permissoes, preferences)
        VALUES (
          ${manager.id},
          ${manager.username},
          ${manager.password},
          ${manager.cpf || null},
          ${manager.email || null},
          ${JSON.stringify(manager.permissoes || {})},
          ${manager.preferences ? JSON.stringify(manager.preferences) : null}
        )
        ON CONFLICT (id) DO UPDATE SET
          username = ${manager.username},
          password = ${manager.password},
          cpf = ${manager.cpf || null},
          email = ${manager.email || null},
          permissoes = ${JSON.stringify(manager.permissoes || {})},
          preferences = ${manager.preferences ? JSON.stringify(manager.preferences) : null}
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
          id, cooperado_id, cooperado_nome, ponto_id, motivo, descricao, data_solicitacao,
          status, aprovado_por, rejeitado_por, motivo_rejeicao, setor_id, updated_at
        )
        VALUES (
          ${j.id}, ${j.cooperadoId}, ${j.cooperadoNome || null}, ${j.pontoId || null}, ${j.motivo || null}, ${j.descricao || null}, ${j.dataSolicitacao || null},
          ${j.status || 'Pendente'}, ${j.aprovadoPor || null}, ${j.rejeitadoPor || null}, ${j.motivoRejeicao || null}, ${j.setorId || null}, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          ponto_id = ${j.pontoId || null},
          motivo = ${j.motivo || null},
          descricao = ${j.descricao || null},
          data_solicitacao = ${j.dataSolicitacao || null},
          status = ${j.status || 'Pendente'},
          aprovado_por = ${j.aprovadoPor || null},
          rejeitado_por = ${j.rejeitadoPor || null},
          motivo_rejeicao = ${j.motivoRejeicao || null},
          setor_id = ${j.setorId || null},
          updated_at = NOW()
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
          id, codigo, cooperado_id, cooperado_nome, date, tipo, entrada, saida,
          hospital_id, setor_id, biometria_entrada_hash, biometria_saida_hash, timestamp,
          related_id, status, is_manual, local, validado_por, rejeitado_por, motivo_rejeicao
        )
        VALUES (
          ${p.id}, ${p.codigo || null}, ${p.cooperadoId}, ${p.cooperadoNome || null}, ${p.data || p.date}, ${p.tipo},
          ${p.entrada || null}, ${p.saida || null}, ${p.hospitalId || null}, ${p.setorId || null},
          ${p.biometriaEntradaHash || null}, ${p.biometriaSaidaHash || null}, ${p.timestamp || new Date().toISOString()},
          ${p.relatedId || null}, ${p.status || null}, ${p.isManual ?? null}, ${p.local || null}, 
          ${p.validadoPor || null}, ${p.rejeitadoPor || null}, ${p.motivoRejeicao || null}
        )
        ON CONFLICT (id) DO UPDATE SET
          codigo = ${p.codigo || null},
          tipo = ${p.tipo},
          entrada = ${p.entrada || null},
          saida = ${p.saida || null},
          hospital_id = ${p.hospitalId || null},
          setor_id = ${p.setorId || null},
          biometria_entrada_hash = ${p.biometriaEntradaHash || null},
          biometria_saida_hash = ${p.biometriaSaidaHash || null},
          timestamp = ${p.timestamp || new Date().toISOString()},
          related_id = ${p.relatedId || null},
          status = ${p.status || null},
          is_manual = ${p.isManual ?? null},
          local = ${p.local || null},
          validado_por = ${p.validadoPor || null},
          rejeitado_por = ${p.rejeitadoPor || null},
          motivo_rejeicao = ${p.motivoRejeicao || null}
        RETURNING id;
      `;
      console.log('[sync] Ponto salvo:', result);
      return res.status(200).json({ success: true, id: result[0]?.id });
    }

    if (action === 'delete_ponto') {
      const { id } = data;
      if (!id) {
        return res.status(400).json({ error: 'Ponto ID é obrigatório para exclusão' });
      }

      await sql`DELETE FROM pontos WHERE id = ${id} OR related_id = ${id}`;
      console.log('[sync] Ponto deletado:', id);
      return res.status(200).json({ success: true, deleted: id });
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
