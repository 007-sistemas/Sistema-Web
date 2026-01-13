
import { Cooperado, RegistroPonto, AuditLog, StatusCooperado, Hospital, Manager, HospitalPermissions, Justificativa, UserPreferences } from '../types';
import { apiGet, syncToNeon } from './api';

const COOPERADOS_KEY = 'biohealth_cooperados';
const PONTOS_KEY = 'biohealth_pontos';
const AUDIT_KEY = 'biohealth_audit';
const HOSPITAIS_KEY = 'biohealth_hospitais';
const MANAGERS_KEY = 'biohealth_managers';
const CATEGORIAS_KEY = 'biohealth_categorias';
const SETORES_KEY = 'biohealth_setores';
const JUSTIFICATIVAS_KEY = 'biohealth_justificativas';
const SESSION_KEY = 'biohealth_session';
const USER_PREFS_KEY = 'biohealth_user_prefs';

// Notificar outras abas sobre mudanças em pontos (save/update/delete)
const broadcastPontoChange = (action: 'save' | 'update' | 'delete', id: string) => {
  const notificationKey = 'biohealth_pontos_changed';
  const notification = { action, id, timestamp: Date.now() };
  try {
    localStorage.setItem(notificationKey, JSON.stringify(notification));
    console.log('[broadcastPontoChange] 📢 Enviado:', notification);
  } catch (err) {
    console.warn('[broadcastPontoChange] Falha ao notificar:', err);
  }
};

const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'auto',
  primaryColor: '#7c3aed',
  // IDs devem bater com Layout: dashboard, ponto, relatorio, relatorios, autorizacao, cadastro, hospitais, biometria, auditoria, gestao, perfil
  visibleTabs: ['dashboard', 'ponto', 'relatorio', 'relatorios', 'autorizacao', 'cadastro', 'hospitais', 'biometria', 'auditoria', 'gestao', 'perfil'],
  tabOrder: ['dashboard', 'ponto', 'relatorio', 'relatorios', 'autorizacao', 'cadastro', 'hospitais', 'biometria', 'auditoria', 'gestao', 'perfil']
};

// Initial Seed Data
const seedData = () => {
  // Não faz seed de usuário master localmente. Managers virão do backend remoto.

  // Não carrega seed data de cooperados aqui; deixa vazio para que
  // refreshCooperadosFromRemote() preencha com dados do Neon no login
  if (!localStorage.getItem(COOPERADOS_KEY)) {
    localStorage.setItem(COOPERADOS_KEY, JSON.stringify([]));
  }

  if (!localStorage.getItem(HOSPITAIS_KEY)) {
    // Sem seed local; hospitais virão do Neon via refreshHospitaisFromRemote()
    localStorage.setItem(HOSPITAIS_KEY, JSON.stringify([]));
  }

  if (!localStorage.getItem(CATEGORIAS_KEY)) {
    const initialCategorias = [
      'Médico',
      'Enfermeiro',
      'Técnico de Enfermagem',
      'Fisioterapeuta',
      'Nutricionista',
      'Psicólogo',
      'Assistente Social'
    ];
    localStorage.setItem(CATEGORIAS_KEY, JSON.stringify(initialCategorias));
  }
};

export const StorageService = {
    // --- SETORES ---
    getSetores() {
      const data = localStorage.getItem(SETORES_KEY);
      return data ? JSON.parse(data) : [];
    },

    // Retorna setores vinculados a um hospital (via Neon). Fallback: lista local.
    async getSetoresByHospital(hospitalId: string) {
      try {
        if (!hospitalId) return [];
        const setores = await apiGet<any[]>(`hospital-setores?hospitalId=${hospitalId}`);
        if (Array.isArray(setores)) return setores;
        return [];
      } catch (err) {
        console.warn('[StorageService] Erro ao buscar setores por hospital:', err);
        // Fallback: tentar usar setores presentes no objeto do hospital em localStorage
        const hospitais: Hospital[] = StorageService.getHospitais();
        const hosp = hospitais.find(h => String(h.id) === String(hospitalId));
        const setores = (hosp as any)?.setores || [];
        return setores;
      }
    },

    saveSetor(nome: string) {
      const setores = StorageService.getSetores();
      const nextId = setores.length > 0 ? Math.max(...setores.map(s => s.id)) + 1 : 1;
      setores.push({ id: nextId, nome });
      localStorage.setItem(SETORES_KEY, JSON.stringify(setores));
      return nextId;
    },

    deleteSetor(id: number) {
      const setores = StorageService.getSetores().filter(s => s.id !== id);
      localStorage.setItem(SETORES_KEY, JSON.stringify(setores));
    },
  init: () => seedData(),

  // --- AUTHENTICATION & SESSION ---
  
  authenticate: (usernameOrCode: string, password: string): { type: 'MANAGER' | 'HOSPITAL' | 'COOPERADO', user: any, permissions: HospitalPermissions } | null => {
    // 1. Check Managers
    const managers: Manager[] = JSON.parse(localStorage.getItem(MANAGERS_KEY) || '[]');
    const manager = managers.find(m => m.username === usernameOrCode && m.password === password);
    
    if (manager) {
      // Garantir que permissão 'relatorios' existe
      const permissions = { ...manager.permissoes };
      if (!('relatorios' in permissions)) {
        permissions.relatorios = true;
      }
      return { 
        type: 'MANAGER', 
        user: manager,
        permissions
      };
    }

    // 2. Check Hospitals
    const hospitals: Hospital[] = JSON.parse(localStorage.getItem(HOSPITAIS_KEY) || '[]');
    const hospital = hospitals.find(h => h.usuarioAcesso === usernameOrCode && h.senha === password);

    if (hospital) {
      // Garantir que permissão 'relatorios' existe
      const permissions = { ...hospital.permissoes };
      if (!('relatorios' in permissions)) {
        permissions.relatorios = false; // Default: desabilitado para hospitais
      }
      return { 
        type: 'HOSPITAL', 
        user: hospital,
        permissions
      };
    }

    // 3. Check Cooperados (Login: CPF + Password: First 4 digits of CPF)
    const cooperados: Cooperado[] = JSON.parse(localStorage.getItem(COOPERADOS_KEY) || '[]');
    
    // Helper to remove non-numeric characters for comparison
    const cleanStr = (str: string) => str.replace(/\D/g, '');
    const inputUsernameClean = cleanStr(usernameOrCode);

    const cooperado = cooperados.find(c => {
        const dbCpfClean = cleanStr(c.cpf);
        // Check Username (CPF)
        if (dbCpfClean === inputUsernameClean) {
            // Check Password (First 4 digits of DB CPF)
            const expectedPassword = dbCpfClean.substring(0, 4);
            return password === expectedPassword;
        }
        return false;
    });

    if (cooperado) {
        return {
            type: 'COOPERADO',
            user: cooperado,
            permissions: {
                dashboard: false,
                ponto: false,
                relatorio: false,
                relatorios: false,
                cadastro: false,
                hospitais: false,
                biometria: false,
                auditoria: false,
                gestao: false,
                testes: false,
                espelho: true, // Only access to Mirror (Cooperados only)
                autorizacao: false,
                perfil: true
            }
        };
    }

    return null;
  },

  setSession: (sessionData: any) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  },

  getSession: () => {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  },

  clearSession: () => {
    localStorage.removeItem(SESSION_KEY);
    StorageService.clearConfiguredHospital(); // Clear device config if any
  },

  // --- MANAGERS ---
  
  getManagers: (): Manager[] => {
    const data = localStorage.getItem(MANAGERS_KEY);
    let managers = data ? JSON.parse(data) : [];
    
    let hasChanges = false;
    
    // Garantir que todo manager tem as permissões esperadas
    managers = managers.map((m: Manager) => {
      if (!m.permissoes) {
        m.permissoes = {} as any;
        hasChanges = true;
      }
      
      // Garantir que 'relatorios' existe
      if (!('relatorios' in m.permissoes)) {
        m.permissoes.relatorios = true;
        hasChanges = true;
      }
      
      // Garantir que 'setores' existe
      if (!('setores' in m.permissoes)) {
        m.permissoes.setores = true;
        hasChanges = true;
      }
      
      return m;
    });
    
    // Se lista estiver vazia, criar manager padrão para emergência
    if (managers.length === 0) {
      const defaultPerms: HospitalPermissions = {
        dashboard: true,
        ponto: true,
        relatorio: true,
        relatorios: true,
        cadastro: true,
        hospitais: true,
        biometria: true,
        auditoria: true,
        gestao: true,
        testes: true,
        espelho: true,
        autorizacao: true,
        perfil: true,
      };
      managers.push({
        id: 'manager-seed',
        username: 'gabriel',
        password: 'gabriel',
        cpf: '00000000000',
        email: 'admin@example.com',
        permissoes: defaultPerms,
      } as Manager);
      hasChanges = true;
    }

    // Se houve mudanças, salvar de volta ao localStorage
    if (hasChanges) {
      localStorage.setItem(MANAGERS_KEY, JSON.stringify(managers));
    }
    
    return managers;
  },

  refreshManagersFromRemote: async () => {
    try {
      const rows = await apiGet<any[]>('managers');
      if (!Array.isArray(rows)) return;

      const defaultPerms: HospitalPermissions = {
        dashboard: false,
        ponto: false,
        relatorio: false,
        relatorios: false,
        cadastro: false,
        hospitais: false,
        biometria: false,
        auditoria: false,
        gestao: false,
        espelho: false, // Managers não têm acesso (removido do menu)
        autorizacao: false,
        // Perfil deve existir e vir habilitado por padrão para gestores
        perfil: true,
      };

      // Preservar preferences locais antes de atualizar
      const currentManagers = StorageService.getManagers();
      const prefsMap = new Map<string, any>();
      currentManagers.forEach(m => {
        if (m.preferences) {
          prefsMap.set(m.id, m.preferences);
        }
      });

      const mapped: Manager[] = rows.map((row: any) => {
        let perms = row.permissoes;
        if (typeof perms === 'string') {
          try { perms = JSON.parse(perms); } catch (err) { perms = {}; }
        }
        
        // Tentar parsear preferences do Neon
        let prefs = row.preferences;
        if (typeof prefs === 'string') {
          try { prefs = JSON.parse(prefs); } catch (err) { prefs = null; }
        }

        // Garantir que 'espelho' é sempre false para managers (nunca pode ser true)
        const mergedPerms = { ...defaultPerms, ...(perms || {}) };
        mergedPerms.espelho = false;

        return {
          id: row.id,
          username: row.username,
          password: row.password,
          cpf: row.cpf || '',
          email: row.email || '',
          permissoes: mergedPerms,
          // Usar preferences do Neon se existir, senão manter local
          preferences: prefs || prefsMap.get(row.id),
        };
      });

      localStorage.setItem(MANAGERS_KEY, JSON.stringify(mapped));
    } catch (err) {
      console.error('[AUTH] Erro ao atualizar gestores do Neon:', err);
    }
  },

  checkDuplicateCpf: (cpf: string, excludeId?: string): Manager | null => {
    const list = StorageService.getManagers();
    const clean = (s: string) => (s || '').replace(/\D/g, '');
    const cpfLimpo = clean(cpf);
    const duplicado = list.find(m => clean(m.cpf) === cpfLimpo && m.id !== excludeId);
    return duplicado || null;
  },

  saveManager: (manager: Manager): void => {
    console.log('[saveManager] 🟡 Iniciando...');
    const list = StorageService.getManagers();
    const clean = (s: string) => (s || '').replace(/\D/g, '');
    const cpfNovo = clean(manager.cpf);
    
    console.log('[saveManager] CPF limpo:', cpfNovo, 'Original:', manager.cpf);
    
    if (!cpfNovo) {
      console.error('[saveManager] ❌ CPF vazio!');
      alert('CPF é obrigatório para gestores.');
      return;
    }
    
    const cpfDuplicado = StorageService.checkDuplicateCpf(manager.cpf, manager.id);
    if (cpfDuplicado) {
      console.error('[saveManager] ❌ CPF duplicado:', cpfDuplicado.username);
      alert('Já existe um gestor com este CPF!');
      return;
    }
    
    console.log('[saveManager] ✅ Validações OK');
    
    // Garante que todo gestor tenha acesso a setores
    if (!manager.permissoes) manager.permissoes = {} as any;
    manager.permissoes.setores = true;
    
    const index = list.findIndex(m => m.id === manager.id);
    if (index >= 0) {
      console.log('[saveManager] 🔄 Atualizando gestor existente');
      list[index] = manager;
    } else {
      console.log('[saveManager] ➕ Adicionando novo gestor');
      list.push(manager);
    }
    
    console.log('[saveManager] 💾 Salvando no localStorage...');
    localStorage.setItem(MANAGERS_KEY, JSON.stringify(list));
    console.log('[saveManager] ✅ Salvo com sucesso!');
    
    StorageService.logAudit('ATUALIZACAO_GESTOR', `Gestor ${manager.username} atualizado/criado.`);

    // Sincronizar manager com Neon
    console.log('[saveManager] 🌐 Sincronizando com NEON...');
    syncToNeon('sync_manager', manager);
  },

  deleteManager: (id: string): void => {
    const list = StorageService.getManagers();
    const newList = list.filter(m => m.id !== id);
    localStorage.setItem(MANAGERS_KEY, JSON.stringify(newList));
    StorageService.logAudit('REMOCAO_GESTOR', `Gestor ID ${id} removido.`);

    // Sincronizar exclusão com Neon
    syncToNeon('delete_manager', { id });
  },

  // --- COOPERADOS ---

  refreshCooperadosFromRemote: async () => {
    try {
      const rows = await apiGet<any[]>('cooperados');
      if (!Array.isArray(rows)) return;

      const mapped: Cooperado[] = rows.map((row: any) => ({
        id: row.id,
        nome: row.name || row.nome || '',
        cpf: row.cpf || '',
        matricula: row.matricula || '',
        especialidade: row.specialty || row.especialidade || '',
        telefone: row.phone || row.telefone || '',
        email: row.email || '',
        status: row.status || StatusCooperado.ATIVO,
        biometrias: row.biometrias || [],
        updatedAt: row.updated_at || new Date().toISOString()
      }));

      // Substitui completamente o localStorage com dados do Neon
      // Garante que IDs, deletados, etc. fiquem sincronizados
      localStorage.setItem(COOPERADOS_KEY, JSON.stringify(mapped));
      console.log('[COOPERADOS] Sincronizado:', mapped.length, 'registros do Neon');
    } catch (err) {
      console.warn('[COOPERADOS] Erro ao atualizar do Neon:', err);
    }
  },

  getCooperados: (): Cooperado[] => {
    const data = localStorage.getItem(COOPERADOS_KEY);
    return data ? JSON.parse(data) : [];
  },

  checkDuplicateCpfCooperado: (cpf: string, excludeId?: string): Cooperado | null => {
    const list = StorageService.getCooperados();
    const clean = (s: string) => (s || '').replace(/\D/g, '');
    const cpfLimpo = clean(cpf);
    const duplicado = list.find(c => clean(c.cpf || '') === cpfLimpo && c.id !== excludeId);
    return duplicado || null;
  },

  checkDuplicateMatriculaCooperado: (matricula: string, excludeId?: string): Cooperado | null => {
    const list = StorageService.getCooperados();
    const duplicado = list.find(c => c.matricula === matricula && c.id !== excludeId);
    return duplicado || null;
  },

  saveCooperado: (cooperado: Cooperado): void => {
    const list = StorageService.getCooperados();
    const clean = (s: string) => s.replace(/\D/g, '');
    const cpfNovo = clean(cooperado.cpf || '');
    const cpfDuplicado = StorageService.checkDuplicateCpfCooperado(cooperado.cpf, cooperado.id);
    if (cpfDuplicado) {
      return;
    }
    const matriculaDuplicada = StorageService.checkDuplicateMatriculaCooperado(cooperado.matricula, cooperado.id);
    if (matriculaDuplicada) {
      return;
    }
    const index = list.findIndex(c => c.id === cooperado.id);
    if (index >= 0) {
      list[index] = cooperado;
    } else {
      list.push(cooperado);
    }
    localStorage.setItem(COOPERADOS_KEY, JSON.stringify(list));
    StorageService.logAudit('ATUALIZACAO_CADASTRO', `Cooperado ${cooperado.nome} atualizado/criado.`);
    
    // Sincronizar com Neon (assíncrono)
    syncToNeon('sync_cooperado', {
      id: cooperado.id,
      nome: cooperado.nome,
      cpf: cooperado.cpf,
      email: cooperado.email,
      telefone: cooperado.telefone,
      matricula: cooperado.matricula,
      especialidade: cooperado.especialidade,
      status: cooperado.status
    });
  },

  deleteCooperado: (id: string): void => {
    // Ensure ID comparison is robust (string vs string)
    const list = StorageService.getCooperados();
    const newList = list.filter(c => String(c.id) !== String(id));
    localStorage.setItem(COOPERADOS_KEY, JSON.stringify(newList));
    StorageService.logAudit('REMOCAO_CADASTRO', `Cooperado ID ${id} removido.`);

    // Sincronizar exclusão com Neon
    syncToNeon('delete_cooperado', { id });
  },

  getPontos: (): RegistroPonto[] => {
    const data = localStorage.getItem(PONTOS_KEY);
    return data ? JSON.parse(data) : [];
  },

  refreshPontosFromRemote: async () => {
    try {
      const rows = await apiGet<any[]>('sync?action=list_pontos');
      if (!Array.isArray(rows)) return;

      console.log('[refreshPontosFromRemote] 📥 Pontos do Neon:', rows.length);

      // Buscar justificativas excluídas para filtrar pontos relacionados
      const justificativas = await apiGet<any[]>('sync?action=list_justificativas').catch(() => []);
      const justExcluidas = justificativas.filter(j => j.status === 'Excluído');
      console.log('[refreshPontosFromRemote] 🚫 Justificativas excluídas:', justExcluidas.length, justExcluidas.map(j => ({ id: j.id, pontoId: j.pontoId })));
      
      const pontosExcluidosIds = new Set<string>();
      justExcluidas.forEach(j => {
        if (j.pontoId) pontosExcluidosIds.add(j.pontoId);
      });
      console.log('[refreshPontosFromRemote] 🚫 IDs de pontos a serem filtrados:', Array.from(pontosExcluidosIds));

      // Buscar hospitais e setores para montar o campo local corretamente
      const hospitais = StorageService.getHospitais();
      
      const mapped: RegistroPonto[] = rows
        .filter(row => {
          // Ponto válido - não filtrar nada, hard delete já removeu do banco
          return true;
        })
        .map((row: any) => {
        // Usar código do banco se existir, caso contrário gerar
        let codigo = row.codigo;
        if (!codigo) {
          // Usar últimos 6 caracteres do ID sem hífens para gerar código numérico
          const idNumerico = row.id.replace(/-/g, '').slice(-6);
          codigo = parseInt(idNumerico, 16).toString().slice(-6).padStart(6, '0');
        }
        
        // Usar local do banco se existir, caso contrário buscar nome do hospital
        let local = row.local || 'Não especificado';
        if (!row.local && row.hospitalId) {
          const hospital = hospitais.find(h => h.id === row.hospitalId);
          if (hospital) {
            local = hospital.nome;
          }
        }

        const isManual = row.isManual === true 
          || row.isManual === 'true' 
          || row.isManual === 1 
          || row.isManual === '1'
          || (row.codigo && String(row.codigo).startsWith('MAN-'))
          || row.status === 'Aguardando autorização'
          || row.status === 'Pendente';

        let status: string | undefined = row.status;
        
        // CRÍTICO: Preservar status de pontos validados/rejeitados
        if (row.validadoPor || row.status === 'Fechado') {
          status = 'Fechado';
        } else if (row.rejeitadoPor || row.status === 'Rejeitado') {
          status = 'Rejeitado';
        } else if (isManual) {
          // Força aguardando APENAS para manuais NÃO validados/rejeitados
          if (!status || status === 'Aberto' || status === 'Pendente') {
            status = 'Aguardando autorização';
          }
        } else {
          status = status || (row.tipo === 'SAIDA' ? 'Fechado' : 'Aberto');
        }
        
        return {
          id: row.id,
          codigo: codigo,
          cooperadoId: row.cooperadoId,
          cooperadoNome: row.cooperadoNome,
          timestamp: row.timestamp || row.createdAt,
          tipo: row.tipo,
          data: row.date,
          entrada: row.entrada,
          saida: row.saida,
          local: local,
          hospitalId: row.hospitalId,
          setorId: row.setorId,
          observacao: row.observacao || '',
          relatedId: row.relatedId,
          status,
          isManual,
          validadoPor: row.validadoPor,
          rejeitadoPor: row.rejeitadoPor,
          motivoRejeicao: row.motivoRejeicao,
          justificativa: row.justificativa,
          biometriaEntradaHash: row.biometriaEntradaHash,
          biometriaSaidaHash: row.biometriaSaidaHash
        };
      });

      // Preservar registros manuais locais que ainda não estão no Neon
      const localExisting = StorageService.getPontos();
      const localManual = localExisting.filter(p => p.isManual === true || p.isManual === 'true' || p.isManual === 1 || p.isManual === '1' || (p.codigo && String(p.codigo).startsWith('MAN-')));
      
      // Filtrar pontos manuais locais que estão relacionados a justificativas excluídas
      const localManualFiltrado = localManual.filter(p => {
        if (pontosExcluidosIds.has(p.id) || (p.relatedId && pontosExcluidosIds.has(p.relatedId))) {
          console.log('[refreshPontosFromRemote] 🚫 Removendo ponto manual local excluído:', p.id, p.codigo);
          return false;
        }
        return true;
      });
      
      const merged = [
        ...mapped,
        ...localManualFiltrado.filter(l => !mapped.some(r => r.id === l.id))
      ];

      localStorage.setItem(PONTOS_KEY, JSON.stringify(merged));
      console.log(`[StorageService] ✅ ${mapped.length} pontos do Neon + ${localManualFiltrado.length} manuais locais preservados (${localManual.length - localManualFiltrado.length} excluídos)`);
    } catch (err) {
      console.error('[StorageService] Erro ao sincronizar pontos do Neon:', err);
    }
  },

  savePonto: (ponto: RegistroPonto): void => {
    const list = StorageService.getPontos();
    list.push(ponto);
    localStorage.setItem(PONTOS_KEY, JSON.stringify(list));
    StorageService.logAudit('REGISTRO_PRODUCAO', `Produção (${ponto.tipo}) registrada para ${ponto.cooperadoNome}. Status: ${ponto.status}`);
    
    // Sincronizar com Neon (assíncrono)
    syncToNeon('sync_ponto', {
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
      validadoPor: ponto.validadoPor,
      rejeitadoPor: ponto.rejeitadoPor,
      motivoRejeicao: ponto.motivoRejeicao,
      relatedId: ponto.relatedId,
      status: ponto.status,
      isManual: ponto.isManual
    });

    broadcastPontoChange('save', ponto.id);
  },

  updatePonto: (ponto: RegistroPonto): void => {
    const list = StorageService.getPontos();
    const index = list.findIndex(p => p.id === ponto.id);
    if (index !== -1) {
        list[index] = ponto;
        localStorage.setItem(PONTOS_KEY, JSON.stringify(list));
        
        // Sincronizar com Neon (assíncrono)
        syncToNeon('sync_ponto', {
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
          validadoPor: ponto.validadoPor,
          rejeitadoPor: ponto.rejeitadoPor,
          motivoRejeicao: ponto.motivoRejeicao,
          relatedId: ponto.relatedId,
          status: ponto.status,
          isManual: ponto.isManual
        });

        broadcastPontoChange('update', ponto.id);
    }
  },

  deletePonto: (id: string): void => {
    // Suporte a IDs sintéticos de justificativa (ex.: just-<justId>-ent|sai)
    const justMatch = /^just-(.+)-(ent|sai)$/.exec(id);
    if (justMatch) {
      const justificativaId = justMatch[1];
      console.log('[deletePonto] 🧹 Detected synthetic ID, deleting justificativa from Neon:', justificativaId);

      // Deletar SOMENTE no Neon (não manter em localStorage)
      StorageService.logAudit('REMOCAO_JUSTIFICATIVA', `Justificativa ${justificativaId} removida permanentemente.`);
      syncToNeon('delete_justificativa', { id: justificativaId });
      
      // Notificar para reload
      broadcastPontoChange('delete', id);
      return;
    }

    let pontos = StorageService.getPontos();
    const target = pontos.find(p => p.id === id);
    
    if (!target) {
      console.warn('[deletePonto] Ponto não encontrado:', id);
      return;
    }

    console.log('[deletePonto] 🗑️ Hard delete do ponto:', id, 'tipo:', target.tipo, 'codigo:', target.codigo, 'cooperado:', target.cooperadoNome);

    // HARD DELETE: Remover completamente o ponto do localStorage
    pontos = pontos.filter(p => p.id !== id);
    localStorage.setItem(PONTOS_KEY, JSON.stringify(pontos));
    console.log('[deletePonto] ✅ Ponto removido do localStorage');

    // Se há um ponto relacionado (relatedId), deletar também
    if (target.relatedId) {
      const relatedPonto = pontos.find(p => p.id === target.relatedId);
      if (relatedPonto) {
        console.log('[deletePonto] 🔗 Deletando ponto relacionado:', target.relatedId);
        pontos = pontos.filter(p => p.id !== target.relatedId);
      }
    }
    
    localStorage.setItem(PONTOS_KEY, JSON.stringify(pontos));

    // HARD DELETE: Remover justificativas relacionadas (EXCETO as recusadas)
    let justificativas = StorageService.getJustificativas();
    const plantaoDate = new Date(target.timestamp).toISOString().split('T')[0];
    
    console.log('[deletePonto] 🔍 Buscando justificativas relacionadas ao ponto:', {
      pontoId: id,
      cooperadoId: target.cooperadoId,
      dataPlantao: plantaoDate,
      totalJustificativas: justificativas.length
    });
    
    const justRemovidas = justificativas.filter(j => {
      const matchPontoId = j.pontoId === id;
      const matchCooperadoData = j.cooperadoId === target.cooperadoId && j.dataPlantao === plantaoDate;
      const naoRecusada = j.status !== 'Rejeitado' && j.status !== 'Recusado';
      const shouldRemove = (matchPontoId || matchCooperadoData) && naoRecusada;
      
      if (shouldRemove) {
        console.log('[deletePonto] 🎯 Justificativa será removida do Neon:', {
          id: j.id,
          status: j.status,
          pontoId: j.pontoId,
          matchPontoId,
          matchCooperadoData
        });
      }
      
      return shouldRemove;
    });
    
    if (justRemovidas.length > 0) {
      console.log('[deletePonto] 🚫 Deletando', justRemovidas.length, 'justificativa(s) do Neon (mantendo recusadas).');
      
      // Deletar SOMENTE no Neon (não manter em localStorage)
      justRemovidas.forEach(j => {
        console.log('[deletePonto] 🔄 Deletando justificativa do Neon:', j.id, 'status:', j.status);
        syncToNeon('delete_justificativa', { id: j.id });
      });
    } else {
      console.log('[deletePonto] ℹ️ Nenhuma justificativa aprovada/pendente encontrada para remover');
    }

    StorageService.logAudit('REMOCAO_PONTO', `Registro ${target.codigo} removido permanentemente.`);

    // Sincronizar exclusão com Neon (hard delete)
    console.log('[deletePonto] 🔄 Deletando ponto do Neon:', id);
    syncToNeon('delete_ponto', { id });
    
    // Se há ponto relacionado, deletar também no Neon
    if (target.relatedId) {
      console.log('[deletePonto] 🔄 Deletando ponto relacionado do Neon:', target.relatedId);
      syncToNeon('delete_ponto', { id: target.relatedId });
    }
    
    // Notificar cooperados para limparem cache (dupla notificação para garantir)
    broadcastPontoChange('delete', id);
    
    const notificationKey = 'biohealth_plantao_deleted';
    const notification = { timestamp: Date.now(), pontoId: id };
    localStorage.setItem(notificationKey, JSON.stringify(notification));
    console.log('[deletePonto] 📢 Notificação de exclusão enviada (biohealth_plantao_deleted + biohealth_pontos_changed)');
  },

  clearCacheAndReload: async (): Promise<void> => {
    console.log('[clearCacheAndReload] 🧹 Limpando cache local e recarregando do Neon...');
    
    try {
      // Forçar recarregamento de todos os dados do Neon
      await Promise.all([
        StorageService.refreshPontosFromRemote(),
        StorageService.refreshJustificativasFromRemote(),
        StorageService.refreshCooperadosFromRemote(),
        StorageService.refreshHospitaisFromRemote()
      ]);
      
      console.log('[clearCacheAndReload] ✅ Cache limpo e dados recarregados com sucesso');
      
      // Notificar outras abas/cooperados via localStorage event
      const notificationKey = 'biohealth_data_updated';
      const notification = { timestamp: Date.now(), type: 'plantao_deleted' };
      localStorage.setItem(notificationKey, JSON.stringify(notification));
      console.log('[clearCacheAndReload] 📢 Notificação enviada para outras abas');
    } catch (err) {
      console.error('[clearCacheAndReload] ❌ Erro ao recarregar dados:', err);
    }
  },

  getLastPonto: (cooperadoId: string): RegistroPonto | undefined => {
    const list = StorageService.getPontos();
    const userPontos = list.filter(p => p.cooperadoId === cooperadoId && p.status !== 'Rejeitado' && p.status !== 'Pendente');
    return userPontos.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  },

  getHospitais: (): Hospital[] => {
    const data = localStorage.getItem(HOSPITAIS_KEY);
    return data ? JSON.parse(data) : [];
  },

  refreshHospitaisFromRemote: async () => {
    try {
      const rows = await apiGet<any[]>('hospitals');
      if (!Array.isArray(rows)) return;

      const defaultPerms: HospitalPermissions = {
        dashboard: false,
        ponto: false,
        relatorio: false,
        relatorios: false,
        cadastro: false,
        hospitais: false,
        biometria: false,
        auditoria: false,
        gestao: false,
        espelho: false,
        autorizacao: false,
        perfil: false,
      };

      const mapped: Hospital[] = rows.map((row: any) => {
        const endereco = typeof row.endereco === 'string' ? (() => { try { return JSON.parse(row.endereco); } catch { return undefined; } })() : row.endereco;
        const permissoes = typeof row.permissoes === 'string' ? (() => { try { return JSON.parse(row.permissoes); } catch { return {}; } })() : (row.permissoes || {});
        const setores = typeof row.setores === 'string' ? (() => { try { return JSON.parse(row.setores); } catch { return []; } })() : (row.setores || []);
        return {
          id: row.id,
          nome: row.nome,
          slug: row.slug,
          usuarioAcesso: row.usuario_acesso || '',
          senha: row.senha || '',
          endereco,
          permissoes: { ...defaultPerms, ...permissoes },
          setores,
        } as Hospital;
      });

      localStorage.setItem(HOSPITAIS_KEY, JSON.stringify(mapped));
    } catch (err) {
      console.warn('[HOSPITAIS] Erro ao atualizar do Neon:', err);
    }
  },

  getHospitalBySlug: (slug: string): Hospital | undefined => {
    const list = StorageService.getHospitais();
    return list.find(h => h.slug === slug);
  },

  saveHospital: (hospital: Hospital): void => {
    const list = StorageService.getHospitais();
    const index = list.findIndex(h => h.id === hospital.id);
    if (index >= 0) {
      list[index] = hospital;
    } else {
      list.push(hospital);
    }
    localStorage.setItem(HOSPITAIS_KEY, JSON.stringify(list));
    StorageService.logAudit('ATUALIZACAO_HOSPITAL', `Hospital ${hospital.nome} atualizado.`);

    // Sincronizar hospital com Neon
    syncToNeon('sync_hospital', hospital);
  },

  deleteHospital: (id: string): void => {
    const list = StorageService.getHospitais();
    const newList = list.filter(h => h.id !== id);
    localStorage.setItem(HOSPITAIS_KEY, JSON.stringify(newList));
    StorageService.logAudit('REMOCAO_HOSPITAL', `Hospital ID ${id} removido.`);

    // Sincronizar exclusão com Neon
    syncToNeon('delete_hospital', { id });
  },

  // Category Management
  getCategorias: (): string[] => {
    const data = localStorage.getItem(CATEGORIAS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveCategoria: (categoria: string): void => {
    const list = StorageService.getCategorias();
    if (!list.includes(categoria)) {
      list.push(categoria);
      // Sort alphabetically for better UX
      list.sort();
      localStorage.setItem(CATEGORIAS_KEY, JSON.stringify(list));
      StorageService.logAudit('NOVA_CATEGORIA', `Categoria profissional '${categoria}' adicionada.`);
    }
  },

  logAudit: (action: string, details: string) => {
    const logs: AuditLog[] = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
    const session = StorageService.getSession();
    const username = session?.user?.username || session?.user?.usuarioAcesso || session?.user?.matricula || 'SYSTEM';
    
    const newLog = {
      id: crypto.randomUUID(),
      action,
      details,
      timestamp: new Date().toISOString(),
      user: username
    };
    
    logs.unshift(newLog);
    localStorage.setItem(AUDIT_KEY, JSON.stringify(logs.slice(0, 100))); // Keep last 100

    // TODO: Sincronizar audit log com Neon quando endpoint estiver disponível
    // syncToNeon('sync_audit', newLog);
  },

  getAuditLogs: (): AuditLog[] => {
    return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
  },

  // Device / App Config (Local)
  getConfiguredHospitalId: (): string | null => {
    return localStorage.getItem('APP_HOSPITAL_ID');
  },

  setConfiguredHospitalId: (id: string) => {
    localStorage.setItem('APP_HOSPITAL_ID', id);
  },

  clearConfiguredHospital: () => {
    localStorage.removeItem('APP_HOSPITAL_ID');
  },

  // --- JUSTIFICATIVAS ---
  
  getJustificativas: (): Justificativa[] => {
    const data = localStorage.getItem(JUSTIFICATIVAS_KEY);
    const parsed: Justificativa[] = data ? JSON.parse(data) : [];

    // Normalizar status antigos "Aguardando autorização" para "Pendente" para que apareçam na fila do gestor
    const normalized = parsed.map(j => {
      if (j.status === 'Aguardando autorização') {
        return { ...j, status: 'Pendente' as const };
      }
      return j;
    });

    // Persistir normalização
    if (normalized.length !== parsed.length || normalized.some((j, idx) => j.status !== parsed[idx].status)) {
      localStorage.setItem(JUSTIFICATIVAS_KEY, JSON.stringify(normalized));
    }

    return normalized;
  },

  getJustificativasByStatus: (status: 'Pendente' | 'Aprovada' | 'Rejeitada'): Justificativa[] => {
    return StorageService.getJustificativas().filter(j => j.status === status);
  },

  getJustificativasByCooperado: (cooperadoId: string): Justificativa[] => {
    return StorageService.getJustificativas().filter(j => j.cooperadoId === cooperadoId);
  },

  saveJustificativa: (justificativa: Justificativa): void => {
    console.log('[StorageService] 🌐 Salvando justificativa direto no Neon:', justificativa.id);
    
    // Salvar SOMENTE no Neon, sem cache local
    syncToNeon('sync_justificativa', justificativa);
    StorageService.logAudit('JUSTIFICATIVA_SALVA', `Justificativa ${justificativa.id} - ${justificativa.status}`);
  },

  aprovarJustificativa: (id: string, aprovadoPor: string): void => {
    const list = StorageService.getJustificativas();
    const index = list.findIndex(j => j.id === id);
    
    if (index >= 0) {
      const justificativa = list[index];
      const updated = {
        ...justificativa,
        status: 'Fechado',
        validadoPor: aprovadoPor,
        dataAprovacao: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Salvar SOMENTE no Neon
      console.log('[StorageService] 🌐 Aprovando justificativa no Neon:', id);
      syncToNeon('sync_justificativa', updated);
      StorageService.logAudit('JUSTIFICATIVA_APROVADA', `Justificativa ${id} aprovada por ${aprovadoPor}`);
    }
  },

  rejeitarJustificativa: (id: string, rejeitadoPor: string, motivoRejeicao: string): void => {
    const list = StorageService.getJustificativas();
    const index = list.findIndex(j => j.id === id);
    
    if (index >= 0) {
      const justificativa = list[index];
      const updated = {
        ...justificativa,
        status: 'Rejeitado',
        rejeitadoPor,
        motivoRejeicao,
        dataAprovacao: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Salvar SOMENTE no Neon
      console.log('[StorageService] 🌐 Rejeitando justificativa no Neon:', id);
      syncToNeon('sync_justificativa', updated);
      console.log('[StorageService] ❌ Justificativa rejeitada:', id);
      StorageService.logAudit('JUSTIFICATIVA_REJEITADA', `Justificativa ${id} rejeitada por ${rejeitadoPor}: ${motivoRejeicao}`);
    }
  },

  refreshJustificativasFromRemote: async () => {
    try {
      const rows = await apiGet<any[]>('sync?action=list_justificativas');
      if (!Array.isArray(rows)) return;

      const remoteJust: Justificativa[] = rows.map((row: any) => ({
        id: row.id,
        cooperadoId: row.cooperadoId,
        cooperadoNome: row.cooperadoNome,
        pontoId: row.pontoId,
        hospitalId: row.hospitalId,
        motivo: row.motivo,
        descricao: row.descricao,
        dataSolicitacao: row.dataSolicitacao,
        status: row.status === 'Aguardando autorização' ? 'Pendente' : row.status,
        validadoPor: row.validadoPor,
        rejeitadoPor: row.rejeitadoPor,
        motivoRejeicao: row.motivoRejeicao,
        setorId: row.setorId,
        dataPlantao: row.dataPlantao,
        entradaPlantao: row.entradaPlantao,
        saidaPlantao: row.saidaPlantao,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt || new Date().toISOString(),
        dataAprovacao: row.dataAprovacao
      }));

      // MERGE inteligente: manter justificativas locais recentes que ainda não foram sincronizadas
      const localJust = StorageService.getJustificativas();
      const remoteIds = new Set(remoteJust.map(j => j.id));
      
      console.log('[StorageService] 🔄 Merge - Justificativas locais:', localJust.length, 'Remotas:', remoteJust.length);
      console.log('[StorageService] 🔄 IDs remotos:', Array.from(remoteIds));
      
      // Manter justificativas locais criadas nos últimos 30 segundos que ainda não estão remotas
      const now = Date.now();
      const recentLocal = localJust.filter(j => {
        if (remoteIds.has(j.id)) {
          console.log('[StorageService] ⏭️  Justificativa', j.id, 'já está remota, pulando');
          return false;
        }
        const age = now - new Date(j.createdAt || j.dataSolicitacao).getTime();
        const isRecent = age < 30000;
        console.log('[StorageService] 🕐 Justificativa', j.id, 'idade:', Math.round(age/1000) + 's', isRecent ? '✅ MANTIDA' : '❌ DESCARTADA');
        return isRecent;
      });

      const merged = [...remoteJust, ...recentLocal];
      
      localStorage.setItem(JUSTIFICATIVAS_KEY, JSON.stringify(merged));
      console.log(`[StorageService] ✅ ${remoteJust.length} justificativas remotas + ${recentLocal.length} locais recentes = ${merged.length} total`);
      if (recentLocal.length > 0) {
        console.log('[StorageService] 📌 Justificativas locais preservadas:', recentLocal.map(j => j.id));
      }
    } catch (err) {
      console.error('[StorageService] Erro ao sincronizar justificativas do Neon:', err);
    }
  },

  // USER PREFERENCES
  getUserPreferences: (): UserPreferences | null => {
    const session = StorageService.getSession();
    if (!session?.user?.id) return null;

    const prefsMapRaw = localStorage.getItem(USER_PREFS_KEY);
    const prefsMap: Record<string, UserPreferences> = prefsMapRaw ? JSON.parse(prefsMapRaw) : {};
    const savedPrefs = prefsMap[String(session.user.id)];
    if (savedPrefs) {
      return { ...DEFAULT_USER_PREFERENCES, ...savedPrefs };
    }

    const managers = StorageService.getManagers();
    const manager = managers.find(m => String(m.id) === String(session.user.id));
    if (manager?.preferences) {
      return { ...DEFAULT_USER_PREFERENCES, ...manager.preferences };
    }

    return DEFAULT_USER_PREFERENCES;
  },

  saveUserPreferences: (preferences: UserPreferences) => {
    const session = StorageService.getSession();
    if (!session?.user?.id) return;

    const normalizedPrefs: UserPreferences = { ...DEFAULT_USER_PREFERENCES, ...preferences, theme: preferences.theme ?? 'auto' };

    const prefsMapRaw = localStorage.getItem(USER_PREFS_KEY);
    const prefsMap: Record<string, UserPreferences> = prefsMapRaw ? JSON.parse(prefsMapRaw) : {};
    prefsMap[String(session.user.id)] = normalizedPrefs;
    localStorage.setItem(USER_PREFS_KEY, JSON.stringify(prefsMap));

    const managers = StorageService.getManagers();
    const index = managers.findIndex(m => String(m.id) === String(session.user.id));
    
    if (index >= 0) {
      managers[index].preferences = normalizedPrefs;
      localStorage.setItem(MANAGERS_KEY, JSON.stringify(managers));
      StorageService.logAudit('PREFERENCIAS_ATUALIZADAS', `Preferências de tema e abas atualizadas`);
      syncToNeon('sync_manager', managers[index]);
    } else {
      StorageService.logAudit('PREFERENCIAS_ATUALIZADAS', `Preferências de tema e abas atualizadas`);
    }
  }
};
