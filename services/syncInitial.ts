import { StorageService } from './storage';
import { syncToNeon } from './api';

let syncExecuted = false;

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
        especialidade: cooperado.especialidade,
        status: cooperado.status
      });
    }

    // 3. Sincronizar todos os hospitais
    const hospitais = StorageService.getHospitais();
    console.log(`[SYNC INICIAL] Sincronizando ${hospitais.length} hospitais...`);
    
    for (const hospital of hospitais) {
      await syncToNeon('sync_hospital', hospital);
    }

    console.log('[SYNC INICIAL] ✅ Sincronização inicial concluída!');
  } catch (err) {
    console.error('[SYNC INICIAL] ⚠️ Erro na sincronização:', err);
  }
}
