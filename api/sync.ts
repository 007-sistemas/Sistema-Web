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

    // Garantir schema mínimo antes de consultas GET (evita erro 500 por colunas ausentes)
    const ensureSchemaForGet = async () => {
      // justificativas
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
          validado_por TEXT,
          aprovado_por TEXT,
          rejeitado_por TEXT,
          motivo_rejeicao TEXT,
          setor_id TEXT,
          hospital_id TEXT,
          data_plantao TEXT,
          entrada_plantao TEXT,
          saida_plantao TEXT,
          data_aprovacao TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;

      try {
        await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS ponto_id TEXT`;
        await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS descricao TEXT`;
        await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS data_solicitacao TEXT`;
        await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS validado_por TEXT`;
        await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS rejeitado_por TEXT`;
        await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS setor_id TEXT`;
        await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS hospital_id TEXT`;
        await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS data_aprovacao TIMESTAMP`;
        await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS data_plantao TEXT`;
        await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS entrada_plantao TEXT`;
        await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS saida_plantao TEXT`;
        await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`;
      } catch (alterErr) {
        console.log('[sync][GET] Aviso ao ajustar schema de justificativas:', alterErr);
      }

      // pontos
      await sql`
        CREATE TABLE IF NOT EXISTS pontos (
          id TEXT PRIMARY KEY,
          cooperado_id TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `;

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
        await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS timestamp TEXT`;
        await sql`ALTER TABLE pontos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`;
      } catch (alterErr) {
        console.log('[sync][GET] Aviso ao ajustar schema de pontos:', alterErr);
      }
    };

    await ensureSchemaForGet();

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
            j.validado_por      AS "validadoPor",
            j.rejeitado_por     AS "rejeitadoPor",
            j.motivo_rejeicao   AS "motivoRejeicao",
            j.setor_id          AS "setorId",
            j.hospital_id       AS "hospitalId",
            j.data_plantao      AS "dataPlantao",
            j.entrada_plantao   AS "entradaPlantao",
            j.saida_plantao     AS "saidaPlantao",
            j.created_at        AS "createdAt",
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

      if (actionParam === 'list_pontos') {
        const cooperadoIdParam = (req.query.cooperadoId || '').toString();
        let query;
        
        if (cooperadoIdParam) {
          query = await sql`
            SELECT 
              id,
              codigo,
              cooperado_id      AS "cooperadoId",
              cooperado_nome    AS "cooperadoNome",
              timestamp,
              date,
              entrada,
              saida,
              tipo,
              local,
              hospital_id       AS "hospitalId",
              setor_id          AS "setorId",
              biometria_entrada_hash AS "biometriaEntradaHash",
              biometria_saida_hash   AS "biometriaSaidaHash",
              related_id        AS "relatedId",
              status,
              is_manual         AS "isManual",
              validado_por      AS "validadoPor",
              rejeitado_por     AS "rejeitadoPor",
              motivo_rejeicao   AS "motivoRejeicao",
              created_at        AS "createdAt",
              updated_at        AS "updatedAt"
            FROM pontos
            WHERE cooperado_id = ${cooperadoIdParam}
            ORDER BY timestamp DESC
          `;
        } else {
          query = await sql`
            SELECT 
              id,
              codigo,
              cooperado_id      AS "cooperadoId",
              cooperado_nome    AS "cooperadoNome",
              timestamp,
              date,
              entrada,
              saida,
              tipo,
              local,
              hospital_id       AS "hospitalId",
              setor_id          AS "setorId",
              biometria_entrada_hash AS "biometriaEntradaHash",
              biometria_saida_hash   AS "biometriaSaidaHash",
              related_id        AS "relatedId",
              status,
              is_manual         AS "isManual",
              validado_por      AS "validadoPor",
              rejeitado_por     AS "rejeitadoPor",
              motivo_rejeicao   AS "motivoRejeicao",
              created_at        AS "createdAt",
              updated_at        AS "updatedAt"
            FROM pontos
            ORDER BY timestamp DESC
          `;
        }

        return res.status(200).json(query);
      }

      // Diagnóstico: verificar justificativas pendentes
      if (actionParam === 'check_justificativas') {
        const justificativas = await sql`
          SELECT 
            id,
            cooperado_id,
            cooperado_nome,
            ponto_id,
            status,
            validado_por,
            rejeitado_por,
            motivo_rejeicao,
            data_solicitacao,
            updated_at
          FROM justificativas
          WHERE status = 'Pendente'
          ORDER BY data_solicitacao DESC
        `;

        return res.status(200).json({
          total: justificativas.length,
          justificativas
        });
      }

      // Reprocessar justificativas pendentes que já têm validado_por ou rejeitado_por
      if (actionParam === 'reprocess_justificativas') {
        const toUpdate = await sql`
          SELECT 
            id,
            status,
            validado_por,
            rejeitado_por
          FROM justificativas
          WHERE status = 'Pendente' 
          AND (validado_por IS NOT NULL OR rejeitado_por IS NOT NULL)
        `;

        console.log(`[reprocess] Encontradas ${toUpdate.length} justificativas para reprocessar`);

        const updated = [];
        for (const just of toUpdate) {
          const newStatus = just.validado_por ? 'Fechado' : 'Rejeitado';
          
          await sql`
            UPDATE justificativas
            SET status = ${newStatus}
            WHERE id = ${just.id}
          `;

          updated.push({
            id: just.id,
            oldStatus: 'Pendente',
            newStatus
          });

          console.log(`[reprocess] ${just.id}: Pendente → ${newStatus}`);
        }

        return res.status(200).json({
          message: `${updated.length} justificativas reprocessadas`,
          updated
        });
      }

      // Verificar pontos com status inconsistente
      if (actionParam === 'check_pontos') {
        const inconsistentes = await sql`
          SELECT 
            p.id,
            p.cooperado_nome,
            p.tipo,
            p.status,
            p.validado_por,
            p.rejeitado_por,
            j.status as just_status
          FROM pontos p
          LEFT JOIN justificativas j ON j.ponto_id = p.id
          WHERE p.status IN ('Pendente', 'Aberto')
          AND (p.validado_por IS NOT NULL OR p.rejeitado_por IS NOT NULL)
          ORDER BY p.timestamp DESC
          LIMIT 50
        `;

        return res.status(200).json({
          total: inconsistentes.length,
          pontos: inconsistentes
        });
      }

      // Corrigir pontos com status inconsistente
      if (actionParam === 'fix_pontos') {
        const inconsistentes = await sql`
          SELECT 
            id,
            status,
            validado_por,
            rejeitado_por
          FROM pontos
          WHERE status IN ('Pendente', 'Aberto')
          AND (validado_por IS NOT NULL OR rejeitado_por IS NOT NULL)
        `;

        console.log(`[fix-pontos] Encontrados ${inconsistentes.length} pontos para corrigir`);

        const updated = [];
        for (const ponto of inconsistentes) {
          const newStatus = ponto.validado_por ? 'Fechado' : 'Rejeitado';
          
          await sql`
            UPDATE pontos
            SET status = ${newStatus}
            WHERE id = ${ponto.id}
          `;

          updated.push({
            id: ponto.id,
            oldStatus: ponto.status,
            newStatus
          });

          console.log(`[fix-pontos] ${ponto.id}: ${ponto.status} → ${newStatus}`);
        }

        return res.status(200).json({
          message: `${updated.length} pontos corrigidos`,
          updated
        });
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

    // Garantir que a tabela cooperados existe
    await sql`
      CREATE TABLE IF NOT EXISTS cooperados (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cpf TEXT UNIQUE,
        email TEXT,
        phone TEXT,
        specialty TEXT,
        matricula TEXT,
        status TEXT DEFAULT 'ATIVO',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    try {
      await sql`ALTER TABLE cooperados ADD COLUMN IF NOT EXISTS specialty TEXT`;
      await sql`ALTER TABLE cooperados ADD COLUMN IF NOT EXISTS matricula TEXT`;
      await sql`ALTER TABLE cooperados ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ATIVO'`;
      await sql`ALTER TABLE cooperados ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`;
    } catch (alterErr) {
      console.log('[sync] Aviso ao ajustar schema de cooperados:', alterErr);
    }

    // Garantir que a tabela hospitals existe
    await sql`
      CREATE TABLE IF NOT EXISTS hospitals (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        slug TEXT,
        usuario_acesso TEXT,
        senha TEXT,
        endereco JSONB,
        permissoes JSONB,
        setores JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    try {
      await sql`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS usuario_acesso TEXT`;
      await sql`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS senha TEXT`;
      await sql`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS endereco JSONB`;
      await sql`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS permissoes JSONB`;
      await sql`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS setores JSONB`;
      await sql`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`;
    } catch (alterErr) {
      console.log('[sync] Aviso ao ajustar schema de hospitals:', alterErr);
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
        validado_por TEXT,
        aprovado_por TEXT,
        rejeitado_por TEXT,
        motivo_rejeicao TEXT,
        setor_id TEXT,
        hospital_id TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // Tentar adicionar/ajustar colunas que possam estar faltando em bancos existentes
    try {
      await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS ponto_id TEXT`;
      await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS descricao TEXT`;
      await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS data_solicitacao TEXT`;
      await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS validado_por TEXT`;
      await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS rejeitado_por TEXT`;
      await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS setor_id TEXT`;
      await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS hospital_id TEXT`;
      await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS data_aprovacao TIMESTAMP`;
      await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS data_plantao TEXT`;
      await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS entrada_plantao TEXT`;
      await sql`ALTER TABLE justificativas ADD COLUMN IF NOT EXISTS saida_plantao TEXT`;
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

    if (action === 'sync_cooperado') {
      const c = data;
      if (!c.id || !c.nome) {
        return res.status(400).json({ error: 'Cooperado ID e nome são obrigatórios' });
      }

      const result = await sql`
        INSERT INTO cooperados (
          id, name, cpf, email, phone, specialty, matricula, status, updated_at
        )
        VALUES (
          ${c.id}, ${c.nome}, ${c.cpf || null}, ${c.email || null}, ${c.telefone || null},
          ${c.categoriaProfissional || null}, ${c.matricula || null}, ${c.status || 'ATIVO'}, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = ${c.nome},
          cpf = ${c.cpf || null},
          email = ${c.email || null},
          phone = ${c.telefone || null},
          specialty = ${c.categoriaProfissional || null},
          matricula = ${c.matricula || null},
          status = ${c.status || 'ATIVO'},
          updated_at = NOW()
        RETURNING id;
      `;
      console.log('[sync] Cooperado salvo:', result);
      return res.status(200).json({ success: true, id: result[0]?.id });
    }

    if (action === 'delete_cooperado') {
      const { id } = data;
      if (!id) {
        return res.status(400).json({ error: 'Cooperado ID é obrigatório para exclusão' });
      }

      await sql`DELETE FROM cooperados WHERE id = ${id}`;
      console.log('[sync] Cooperado deletado:', id);
      return res.status(200).json({ success: true, deleted: id });
    }

    if (action === 'sync_hospital') {
      const h = data;
      if (!h.id || !h.nome) {
        return res.status(400).json({ error: 'Hospital ID e nome são obrigatórios' });
      }

      const slug = (h.slug || h.nome || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30) || h.id;

      const result = await sql`
        INSERT INTO hospitals (
          id, nome, slug, usuario_acesso, senha, endereco, permissoes, setores, updated_at
        )
        VALUES (
          ${h.id}, ${h.nome}, ${slug}, ${h.usuarioAcesso || h.usuario_acesso || null}, ${h.senha || null},
          ${h.endereco ? JSON.stringify(h.endereco) : null},
          ${JSON.stringify(h.permissoes || {})},
          ${JSON.stringify(h.setores || [])},
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          nome = ${h.nome},
          slug = ${slug},
          usuario_acesso = ${h.usuarioAcesso || h.usuario_acesso || null},
          senha = ${h.senha || null},
          endereco = ${h.endereco ? JSON.stringify(h.endereco) : null},
          permissoes = ${JSON.stringify(h.permissoes || {})},
          setores = ${JSON.stringify(h.setores || [])},
          updated_at = NOW()
        RETURNING id;
      `;
      console.log('[sync] Hospital salvo:', result);
      return res.status(200).json({ success: true, id: result[0]?.id });
    }

    if (action === 'delete_hospital') {
      const { id } = data;
      if (!id) {
        return res.status(400).json({ error: 'Hospital ID é obrigatório para exclusão' });
      }

      await sql`DELETE FROM hospitals WHERE id = ${id}`;
      console.log('[sync] Hospital deletado:', id);
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
          status, validado_por, rejeitado_por, motivo_rejeicao, setor_id, hospital_id,
          data_plantao, entrada_plantao, saida_plantao, data_aprovacao, updated_at
        )
        VALUES (
          ${j.id}, ${j.cooperadoId}, ${j.cooperadoNome || null}, ${j.pontoId || null}, ${j.motivo || null}, ${j.descricao || null}, ${j.dataSolicitacao || null},
          ${j.status || 'Pendente'}, ${j.validadoPor || null}, ${j.rejeitadoPor || null}, ${j.motivoRejeicao || null}, ${j.setorId || null}, ${j.hospitalId || null},
          ${j.dataPlantao || null}, ${j.entradaPlantao || null}, ${j.saidaPlantao || null}, ${j.dataAprovacao || null}, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          ponto_id = ${j.pontoId || null},
          motivo = ${j.motivo || null},
          descricao = ${j.descricao || null},
          data_solicitacao = ${j.dataSolicitacao || null},
          status = ${j.status || 'Pendente'},
          validado_por = ${j.validadoPor || null},
          rejeitado_por = ${j.rejeitadoPor || null},
          motivo_rejeicao = ${j.motivoRejeicao || null},
          setor_id = ${j.setorId || null},
          hospital_id = ${j.hospitalId || null},
          data_plantao = ${j.dataPlantao || null},
          entrada_plantao = ${j.entradaPlantao || null},
          saida_plantao = ${j.saidaPlantao || null},
          data_aprovacao = ${j.dataAprovacao || null},
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

      // Buscar pontos relacionados (entrada/saída) para obter cooperado e data
      const pontosRelacionados = await sql`
        SELECT id, cooperado_id AS "cooperadoId", date, timestamp 
        FROM pontos 
        WHERE id = ${id} OR related_id = ${id}
      `;

      // Remover justificativas vinculadas por ponto_id e por (cooperado_id + data_plantao)
      // EXCETO as que têm status Rejeitado/Recusado (devem ficar visíveis para o cooperado)
      for (const p of pontosRelacionados) {
        const dataPlantao = p.date || (p.timestamp ? p.timestamp.split('T')[0] : null);
        await sql`DELETE FROM justificativas WHERE ponto_id = ${p.id} AND status NOT IN ('Rejeitado', 'Recusado')`;
        if (dataPlantao) {
          await sql`DELETE FROM justificativas WHERE cooperado_id = ${p.cooperadoId} AND data_plantao = ${dataPlantao} AND status NOT IN ('Rejeitado', 'Recusado')`;
          console.log('[sync] Justificativas removidas por cooperado/data (aprovadas/pendentes):', p.cooperadoId, dataPlantao);
        }
      }
      console.log('[sync] Justificativas relacionadas ao ponto removidas (mantendo recusadas):', id);

      // Remover o ponto (e qualquer par via related_id)
      await sql`DELETE FROM pontos WHERE id = ${id} OR related_id = ${id}`;
      console.log('[sync] Ponto deletado:', id);
      return res.status(200).json({ success: true, deleted: id });
    }

    if (action === 'delete_justificativa') {
      const { id } = data;
      if (!id) {
        return res.status(400).json({ error: 'Justificativa ID é obrigatório para exclusão' });
      }

      await sql`DELETE FROM justificativas WHERE id = ${id}`;
      console.log('[sync] Justificativa deletada:', id);
      return res.status(200).json({ success: true, deleted: id });
    }

    // Suporte a outras ações (hospital, cooperado, etc.)
    // Se chegar aqui, ação não reconhecida
    res.status(400).json({ error: `Ação desconhecida: ${action}` });
  } catch (err: any) {
    console.error('[sync] Erro:', err);
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
}
