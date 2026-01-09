-- Verificar justificativas pendentes
SELECT 
  id,
  cooperado_nome,
  status,
  validado_por,
  rejeitado_por,
  data_solicitacao
FROM justificativas
WHERE status = 'Pendente'
ORDER BY data_solicitacao DESC;

-- Verificar justificativas que devem ser atualizadas (têm validado_por ou rejeitado_por mas ainda estão Pendente)
SELECT 
  id,
  cooperado_nome,
  status,
  validado_por,
  rejeitado_por
FROM justificativas
WHERE status = 'Pendente' 
AND (validado_por IS NOT NULL OR rejeitado_por IS NOT NULL);

-- REPROCESSAR: Atualizar justificativas com validado_por para status Fechado
UPDATE justificativas
SET status = 'Fechado'
WHERE status = 'Pendente' 
AND validado_por IS NOT NULL;

-- REPROCESSAR: Atualizar justificativas com rejeitado_por para status Rejeitado
UPDATE justificativas
SET status = 'Rejeitado'
WHERE status = 'Pendente' 
AND rejeitado_por IS NOT NULL;

-- Verificar pontos inconsistentes
SELECT 
  id,
  cooperado_nome,
  tipo,
  status,
  validado_por,
  rejeitado_por
FROM pontos
WHERE status IN ('Pendente', 'Aberto')
AND (validado_por IS NOT NULL OR rejeitado_por IS NOT NULL)
ORDER BY timestamp DESC
LIMIT 20;

-- CORRIGIR: Atualizar pontos com validado_por para status Fechado
UPDATE pontos
SET status = 'Fechado'
WHERE status IN ('Pendente', 'Aberto')
AND validado_por IS NOT NULL;

-- CORRIGIR: Atualizar pontos com rejeitado_por para status Rejeitado
UPDATE pontos
SET status = 'Rejeitado'
WHERE status IN ('Pendente', 'Aberto')
AND rejeitado_por IS NOT NULL;
