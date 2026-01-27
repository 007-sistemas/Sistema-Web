import { StorageService } from './storage';
import { syncToNeon } from './api';

let syncExecuted = false;

// Helper para aguardar entre batches
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function syncInitialData() {
  if (syncExecuted) return;
  syncExecuted = true;

  console.log('[SYNC INICIAL] Iniciando sincronização de dados seed...');

  try {
    // 1. Sincronizar todos os managers
    const managers = StorageService.getManagers();
    console.log(`[SYNC INICIAL] Sincronizando ${managers.length} managers...`);
    
    for (const manager of managers) {
      await syncToNeon('sync_manager', manager);
    }
    await delay(500); // Aguardar para garantir persistência

    // 2. Sincronizar todos os cooperados
    const cooperados = StorageService.getCooperados();
    console.log(`[SYNC INICIAL] Sincronizando ${cooperados.length} cooperados...`);
    
    for (const cooperado of cooperados) {
      await syncToNeon('sync_cooperado', {
        id: cooperado.id,
        nome: cooperado.nome,
        cpf: cooperado.cpf,
        email: cooperado.email,
        telefone: cooperado.telefone,
        matricula: cooperado.matricula,
        categoriaProfissional: cooperado.categoriaProfissional,
        status: cooperado.status
      });
    }
    await delay(500); // Aguardar para garantir persistência

    // 3. Sincronizar todos os hospitais
    const hospitais = StorageService.getHospitais();
    console.log(`[SYNC INICIAL] Sincronizando ${hospitais.length} hospitais...`);
    
    for (const hospital of hospitais) {
      await syncToNeon('sync_hospital', hospital);
    }
    await delay(500); // Aguardar para garantir persistência

    // 4. Sincronizar todos os pontos
    const pontos = StorageService.getPontos();
    console.log(`[SYNC INICIAL] Sincronizando ${pontos.length} pontos...`);
    
    for (const ponto of pontos) {
      await syncToNeon('sync_ponto', {
        id: ponto.id,
        codigo: ponto.codigo,
        cooperadoId: ponto.cooperadoId,
        cooperadoNome: ponto.cooperadoNome,
        timestamp: ponto.timestamp,
        tipo: ponto.tipo,
        local: ponto.local,
        hospitalId: ponto.hospitalId,
        setorId: ponto.setorId,
        observacao: ponto.observacao,
        relatedId: ponto.relatedId,
        status: ponto.status,
        isManual: ponto.isManual,
        validadoPor: ponto.validadoPor,
        justificativa: ponto.justificativa
      });
    }

    // 5. Sincronizar todas as justificativas
    const justificativas = StorageService.getJustificativas();
    console.log(`[SYNC INICIAL] Sincronizando ${justificativas.length} justificativas...`);
    
    for (const just of justificativas) {
      await syncToNeon('sync_justificativa', just);
    }

    // 6. Sincronizar logs de auditoria
    const auditLogs = StorageService.getAuditLogs();
    console.log(`[SYNC INICIAL] Sincronizando ${auditLogs.length} audit logs...`);
    
    for (const log of auditLogs) {
      await syncToNeon('sync_audit', {
        id: log.id,
        action: log.action,
        details: log.details,
        timestamp: log.timestamp,
        user: log.user
      });
    }

    console.log('[SYNC INICIAL] ✅ Sincronização inicial concluída!');
  } catch (err) {
    console.error('[SYNC INICIAL] ⚠️ Erro na sincronização:', err);
  }
}
