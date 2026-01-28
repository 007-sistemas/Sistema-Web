import { normalizeNome } from './normalize';
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
    // LocalStorage para outras abas/janelas
    localStorage.setItem(notificationKey, JSON.stringify(notification));
    
    // CustomEvent para mesma aba (StorageEvent não funciona na mesma aba)
    const customEvent = new CustomEvent('biohealth:pontos:changed', { 
      detail: notification 
    });
    window.dispatchEvent(customEvent);
    
    console.log('[broadcastPontoChange] 📢 Enviado (localStorage + CustomEvent):', notification);
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
        categoriaProfissional: row.specialty || row.categoriaProfissional || '',
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
      categoriaProfissional: cooperado.categoriaProfissional,
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
      const pontos = await apiGet<any[]>('pontos');
      if (!Array.isArray(pontos)) return;

      // Buscar justificativas excluídas para filtrar pontos relacionados
      const justificativas = await apiGet<any[]>('sync?action=list_justificativas').catch(() => []);
      const justExcluidas = justificativas.filter(j => j.status === 'Excluído');
      
      const pontosExcluidosIds = new Set<string>();
      justExcluidas.forEach(j => {
        if (j.pontoId) pontosExcluidosIds.add(j.pontoId);
      });

      // Buscar hospitais e setores para montar o campo local corretamente
      const hospitais = StorageService.getHospitais();
      
      const mapped: RegistroPonto[] = pontos
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
      console.log('[deletePonto] 🧹 Detected synthetic ID, removing justificativa:', justificativaId);

      // ❌ NUNCA remover do localStorage - sempre sincronizar com Neon
      console.log('[deletePonto] 🌐 Enviando deleção para Neon:', justificativaId);

      // Auditoria e sync Neon
      StorageService.logAudit('REMOCAO_JUSTIFICATIVA', `Justificativa ${justificativaId} removida permanentemente.`);
      syncToNeon('delete_justificativa', { id: justificativaId });
      
      // Notificar mudança
      broadcastPontoChange('delete', justificativaId);
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

    // HARD DELETE: Remover justificativas relacionadas do Neon (EXCETO as recusadas)
    // Não buscar do localStorage, diretamente notificar Neon para deletar
    const plantaoDate = new Date(target.timestamp).toISOString().split('T')[0];
    
    console.log('[deletePonto] 🔍 Notificando Neon para remover justificativas relacionadas:', {
      pontoId: id,
      cooperadoId: target.cooperadoId,
      dataPlantao: plantaoDate
    });
    
    // Enviar notificação ao Neon para deletar justificativas relacionadas
    // Neon terá a lógica de excluir apenas aprovadas/pendentes (não recusadas)
    syncToNeon('delete_justificativas_by_ponto', { 
      pontoId: id,
      cooperadoId: target.cooperadoId,
      dataPlantao: plantaoDate,
      excludeStatuses: ['Rejeitado', 'Recusado']
    });
    
    console.log('[deletePonto] 🚫 Requisição de remoção de justificativas enviada ao Neon');


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
    
    // Disparar evento customizado para mesma aba (StorageEvent não funciona na mesma aba)
    const customEvent = new CustomEvent('biohealth:plantao:deleted', { 
      detail: { pontoId: id, timestamp: Date.now() } 
    });
    window.dispatchEvent(customEvent);
    
    console.log('[deletePonto] 📢 Notificação de exclusão enviada (biohealth_plantao_deleted + biohealth_pontos_changed + CustomEvent)');
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
    // NUNCA usar localStorage para justificativas
    // Sempre retornar array vazio - dados devem vir do Neon via refreshJustificativasFromRemote()
    console.warn('[getJustificativas] ⚠️ Justificativas devem ser carregadas via Neon, não localStorage');
    return [];
  },

  getJustificativasByStatus: (status: 'Pendente' | 'Aprovada' | 'Rejeitada'): Justificativa[] => {
    return StorageService.getJustificativas().filter(j => j.status === status);
  },

  getJustificativasByCooperado: (cooperadoId: string): Justificativa[] => {
    return StorageService.getJustificativas().filter(j => j.cooperadoId === cooperadoId);
  },

  saveJustificativa: (justificativa: Justificativa): void => {
    // ❌ NUNCA salvar em localStorage
    // Enviar DIRETAMENTE ao Neon via API
    console.log('[StorageService] 🌐 Enviando justificativa DIRETAMENTE para Neon:', justificativa.id);
    StorageService.logAudit('JUSTIFICATIVA_CRIADA', `Justificativa ${justificativa.id} criada - Status: ${justificativa.status}`);
    
    // Sincronizar com Neon
    syncToNeon('sync_justificativa', justificativa);
    
    // Notificar todas as abas/componentes
    broadcastPontoChange('save', justificativa.id);
  },

  aprovarJustificativa: (id: string, aprovadoPor: string): void => {
    // ❌ NUNCA modificar localStorage
    // Enviar update DIRETAMENTE ao Neon
    const justificativaUpdate = {
      id,
      status: 'Fechado',
      validadoPor: aprovadoPor,
      dataAprovacao: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log('[StorageService] ✅ Aprovando justificativa DIRETAMENTE no Neon:', id);
    StorageService.logAudit('JUSTIFICATIVA_APROVADA', `Justificativa ${id} aprovada por ${aprovadoPor}`);
    
    // Sincronizar com Neon
    syncToNeon('sync_justificativa', justificativaUpdate);
    
    // Notificar mudança
    broadcastPontoChange('update', id);
  },

  rejeitarJustificativa: (id: string, rejeitadoPor: string, motivoRejeicao: string): void => {
    // ❌ NUNCA modificar localStorage
    // Enviar update DIRETAMENTE ao Neon
    const justificativaUpdate = {
      id,
      status: 'Rejeitado',
      rejeitadoPor,
      motivoRejeicao,
      dataAprovacao: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log('[StorageService] ❌ Rejeitando justificativa DIRETAMENTE no Neon:', id);
    StorageService.logAudit('JUSTIFICATIVA_REJEITADA', `Justificativa ${id} rejeitada por ${rejeitadoPor}: ${motivoRejeicao}`);
    
    // Sincronizar com Neon
    syncToNeon('sync_justificativa', justificativaUpdate);
    
    // Notificar mudança
    broadcastPontoChange('delete', id);
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

      // ❌ NUNCA mesclar com localStorage
      // Usar APENAS dados remotos do Neon
      console.log('[StorageService] 🔄 Sync Justificativas - Total remotas do Neon:', remoteJust.length);
      
      // NÃO guardar em localStorage - dados virão do Neon sempre
      // localStorage.setItem(JUSTIFICATIVAS_KEY, JSON.stringify(remoteJust));
      
      console.log(`[StorageService] ✅ ${remoteJust.length} justificativas sincronizadas do Neon`);
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
