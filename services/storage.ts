
import { Cooperado, RegistroPonto, AuditLog, StatusCooperado, Hospital, Manager, HospitalPermissions } from '../types';

const COOPERADOS_KEY = 'biohealth_cooperados';
const PONTOS_KEY = 'biohealth_pontos';
const AUDIT_KEY = 'biohealth_audit';
const HOSPITAIS_KEY = 'biohealth_hospitais';
const MANAGERS_KEY = 'biohealth_managers';
const CATEGORIAS_KEY = 'biohealth_categorias';
const SESSION_KEY = 'biohealth_session';

// Initial Seed Data
const seedData = () => {
  // SEED MASTER USER
  if (!localStorage.getItem(MANAGERS_KEY)) {
    const masterUser: Manager = {
      id: 'master-001',
      username: 'gabriel',
      password: 'gabriel',
      permissoes: {
        dashboard: true,
        ponto: true,
        relatorio: true,
        cadastro: true,
        hospitais: true,
        biometria: true,
        auditoria: true,
        gestao: true,
        espelho: false, // Admins usually look at general reports, but can set true if needed
        autorizacao: true // Master has access to authorization
      }
    };
    localStorage.setItem(MANAGERS_KEY, JSON.stringify([masterUser]));
  }

  if (!localStorage.getItem(COOPERADOS_KEY)) {
    const initialCooperados: Cooperado[] = [
      {
        id: '1',
        nome: 'Dra. Ana Silva',
        cpf: '123.456.789-00',
        matricula: 'MED-2024-001',
        especialidade: 'Cardiologia',
        telefone: '(11) 99999-9999',
        email: 'ana.silva@coop.com',
        status: StatusCooperado.ATIVO,
        biometrias: [{ id: 'bio-1', fingerIndex: 1, hash: 'simulated_hash_xyz', createdAt: new Date().toISOString() }],
        updatedAt: new Date().toISOString()
      },
      {
        id: '2',
        nome: 'Enf. Carlos Souza',
        cpf: '321.654.987-00',
        matricula: 'ENF-2024-055',
        especialidade: 'Enfermeiro',
        telefone: '(11) 98888-8888',
        email: 'carlos.souza@coop.com',
        status: StatusCooperado.ATIVO,
        biometrias: [],
        updatedAt: new Date().toISOString()
      }
    ];
    localStorage.setItem(COOPERADOS_KEY, JSON.stringify(initialCooperados));
  }

  if (!localStorage.getItem(HOSPITAIS_KEY)) {
    const initialHospitais: Hospital[] = [
      {
        id: 'h1',
        nome: 'Hospital Regional Norte (HRN)',
        slug: 'hrn',
        usuarioAcesso: 'HSP-1001',
        senha: '123',
        endereco: {
          cep: '62000-000',
          logradouro: 'Av. John Sanford',
          numero: '1520',
          latitude: -3.682,
          longitude: -40.348,
          raio: 100
        },
        permissoes: {
          dashboard: true,
          ponto: true,
          relatorio: true,
          cadastro: false,
          hospitais: false,
          biometria: true,
          auditoria: false,
          gestao: false,
          espelho: false,
          autorizacao: false
        },
        setores: [
          { id: 's1', nome: 'UTI Adulto' },
          { id: 's2', nome: 'Emergência' },
          { id: 's3', nome: 'Centro Cirúrgico' }
        ]
      },
      {
        id: 'h2',
        nome: 'Hospital Regional do Sertão Central (HRSC)',
        slug: 'hrsc',
        usuarioAcesso: 'HSP-1002',
        senha: '123',
        endereco: {
          cep: '63800-000',
          logradouro: 'Rodovia CE 060',
          numero: 'S/N',
          latitude: -5.197,
          longitude: -39.296,
          raio: 100
        },
        permissoes: {
          dashboard: true,
          ponto: true,
          relatorio: true,
          cadastro: false,
          hospitais: false,
          biometria: true,
          auditoria: false,
          gestao: false,
          espelho: false,
          autorizacao: false
        },
        setores: [
          { id: 's4', nome: 'Clínica Médica' },
          { id: 's5', nome: 'Traumatologia' }
        ]
      },
      {
        id: 'h3',
        nome: 'Hospital Regional do Cariri (HRC)',
        slug: 'hrc',
        usuarioAcesso: 'HSP-1003',
        senha: '123',
        endereco: {
          cep: '63000-000',
          logradouro: 'Rua Catulo da Paixão Cearense',
          numero: 'S/N',
          latitude: -7.230,
          longitude: -39.310,
          raio: 100
        },
        permissoes: {
          dashboard: true,
          ponto: true,
          relatorio: true,
          cadastro: false,
          hospitais: false,
          biometria: true,
          auditoria: false,
          gestao: false,
          espelho: false,
          autorizacao: false
        },
        setores: [
          { id: 's6', nome: 'Neurologia' },
          { id: 's7', nome: 'AVC' }
        ]
      }
    ];
    localStorage.setItem(HOSPITAIS_KEY, JSON.stringify(initialHospitais));
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
  init: () => seedData(),

  // --- AUTHENTICATION & SESSION ---
  
  authenticate: (usernameOrCode: string, password: string): { type: 'MANAGER' | 'HOSPITAL' | 'COOPERADO', user: any, permissions: HospitalPermissions } | null => {
    // 1. Check Managers
    const managers: Manager[] = JSON.parse(localStorage.getItem(MANAGERS_KEY) || '[]');
    const manager = managers.find(m => m.username === usernameOrCode && m.password === password);
    
    if (manager) {
      return { 
        type: 'MANAGER', 
        user: manager,
        permissions: manager.permissoes 
      };
    }

    // 2. Check Hospitals
    const hospitals: Hospital[] = JSON.parse(localStorage.getItem(HOSPITAIS_KEY) || '[]');
    const hospital = hospitals.find(h => h.usuarioAcesso === usernameOrCode && h.senha === password);

    if (hospital) {
      return { 
        type: 'HOSPITAL', 
        user: hospital,
        permissions: hospital.permissoes 
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
                cadastro: false,
                hospitais: false,
                biometria: false,
                auditoria: false,
                gestao: false,
                testes: false,
                espelho: true, // Only access to Mirror
                autorizacao: false
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
    return data ? JSON.parse(data) : [];
  },

  saveManager: (manager: Manager): void => {
    const list = StorageService.getManagers();
    const index = list.findIndex(m => m.id === manager.id);
    if (index >= 0) {
      list[index] = manager;
    } else {
      list.push(manager);
    }
    localStorage.setItem(MANAGERS_KEY, JSON.stringify(list));
    StorageService.logAudit('ATUALIZACAO_GESTOR', `Gestor ${manager.username} atualizado/criado.`);
  },

  deleteManager: (id: string): void => {
    const list = StorageService.getManagers();
    const newList = list.filter(m => m.id !== id);
    localStorage.setItem(MANAGERS_KEY, JSON.stringify(newList));
    StorageService.logAudit('REMOCAO_GESTOR', `Gestor ID ${id} removido.`);
  },

  // --- COOPERADOS ---

  getCooperados: (): Cooperado[] => {
    const data = localStorage.getItem(COOPERADOS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveCooperado: (cooperado: Cooperado): void => {
    const list = StorageService.getCooperados();
    const index = list.findIndex(c => c.id === cooperado.id);
    if (index >= 0) {
      list[index] = cooperado;
    } else {
      list.push(cooperado);
    }
    localStorage.setItem(COOPERADOS_KEY, JSON.stringify(list));
    StorageService.logAudit('ATUALIZACAO_CADASTRO', `Cooperado ${cooperado.nome} atualizado/criado.`);
  },

  deleteCooperado: (id: string): void => {
    // Ensure ID comparison is robust (string vs string)
    const list = StorageService.getCooperados();
    const newList = list.filter(c => String(c.id) !== String(id));
    localStorage.setItem(COOPERADOS_KEY, JSON.stringify(newList));
    StorageService.logAudit('REMOCAO_CADASTRO', `Cooperado ID ${id} removido.`);
  },

  getPontos: (): RegistroPonto[] => {
    const data = localStorage.getItem(PONTOS_KEY);
    return data ? JSON.parse(data) : [];
  },

  savePonto: (ponto: RegistroPonto): void => {
    const list = StorageService.getPontos();
    list.push(ponto);
    localStorage.setItem(PONTOS_KEY, JSON.stringify(list));
    StorageService.logAudit('REGISTRO_PRODUCAO', `Produção (${ponto.tipo}) registrada para ${ponto.cooperadoNome}. Status: ${ponto.status}`);
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
  },

  deleteHospital: (id: string): void => {
    const list = StorageService.getHospitais();
    const newList = list.filter(h => h.id !== id);
    localStorage.setItem(HOSPITAIS_KEY, JSON.stringify(newList));
    StorageService.logAudit('REMOCAO_HOSPITAL', `Hospital ID ${id} removido.`);
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
    
    logs.unshift({
      id: crypto.randomUUID(),
      action,
      details,
      timestamp: new Date().toISOString(),
      user: username
    });
    localStorage.setItem(AUDIT_KEY, JSON.stringify(logs.slice(0, 100))); // Keep last 100
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
  }
};
