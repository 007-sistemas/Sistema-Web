
import { Cooperado, RegistroPonto, AuditLog, StatusCooperado, Hospital, Manager, HospitalPermissions, Justificativa } from '../types';
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
      const rows = await apiGet<any[]>('pontos');
      if (!Array.isArray(rows)) return;

      // Buscar hospitais e setores para montar o campo local corretamente
      const hospitais = StorageService.getHospitais();
      
      const mapped: RegistroPonto[] = rows.map((row: any) => {
        // Gerar código de 6 dígitos baseado no timestamp ou ID se não existir
        let codigo = row.codigo;
        if (!codigo) {
          // Usar últimos 6 caracteres do ID sem hífens para gerar código numérico
          const idNumerico = row.id.replace(/-/g, '').slice(-6);
          codigo = parseInt(idNumerico, 16).toString().slice(-6).padStart(6, '0');
        }
        
        // Montar campo local com nomes reais
        let local = 'Não especificado';
        if (row.hospitalId) {
          const hospital = hospitais.find(h => h.id === row.hospitalId);
          if (hospital) {
            local = hospital.nome;
            // Se tiver setor, pode adicionar também (mas geralmente o setorId é usado separadamente)
          }
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
          status: row.tipo === 'SAIDA' ? 'Fechado' : 'Aberto',
          isManual: row.isManual || false,
          biometriaEntradaHash: row.biometriaEntradaHash,
          biometriaSaidaHash: row.biometriaSaidaHash
        };
      });

      localStorage.setItem(PONTOS_KEY, JSON.stringify(mapped));
      console.log(`[StorageService] ✅ ${mapped.length} pontos sincronizados do Neon`);
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
      relatedId: ponto.relatedId,
      status: ponto.status,
      isManual: ponto.isManual
    });
  },

  updatePonto: (ponto: RegistroPonto): void => {
    const list = StorageService.getPontos();
    const index = list.findIndex(p => p.id === ponto.id);
    if (index !== -1) {
        list[index] = ponto;
        localStorage.setItem(PONTOS_KEY, JSON.stringify(list));
    }
  },

  deletePonto: (id: string): void => {
    let list = StorageService.getPontos();
    const target = list.find(p => p.id === id);
    
    if (!target) return;

    // Logic: If deleting Entry, delete linked Exit. If deleting Exit, open Entry.
    if (target.tipo === 'ENTRADA') {
        // Delete this entry AND any exit that refers to it
        list = list.filter(p => p.id !== id && p.relatedId !== id);
    } else if (target.tipo === 'SAIDA') {
        // Delete this exit AND update the related Entry to "Aberto"
        if (target.relatedId) {
            const entryIndex = list.findIndex(p => p.id === target.relatedId);
            if (entryIndex !== -1) {
                list[entryIndex].status = 'Aberto';
            }
        }
        list = list.filter(p => p.id !== id);
    }

    localStorage.setItem(PONTOS_KEY, JSON.stringify(list));
    StorageService.logAudit('REMOCAO_PONTO', `Registro ${target.codigo} removido.`);

    // Sincronizar exclusão com Neon
    syncToNeon('delete_ponto', { id });
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
    return data ? JSON.parse(data) : [];
  },

  getJustificativasByStatus: (status: 'Pendente' | 'Aprovada' | 'Rejeitada'): Justificativa[] => {
    return StorageService.getJustificativas().filter(j => j.status === status);
  },

  getJustificativasByCooperado: (cooperadoId: string): Justificativa[] => {
    return StorageService.getJustificativas().filter(j => j.cooperadoId === cooperadoId);
  },

  saveJustificativa: (justificativa: Justificativa): void => {
    const list = StorageService.getJustificativas();
    const index = list.findIndex(j => j.id === justificativa.id);
    
    if (index >= 0) {
      list[index] = { ...justificativa, updatedAt: new Date().toISOString() };
    } else {
      list.push(justificativa);
    }
    
    localStorage.setItem(JUSTIFICATIVAS_KEY, JSON.stringify(list));
    StorageService.logAudit('JUSTIFICATIVA_SALVA', `Justificativa ${justificativa.id} - ${justificativa.status}`);

    // Sincronizar com Neon
    syncToNeon('sync_justificativa', justificativa);
  },

  aprovarJustificativa: (id: string, aprovadoPor: string): void => {
    const list = StorageService.getJustificativas();
    const index = list.findIndex(j => j.id === id);
    
    if (index >= 0) {
      list[index] = {
        ...list[index],
        status: 'Aprovada',
        aprovadoPor,
        dataAprovacao: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      localStorage.setItem(JUSTIFICATIVAS_KEY, JSON.stringify(list));
      StorageService.logAudit('JUSTIFICATIVA_APROVADA', `Justificativa ${id} aprovada por ${aprovadoPor}`);
      
      // Sincronizar com Neon
      syncToNeon('sync_justificativa', list[index]);
    }
  },

  rejeitarJustificativa: (id: string, aprovadoPor: string, motivoRejeicao: string): void => {
    const list = StorageService.getJustificativas();
    const index = list.findIndex(j => j.id === id);
    
    if (index >= 0) {
      list[index] = {
        ...list[index],
        status: 'Rejeitada',
        aprovadoPor,
        motivoRejeicao,
        dataAprovacao: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      localStorage.setItem(JUSTIFICATIVAS_KEY, JSON.stringify(list));
      StorageService.logAudit('JUSTIFICATIVA_REJEITADA', `Justificativa ${id} rejeitada por ${aprovadoPor}: ${motivoRejeicao}`);
      
      // Sincronizar com Neon
      syncToNeon('sync_justificativa', list[index]);
    }
  },

  // USER PREFERENCES
  getUserPreferences: () => {
    const session = StorageService.getSession();
    if (!session?.user?.id) return null;

    const managers = StorageService.getManagers();
    const manager = managers.find(m => m.id === session.user.id);
    
    return manager?.preferences || {
      theme: 'auto',
      primaryColor: '#7c3aed', // Default roxo
      // IDs devem bater com Layout: dashboard, ponto, relatorio, relatorios, autorizacao, cadastro, hospitais, biometria, auditoria, gestao, perfil
      visibleTabs: ['dashboard', 'ponto', 'relatorio', 'relatorios', 'autorizacao', 'cadastro', 'hospitais', 'biometria', 'auditoria', 'gestao', 'perfil'],
      tabOrder: ['dashboard', 'ponto', 'relatorio', 'relatorios', 'autorizacao', 'cadastro', 'hospitais', 'biometria', 'auditoria', 'gestao', 'perfil']
    };
  },

  saveUserPreferences: (preferences: any) => {
    const session = StorageService.getSession();
    if (!session?.user?.id) return;

    const managers = StorageService.getManagers();
    const index = managers.findIndex(m => m.id === session.user.id);
    
    if (index >= 0) {
      managers[index].preferences = preferences;
      localStorage.setItem(MANAGERS_KEY, JSON.stringify(managers));
      StorageService.logAudit('PREFERENCIAS_ATUALIZADAS', `Preferências de tema e abas atualizadas`);
      syncToNeon('sync_manager', managers[index]);
    }
  }
};
