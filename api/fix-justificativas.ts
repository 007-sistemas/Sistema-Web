import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const { action, token } = req.query;

  // Token simples para proteção mínima (pode ser alterado)
  const ALLOWED_TOKEN = process.env.FIX_JUSTIFICATIVAS_TOKEN || 'fix-justificativas-2026';
  
  if (token !== ALLOWED_TOKEN) {
    return res.status(401).json({ error: 'Token inválido ou ausente' });
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return res.status(500).json({ error: 'DATABASE_URL não configurada' });
  }

  const sql = neon(connectionString);

  try {
    if (action === 'check') {
      // Listar justificativas pendentes
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

    if (action === 'reprocess') {
      // Buscar justificativas que têm validado_por ou rejeitado_por mas status é Pendente
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

      console.log(`[fix-justificativas] Encontradas ${toUpdate.length} justificativas para reprocessar`);

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

        console.log(`[fix-justificativas] Atualizado ${just.id}: Pendente → ${newStatus}`);
      }

      return res.status(200).json({
        message: `${updated.length} justificativas reprocessadas`,
        updated
      });
    }

    if (action === 'check-pontos') {
      // Verificar pontos com status inconsistente
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

    if (action === 'fix-pontos') {
      // Corrigir pontos que têm validado_por/rejeitado_por mas estão Pendente/Aberto
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

        console.log(`[fix-pontos] Atualizado ${ponto.id}: ${ponto.status} → ${newStatus}`);
      }

      return res.status(200).json({
        message: `${updated.length} pontos corrigidos`,
        updated
      });
    }

    return res.status(400).json({ error: 'Action não suportada', availableActions: ['check', 'reprocess', 'check-pontos', 'fix-pontos'] });

  } catch (error) {
    console.error('[fix-justificativas] Erro:', error);
    return res.status(500).json({ error: error.message });
  }
}
