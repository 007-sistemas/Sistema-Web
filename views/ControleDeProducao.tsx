
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { RegistroPonto, Cooperado, Hospital, TipoPonto, Setor, Justificativa } from '../types';
import { apiGet } from '../services/api';
import { Search, Save, Trash2, Clock, Filter, X, ArrowRight, PlusCircle } from 'lucide-react';

// Interface auxiliar para exibição
interface ShiftRow {
  id: string; // ID da Entrada (ou da saída se for órfã)
  cooperadoNome: string;
  local: string;
  setorNome: string;
  data: string;
  entry?: RegistroPonto;
  exit?: RegistroPonto;
  status: string;
  statusDetails?: string;
}

interface Props {
  mode?: 'manager' | 'cooperado';
}

export const ControleDeProducao: React.FC<Props> = ({ mode = 'manager' }) => {
  const [logs, setLogs] = useState<RegistroPonto[]>([]);
  const [cooperados, setCooperados] = useState<Cooperado[]>([]);
  const [hospitais, setHospitais] = useState<Hospital[]>([]);
  const [setoresDisponiveis, setSetoresDisponiveis] = useState<Setor[]>([]);
  const [todosSetores, setTodosSetores] = useState<Setor[]>([]); // Setores de todos os hospitais para exibição
  const [session, setSession] = useState<any>(null);
  
  // --- FILTER STATE ---
  const [filterHospital, setFilterHospital] = useState('');
  const [filterSetor, setFilterSetor] = useState('');
  
  // Cooperado Filter State (Autocomplete)
  const [filterCooperado, setFilterCooperado] = useState(''); // Stores ID
  const [filterCooperadoInput, setFilterCooperadoInput] = useState(''); // Stores Display Text
  const [showFilterCooperadoSuggestions, setShowFilterCooperadoSuggestions] = useState(false);

  // Exibir/ocultar recusadas
  const [showRecusadas, setShowRecusadas] = useState(false);

  const [filterDataIni, setFilterDataIni] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');

  // Selection State
  const [selectedPontoId, setSelectedPontoId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null); // Para rastrear qual é a entrada
  const [selectedExitId, setSelectedExitId] = useState<string | null>(null); // Para rastrear qual é a saída
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set()); // IDs das linhas selecionadas para exclusão

  // Form State
  const [formCooperadoId, setFormCooperadoId] = useState('');
  const [formCooperadoInput, setFormCooperadoInput] = useState(''); // Text input for autocomplete
  const [showCooperadoSuggestions, setShowCooperadoSuggestions] = useState(false);

  const [formSetorId, setFormSetorId] = useState('');
  const [formData, setFormData] = useState(''); // Date string YYYY-MM-DD
  const [formHora, setFormHora] = useState(''); // Time string HH:MM
  const [formTipo, setFormTipo] = useState<TipoPonto>(TipoPonto.ENTRADA);
  const [formInputCodigo, setFormInputCodigo] = useState(''); // For Exit to reference Entry

  // Justificativa State (modo cooperado)
  // Removido: justificativa parcial de horário (entrada/saída)

  // Registro completo de plantão não registrado (modo cooperado)
  const [missingHospitalId, setMissingHospitalId] = useState('');
  const [missingSetorId, setMissingSetorId] = useState('');
  const [missingDate, setMissingDate] = useState('');
  const [missingEntrada, setMissingEntrada] = useState('');
  const [missingSaida, setMissingSaida] = useState('');
  const [missingReason, setMissingReason] = useState('');
  const [missingDesc, setMissingDesc] = useState('');
  const [missingSetores, setMissingSetores] = useState<Setor[]>([]);

  // Dados do cooperado logado (modo cooperado)
  const cooperadoLogadoId = mode === 'cooperado' && session?.type === 'COOPERADO' ? session?.user?.id : null;
  const cooperadoLogadoData = mode === 'cooperado' && session?.type === 'COOPERADO' ? session?.user : null;

  // Helper para normalizar status recusado/rejeitado (declarado primeiro para uso em loadData)
  const isRecusadoStatus = (status?: string | null) => {
    if (!status) return false;
    const normalized = status.trim().toLowerCase();
    return normalized === 'rejeitado' || normalized === 'recusado' || normalized === 'recusada';
  };

  // Helper para matching de cooperado por ID ou nome
  const matchesCooperadoLogado = (justificativa: Justificativa): boolean => {
    if (!cooperadoLogadoId && !cooperadoLogadoData?.nome) return false;
    const sameId = cooperadoLogadoId ? justificativa.cooperadoId === cooperadoLogadoId : false;
    const sameName = cooperadoLogadoData?.nome ? justificativa.cooperadoNome?.trim().toLowerCase() === cooperadoLogadoData.nome.trim().toLowerCase() : false;
    const matches = sameId || sameName;
    console.log('[matchCooperado] Justificativa', justificativa.id, '→', matches ? '✅ MATCH' : '❌ NO MATCH',
      '| cooperadoId:', justificativa.cooperadoId, '===', cooperadoLogadoId, '?', sameId,
      '| nome:', justificativa.cooperadoNome, '===', cooperadoLogadoData?.nome, '?', sameName);
    return matches;
  };


  useEffect(() => {
    // Carregar sessão se mode=cooperado
    if (mode === 'cooperado') {
      const currentSession = StorageService.getSession();
      setSession(currentSession);
      
      // Definir filtro de data padrão (mês atual)
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      setFilterDataIni(firstDay);
      setFilterDataFim(lastDay);
    }
    
    const init = async () => {
      await loadData();
    };
    init();

    // Polling: recarregar dados a cada 3 segundos para refletir mudanças do gestor
    const pollInterval = setInterval(() => {
      loadData();
    }, 3000);

    // Listener para notificações de exclusão ou alteração via localStorage
    const handleStorageChange = (e: StorageEvent) => {
      const isDelete = e.key === 'biohealth_plantao_deleted' && e.newValue;
      const isChange = e.key === 'biohealth_pontos_changed' && e.newValue;
      if (!isDelete && !isChange) return;

      console.log('[ControleDeProducao] 📢 Notificação recebida (storage):', e.key);
      
      // Se for cooperado, limpar cache e recarregar
      if (mode === 'cooperado') {
        console.log('[ControleDeProducao] 🧹 Limpando cache do cooperado e recarregando...');
        
        // Limpar dados do localStorage
        const pontosKey = 'biohealth_pontos';
        const justificativasKey = 'biohealth_justificativas';
        localStorage.removeItem(pontosKey);
        localStorage.removeItem(justificativasKey);
        
        // Forçar recarregamento dos dados do Neon
        setTimeout(() => {
          loadData();
        }, 100);
      } else {
        // Se for gestor, apenas recarregar dados (sem limpar cache)
        console.log('[ControleDeProducao] 🔄 Recarregando dados do gestor...');
        loadData();
      }
    };
    
    // Listener local para mudanças (quando na mesma aba)
    const handleLocalChange = () => {
      console.log('[ControleDeProducao] 📢 Notificação local recebida');
      if (mode === 'cooperado') {
        console.log('[ControleDeProducao] 🧹 Limpando cache do cooperado e recarregando (evento local)...');
        const pontosKey = 'biohealth_pontos';
        const justificativasKey = 'biohealth_justificativas';
        localStorage.removeItem(pontosKey);
        localStorage.removeItem(justificativasKey);
        setTimeout(() => {
          loadData();
        }, 100);
      }
    };
    
    // Observer para mudanças locais em localStorage
    const observer = new MutationObserver(() => {
      const delKey = localStorage.getItem('biohealth_plantao_deleted');
      const changeKey = localStorage.getItem('biohealth_pontos_changed');
      if (delKey || changeKey) {
        handleLocalChange();
      }
    });
    
    // Observar mudanças no localStorage via callback com setInterval (fallback)
    const localChangeInterval = setInterval(() => {
      const delKey = localStorage.getItem('biohealth_plantao_deleted');
      const changeKey = localStorage.getItem('biohealth_pontos_changed');
      if ((delKey || changeKey) && mode === 'cooperado') {
        handleLocalChange();
      }
    }, 100);
    
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(pollInterval);
      clearInterval(localChangeInterval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [mode]);

  // Carregar setores quando o filtro de hospital mudar
  useEffect(() => {
    if (!filterHospital) {
      setSetoresDisponiveis([]);
      return;
    }

    const loadSetores = async () => {
      try {
        const setores = await apiGet<Setor[]>(`hospital-setores?hospitalId=${filterHospital}`);
        if (!setores || setores.length === 0) {
          // Fallback para setores padrão
          setSetoresDisponiveis([
            { id: 1, nome: 'UTI' },
            { id: 2, nome: 'Pronto Atendimento' },
            { id: 3, nome: 'Centro Cirúrgico' },
            { id: 4, nome: 'Ambulatório' },
            { id: 5, nome: 'Maternidade' }
          ]);
        } else {
          setSetoresDisponiveis(setores);
        }
      } catch (err) {
        console.error('Erro ao carregar setores:', err);
        setSetoresDisponiveis([
          { id: 1, nome: 'UTI' },
          { id: 2, nome: 'Pronto Atendimento' },
          { id: 3, nome: 'Centro Cirúrgico' },
          { id: 4, nome: 'Ambulatório' },
          { id: 5, nome: 'Maternidade' }
        ]);
      }
    };

    loadSetores();
  }, [filterHospital]);

  // Carregar setores para o formulário de plantão ausente (cooperado)
  useEffect(() => {
    if (!missingHospitalId) {
      setMissingSetores([]);
      return;
    }

    const loadSetoresMissing = async () => {
      try {
        const setores = await apiGet<Setor[]>(`hospital-setores?hospitalId=${missingHospitalId}`);
        if (!setores || setores.length === 0) {
          setMissingSetores([
            { id: 1, nome: 'UTI' },
            { id: 2, nome: 'Pronto Atendimento' },
            { id: 3, nome: 'Centro Cirúrgico' },
            { id: 4, nome: 'Ambulatório' },
            { id: 5, nome: 'Maternidade' }
          ]);
        } else {
          setMissingSetores(setores);
        }
      } catch (err) {
        console.error('Erro ao carregar setores (plantão ausente):', err);
        setMissingSetores([
          { id: 1, nome: 'UTI' },
          { id: 2, nome: 'Pronto Atendimento' },
          { id: 3, nome: 'Centro Cirúrgico' },
          { id: 4, nome: 'Ambulatório' },
          { id: 5, nome: 'Maternidade' }
        ]);
      }
    };

    loadSetoresMissing();
  }, [missingHospitalId]);

  const loadData = async () => {
    try {
      // Reabilitado: sincronizar do Neon antes de ler localStorage
      await StorageService.refreshHospitaisFromRemote();
      await StorageService.refreshCooperadosFromRemote();
      await StorageService.refreshPontosFromRemote();
      await StorageService.refreshJustificativasFromRemote();
    } catch (error) {
      console.error('Erro ao sincronizar dados do Neon:', error);
    }

    // IMPORTANTE: Atualizar sessão a cada loadData (especialmente para cooperado)
    if (mode === 'cooperado') {
      const currentSession = StorageService.getSession();
      setSession(currentSession);
      console.log('[loadData] 🔐 Sessão atualizada para cooperado:', currentSession?.user?.nome);
    }
    
    setCooperados(StorageService.getCooperados());
    setHospitais(StorageService.getHospitais());
    
    // IMPORTANTE: Ler diretamente do localStorage sem cache
    let allPontos = StorageService.getPontos();
    const existingIds = new Set(allPontos.map(p => p.id));

    // Derivar cooperado logado DIRETAMENTE da sessão (não usar state que pode estar desatualizado)
    const currentSessionForCooperado = mode === 'cooperado' ? StorageService.getSession() : null;
    const cooperadoLogadoIdLocal = currentSessionForCooperado?.type === 'COOPERADO' ? currentSessionForCooperado?.user?.id : null;
    const cooperadoLogadoDataLocal = currentSessionForCooperado?.type === 'COOPERADO' ? currentSessionForCooperado?.user : null;

    console.log('[ControleDeProducao] 🎯 Verificando modo e cooperado:', 'mode=', mode, 'cooperadoLogadoId=', cooperadoLogadoIdLocal, 'cooperadoLogadoData=', cooperadoLogadoDataLocal?.nome);

    // Complementar com justificativas pendentes/rejeitadas
    try {
      const remoteJust = await apiGet<Justificativa[]>('sync?action=list_justificativas');
      console.log('[ControleDeProducao] 📥 Recebidas', remoteJust.length, 'justificativas remotas');
      
      let filteredJust = remoteJust;
      
      // Se for cooperado, filtrar apenas suas justificativas
      if (mode === 'cooperado' && (cooperadoLogadoIdLocal || cooperadoLogadoDataLocal?.nome)) {
        console.log('[ControleDeProducao] 🔍 Filtrando por cooperado:', cooperadoLogadoIdLocal, '/', cooperadoLogadoDataLocal?.nome);
        filteredJust = remoteJust.filter(j => {
          const sameId = cooperadoLogadoIdLocal ? j.cooperadoId === cooperadoLogadoIdLocal : false;
          const sameName = cooperadoLogadoDataLocal?.nome ? j.cooperadoNome?.trim().toLowerCase() === cooperadoLogadoDataLocal.nome.trim().toLowerCase() : false;
          const matches = sameId || sameName;
          if (matches) console.log('[matchCooperado] Justificativa', j.id, '→ ✅ MATCH');
          return matches;
        });
      }
      // Se for gestor, mostrar TODAS as justificativas (não filtrar)
      
      console.log('[ControleDeProducao] ✅ Justificativas após filtro:', filteredJust.length);
      const missingJust = filteredJust.filter(j => !j.pontoId || !existingIds.has(j.pontoId));
      const synth = buildPontosFromJustificativas(missingJust, StorageService.getHospitais(), existingIds);
      console.log('[ControleDeProducao] 📊 Justificativas sintéticas:', synth.length);
      allPontos = [...allPontos, ...synth];
    } catch (err) {
      console.warn('[ControleDeProducao] Falha ao buscar justificativas remotas, usando local:', err);
      const localJust = StorageService.getJustificativas();
      console.log('[ControleDeProducao] 📥 Justificativas do localStorage:', localJust.length);
      
      let filtered = localJust;
      
      if (mode === 'cooperado' && (cooperadoLogadoIdLocal || cooperadoLogadoDataLocal?.nome)) {
        filtered = localJust.filter(j => {
          const sameId = cooperadoLogadoIdLocal ? j.cooperadoId === cooperadoLogadoIdLocal : false;
          const sameName = cooperadoLogadoDataLocal?.nome ? j.cooperadoNome?.trim().toLowerCase() === cooperadoLogadoDataLocal.nome.trim().toLowerCase() : false;
          return sameId || sameName;
        });
      }
      
      console.log('[ControleDeProducao] ✅ Após filtro:', filtered.length);
      const missingJust = filtered.filter(j => !j.pontoId || !existingIds.has(j.pontoId));
      const synth = buildPontosFromJustificativas(missingJust, StorageService.getHospitais(), existingIds);
      console.log('[ControleDeProducao] 📊 Justificativas locais sintéticas:', synth.length);
      allPontos = [...allPontos, ...synth];
    }
    
    console.log('[ControleDeProducao] Total de pontos carregados:', allPontos.length);
    console.log('[ControleDeProducao] Pontos com status Rejeitado:', allPontos.filter(p => isRecusadoStatus(p.status)).length);
    console.log('[ControleDeProducao] Pontos com status Fechado:', allPontos.filter(p => p.status === 'Fechado').length);
    console.log('[ControleDeProducao] Pontos com validadoPor:', allPontos.filter(p => p.validadoPor).length);
    console.log('[ControleDeProducao] Pontos com rejeitadoPor:', allPontos.filter(p => p.rejeitadoPor).length);
    
    // Não filtrar recusadas aqui para permitir toggle dinâmico na UI
    // Manter TODOS os pontos, ordenar depois por status (Abertos → Fechados → Rejeitados)
    const pontosValidos = allPontos;
    console.log('[ControleDeProducao] Pontos carregados (incluindo Rejeitados):', pontosValidos.length);
    
    // Carregar setores de todos os hospitais para exibição (Hospital - Setor quando filtro vazio)
    await loadAllSetores(StorageService.getHospitais());

    const normalized = pontosValidos.map((p) => {
      const manualFlag = p.isManual === true 
        || (p as any).isManual === 'true' 
        || (p as any).isManual === 1 
        || (p as any).isManual === '1' 
        || (p.codigo && String(p.codigo).startsWith('MAN-'))
        || p.status === 'Pendente';

      // CRÍTICO: NÃO sobrescrever se já tem validadoPor, rejeitadoPor ou status Fechado/Rejeitado
      if (p.validadoPor || p.rejeitadoPor || p.status === 'Fechado' || p.status === 'Rejeitado') {
        console.log('[ControleDeProducao] Preservando ponto:', p.id, 'status:', p.status, 'validadoPor:', p.validadoPor, 'rejeitadoPor:', p.rejeitadoPor);
        return { ...p, isManual: manualFlag || p.isManual };
      }

      // Só sobrescrever status para 'Pendente' se for manual E NÃO tiver sido aprovado/rejeitado
      if (manualFlag && !p.validadoPor && !p.rejeitadoPor) {
        return { ...p, isManual: true, status: 'Pendente' };
      }

      return { ...p, isManual: manualFlag || p.isManual };
    });

    console.log('[ControleDeProducao] Após normalização - Rejeitados:', normalized.filter(p => isRecusadoStatus(p.status)).length);
    console.log('[ControleDeProducao] Após normalização - Fechados:', normalized.filter(p => p.status === 'Fechado').length);

    // Ordenar: Abertos (Pendente) → Fechados → Rejeitados (dentro de cada grupo, mais recente primeiro)
    const sorted = [...normalized].sort((a, b) => {
      // Calcular ordem do status
      const getOrder = (s?: string | null) => {
        const statusStr = s?.toLowerCase() || '';
        if (statusStr === 'rejeitado' || statusStr === 'recusado' || statusStr === 'recusada') return 2;
        if (statusStr === 'fechado') return 1;
        return 0; // Pendente/Aberto
      };
      
      const orderA = getOrder(a.status);
      const orderB = getOrder(b.status);
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // Dentro do mesmo status, mais recente primeiro
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // NÃO persistir normalização - isso pode sobrescrever os dados corretos!
    // localStorage.setItem('biohealth_pontos', JSON.stringify(normalized));

    setLogs(sorted);
  };

  const loadAllSetores = async (hospitaisList: Hospital[]) => {
    console.log('[DEBUG loadAllSetores] Carregando setores para hospitais:', hospitaisList);
    
    if (!hospitaisList || hospitaisList.length === 0) {
      console.warn('[DEBUG] Lista de hospitais vazia, usando setores padrão');
      // Setores padrão para quando não há hospitais carregados ainda
      const setoresPadrao = [
        { id: '1', nome: 'CENTRO CIRURGICO' },
        { id: '2', nome: 'UTI' },
        { id: '3', nome: 'PRONTO ATENDIMENTO' },
        { id: '4', nome: 'AMBULATORIO' },
        { id: '5', nome: 'MATERNIDADE' }
      ];
      setTodosSetores(setoresPadrao);
      return;
    }
    
    try {
      const setoresByHospital = await Promise.all(
        hospitaisList.map(async (hospital) => {
          try {
            const setores = await apiGet<Setor[]>(`hospital-setores?hospitalId=${hospital.id}`);
            console.log('[DEBUG] Setores do hospital', hospital.nome, ':', setores);
            return setores || [];
          } catch (err) {
            console.warn('[DEBUG] Erro ao buscar setores do hospital', hospital.nome, err);
            return [];
          }
        })
      );

      const flattened = setoresByHospital.flat();
      
      // Se não encontrou nenhum setor, usar padrão
      if (flattened.length === 0) {
        console.warn('[DEBUG] Nenhum setor encontrado na API, usando setores padrão');
        const setoresPadrao = [
          { id: '1', nome: 'CENTRO CIRURGICO' },
          { id: '2', nome: 'UTI' },
          { id: '3', nome: 'PRONTO ATENDIMENTO' },
          { id: '4', nome: 'AMBULATORIO' },
          { id: '5', nome: 'MATERNIDADE' }
        ];
        setTodosSetores(setoresPadrao);
        return;
      }
      
      const unique = flattened.filter((setor, index, self) => index === self.findIndex(s => s.id === setor.id));
      console.log('[DEBUG] todosSetores final:', unique);
      setTodosSetores(unique);
    } catch (error) {
      console.error('[ControleDeProducao] Erro ao carregar todos os setores:', error);
      // Fallback para setores padrão em caso de erro
      const setoresPadrao = [
        { id: '1', nome: 'CENTRO CIRURGICO' },
        { id: '2', nome: 'UTI' },
        { id: '3', nome: 'PRONTO ATENDIMENTO' },
        { id: '4', nome: 'AMBULATORIO' },
        { id: '5', nome: 'MATERNIDADE' }
      ];
      setTodosSetores(setoresPadrao);
    }
  };

  // Constrói pontos sintéticos a partir de justificativas sem ponto gerado (pendentes/recusadas)
  const buildPontosFromJustificativas = (justs: Justificativa[], hospitaisList: Hospital[], existingIds?: Set<string>): RegistroPonto[] => {
    const hospMap = new Map(hospitaisList.map(h => [String(h.id), h.nome]));
    const resultados: RegistroPonto[] = [];

    console.log('[buildPontosFromJustificativas] 📥 Recebidas', justs.length, 'justificativas para sintetizar');

    // Helper para criar ISO timestamp preservando a data/hora local (não UTC)
    const createLocalISOTimestamp = (dateStr: string, timeStr: string): string => {
      // dateStr: "2026-01-17", timeStr: "08:00"
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute] = timeStr.split(':').map(Number);
      const d = new Date(year, month - 1, day, hour, minute, 0);
      // Não fazer conversão - new Date() já cria no timezone local, toISOString() converte para UTC corretamente
      return d.toISOString();
    };

    justs.forEach(j => {
      if (!j.dataPlantao) return;

      // Se já existe ponto vinculado e está na lista atual, não sintetizar duplicado
      if (j.pontoId && existingIds && existingIds.has(j.pontoId)) return;

      const hospNome = j.hospitalId ? hospMap.get(String(j.hospitalId)) || 'Hospital não informado' : 'Hospital não informado';
      const baseDate = j.dataPlantao;
      const entradaHora = j.entradaPlantao || '00:00';
      const saidaHora = j.saidaPlantao || entradaHora;

      const entradaTs = createLocalISOTimestamp(baseDate, entradaHora);
      let saidaDate = baseDate;
      if (saidaHora < entradaHora) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + 1);
        saidaDate = d.toISOString().split('T')[0];
      }
      const saidaTs = createLocalISOTimestamp(saidaDate, saidaHora);

      const entryId = `just-${j.id}-ent`;
      const exitId = `just-${j.id}-sai`;

      const status = j.status === 'Fechado' ? 'Fechado' : j.status === 'Rejeitado' ? 'Rejeitado' : 'Pendente';

      const pontoEntrada: RegistroPonto = {
        id: entryId,
        codigo: `JUST-${j.id}`,
        cooperadoId: j.cooperadoId,
        cooperadoNome: j.cooperadoNome,
        timestamp: entradaTs,
        tipo: TipoPonto.ENTRADA,
        local: hospNome,
        hospitalId: j.hospitalId,
        setorId: j.setorId,
        observacao: j.descricao,
        relatedId: exitId,
        status,
        isManual: true,
        validadoPor: status === 'Fechado' ? j.validadoPor : undefined,
        rejeitadoPor: status === 'Rejeitado' ? j.rejeitadoPor : undefined,
        motivoRejeicao: j.motivoRejeicao
      };

      const pontoSaida: RegistroPonto = {
        id: exitId,
        codigo: `JUST-${j.id}`,
        cooperadoId: j.cooperadoId,
        cooperadoNome: j.cooperadoNome,
        timestamp: saidaTs,
        tipo: TipoPonto.SAIDA,
        local: hospNome,
        hospitalId: j.hospitalId,
        setorId: j.setorId,
        observacao: j.descricao,
        relatedId: entryId,
        status,
        isManual: true,
        validadoPor: status === 'Fechado' ? j.validadoPor : undefined,
        rejeitadoPor: status === 'Rejeitado' ? j.rejeitadoPor : undefined,
        motivoRejeicao: j.motivoRejeicao
      };

      resultados.push(pontoEntrada, pontoSaida);
    });

    return resultados;
  };

  // --- FILTER LOGIC ---
  const getFilteredLogs = () => {
    return logs.filter(log => {
      // Filtro de recusadas e pendentes APENAS para gestor (cooperado vê todos os status sempre)
      if (mode === 'manager' && !showRecusadas) {
        // Ocultar recusados E pendentes quando o toggle está OFF
        if (isRecusadoStatus(log.status)) return false;
        if (log.status === 'Pendente' || log.status === 'Aguardando Autorização') return false;
      }

      // 0. Modo Cooperado: filtrar apenas registros do cooperado logado
      if (mode === 'cooperado' && cooperadoLogadoId) {
        const sameId = log.cooperadoId === cooperadoLogadoId;
        const sameName = log.cooperadoNome && cooperadoLogadoData?.nome && log.cooperadoNome.trim().toLowerCase() === cooperadoLogadoData.nome.trim().toLowerCase();
        if (!sameId && !sameName) return false;
      }

      // 1. Hospital Filter
      if (filterHospital && log.hospitalId !== filterHospital) return false;
      
      // 2. Setor Filter
      if (filterSetor && log.setorId !== filterSetor) return false;

      // 3. Cooperado Filter (apenas para mode=manager)
      if (mode === 'manager' && filterCooperado && log.cooperadoId !== filterCooperado) return false;

      // 4. Date Range
      if (filterDataIni) {
        const logDate = new Date(log.timestamp).toISOString().split('T')[0];
        if (logDate < filterDataIni) return false;
      }
      if (filterDataFim) {
        const logDate = new Date(log.timestamp).toISOString().split('T')[0];
        if (logDate > filterDataFim) return false;
      }

      return true;
    });
  };

  const filteredLogs = getFilteredLogs();

  // Debug: log when filtering changes
  console.log('[ControleDeProducao] 🔍 Filtro aplicado:', {
    showRecusadas,
    totalLogs: logs.length,
    filteredLogs: filteredLogs.length,
    rejeitados: logs.filter(l => isRecusadoStatus(l.status)).length
  });

  // Helper to get sectors from state
  const getAvailableSetoresForForm = () => setoresDisponiveis;
  
  const getAvailableSetoresForFilter = () => setoresDisponiveis;

  // --- PAIRING LOGIC (Shift View) ---
  const getShiftRows = (): ShiftRow[] => {
    const shifts: ShiftRow[] = [];
    const processedExits = new Set<string>();
    const processedEntries = new Set<string>();

    // 1. Agrupar registros por cooperado
    const gruposPorCooperado = new Map<string, RegistroPonto[]>();
    filteredLogs.forEach(log => {
      if (!gruposPorCooperado.has(log.cooperadoId)) {
        gruposPorCooperado.set(log.cooperadoId, []);
      }
      gruposPorCooperado.get(log.cooperadoId)!.push(log);
    });

    // 2. Para cada cooperado, ordenar cronologicamente e parear
    gruposPorCooperado.forEach((registros) => {
      // Ordenar por timestamp (ascendente = mais antigo primeiro)
      const ordenados = registros.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const entradas = ordenados.filter(r => r.tipo === TipoPonto.ENTRADA);
      const saidas = ordenados.filter(r => r.tipo === TipoPonto.SAIDA);

      // 3. Parear cada ENTRADA com a próxima SAÍDA disponível
      entradas.forEach(entrada => {
        // Procurar SAÍDA vinculada via relatedId primeiro (preferência)
        let saidaPareada: RegistroPonto | undefined;
        let saidaIndex = -1;

        // 1ª prioridade: relatedId da entrada aponta para saída
        if (entrada.relatedId) {
          saidaIndex = saidas.findIndex(s => s.id === entrada.relatedId && !processedExits.has(s.id));
        }

        // 2ª prioridade: saída tem relatedId apontando para esta entrada
        if (saidaIndex === -1) {
          saidaIndex = saidas.findIndex(s => s.relatedId === entrada.id && !processedExits.has(s.id));
        }

        // 3ª prioridade: mesmo código e timestamp posterior
        if (saidaIndex === -1) {
          saidaIndex = saidas.findIndex(s => 
            s.codigo === entrada.codigo &&
            new Date(s.timestamp).getTime() > new Date(entrada.timestamp).getTime() &&
            !processedExits.has(s.id)
          );
        }

        // 4ª prioridade: próxima saída cronológica (comportamento antigo)
        if (saidaIndex === -1) {
          saidaIndex = saidas.findIndex(s => 
            new Date(s.timestamp).getTime() > new Date(entrada.timestamp).getTime() &&
            !processedExits.has(s.id)
          );
        }

        if (saidaIndex !== -1) {
          saidaPareada = saidas[saidaIndex];
          processedExits.add(saidaPareada.id);
        }

        processedEntries.add(entrada.id);

        // Construir setor nome
        const getSetorNome = (log: RegistroPonto) => {
          console.log('[DEBUG] log.setorId:', log.setorId, 'todosSetores:', todosSetores);
          
          const hospital = hospitais.find(h => h.id === log.hospitalId);
          const hospitalNome = hospital?.nome || log.local || 'Não especificado';
          
          // Buscar nome do setor
          let setorNome = '';
          if (log.setorId) {
            const setorId = String(log.setorId);
            const setor = todosSetores.find(s => String(s.id) === setorId);
            console.log('[DEBUG] Procurando setor:', setorId, 'encontrado:', setor);
            setorNome = setor?.nome || '';
          }
          
          // Sempre mostrar Hospital - Setor (NUNCA só setor)
          if (setorNome) {
            return `${hospitalNome} - ${setorNome}`;
          }
          return hospitalNome;
        };

        const isManualVal = (val: any, status?: string) => val === true || val === 'true' || val === 1 || val === '1' || status === 'Pendente';
        const entradaManual = isManualVal((entrada as any).isManual, entrada.status);
        const saidaManual = saidaPareada && isManualVal((saidaPareada as any).isManual, saidaPareada.status);

        const aguardandoEntrada = entrada.status === 'Pendente' || (!entrada.status && entradaManual);
        const aguardandoSaida = saidaPareada && (saidaPareada.status === 'Pendente' || (!saidaPareada.status && saidaManual));

        const manualPair = entradaManual || saidaManual;
        const hasApproval = (entrada.validadoPor && entrada.status === 'Fechado') || (saidaPareada && saidaPareada.validadoPor && saidaPareada.status === 'Fechado');

        let statusLabel = 'Em Aberto';
        let statusDetails = '';
        
        if (entrada.status === 'Rejeitado' || (saidaPareada?.status === 'Rejeitado')) {
          statusLabel = 'Recusado';
          const rejPonto = entrada.status === 'Rejeitado' ? entrada : saidaPareada;
          statusDetails = `${rejPonto?.rejeitadoPor || 'Gestor'}${rejPonto?.motivoRejeicao ? ': ' + rejPonto.motivoRejeicao : ''}`;
        } else if (saidaPareada && saidaPareada.status === 'Fechado' && saidaPareada.validadoPor) {
          statusLabel = 'Fechado';
          statusDetails = saidaPareada.validadoPor;
        } else if (entrada.status === 'Fechado' && entrada.validadoPor) {
          statusLabel = 'Fechado';
          statusDetails = entrada.validadoPor;
        } else if (manualPair && !hasApproval) {
          statusLabel = 'Pendente';
        } else if (aguardandoEntrada || aguardandoSaida) {
          statusLabel = 'Pendente';
        } else if (saidaPareada) {
          statusLabel = 'Fechado';
        }

        shifts.push({
          id: entrada.id,
          cooperadoNome: entrada.cooperadoNome,
          local: entrada.local,
          setorNome: getSetorNome(entrada),
          data: new Date(entrada.timestamp).toLocaleDateString(),
          entry: entrada,
          exit: saidaPareada,
          status: statusLabel,
          statusDetails
        });
      });

      // 4. Processar SAÍDAs órfãs (saídas sem entrada anterior)
      saidas.forEach(saida => {
        if (!processedExits.has(saida.id)) {
          // Esta é uma SAÍDA sem ENTRADA - ANOMALIA!
          const getSetorNomeOrfao = (log: RegistroPonto) => {
            const hospital = hospitais.find(h => h.id === log.hospitalId);
            const hospitalNome = hospital?.nome || log.local || 'Não especificado';
            
            // Buscar nome do setor
            let setorNome = '';
            if (log.setorId) {
              const setorId = String(log.setorId);
              const setor = todosSetores.find(s => String(s.id) === setorId);
              setorNome = setor?.nome || '';
            }
            
          const isFiltered = filterHospital && filterHospital !== '';
            if (isFiltered) {
              return setorNome || hospitalNome;
            }
            
            // Senão, mostrar Hospital - Setor
            if (setorNome) {
              return `${hospitalNome} - ${setorNome}`;
            }
            
            return hospitalNome;
          };

          let statusLabel = 'Em Aberto';
          let statusDetails = '';
          
          if (saida.status === 'Fechado' && saida.validadoPor) {
            statusLabel = 'Fechado';
            statusDetails = saida.validadoPor;
          } else if (saida.status === 'Rejeitado' && saida.rejeitadoPor) {
            statusLabel = 'Recusado';
            statusDetails = `${saida.rejeitadoPor}${saida.motivoRejeicao ? ': ' + saida.motivoRejeicao : ''}`;
          } else if (saida.status === 'Pendente') {
            statusLabel = 'Pendente';
          }

          shifts.push({
            id: saida.id,
            cooperadoNome: saida.cooperadoNome,
            local: saida.local,
            setorNome: getSetorNomeOrfao(saida),
            data: new Date(saida.timestamp).toLocaleDateString(),
            entry: undefined,
            exit: saida,
            status: statusLabel,
            statusDetails
          });
          processedExits.add(saida.id);
        }
      });
    });

    // 5. Ordenar por timestamp descrescente (mais recentes primeiro)
    return shifts.sort((a, b) => {
      const timeA = a.entry ? new Date(a.entry.timestamp).getTime() : new Date(a.exit!.timestamp).getTime();
      const timeB = b.entry ? new Date(b.entry.timestamp).getTime() : new Date(b.exit!.timestamp).getTime();
      return timeB - timeA;
    });
  };

  const shiftRows = getShiftRows();

  const handleSelectRow = (row: ShiftRow) => {
    // Prefer loading Entry data for editing/viewing
    const ponto = row.entry || row.exit;
    if (!ponto) return;

    setSelectedPontoId(row.entry ? row.entry.id : row.exit?.id || null);
    setSelectedEntryId(row.entry?.id || null);
    setSelectedExitId(row.exit?.id || null);
    // NÃO alterar filtro de hospital automaticamente!
    setFormCooperadoId(ponto.cooperadoId);
    setFormCooperadoInput(ponto.cooperadoNome); 
    setFormSetorId(ponto.setorId ? ponto.setorId.toString() : '');
    const d = new Date(ponto.timestamp);
    setFormData(d.toISOString().split('T')[0]);
    setFormHora(''); // Deixar em branco para usuário preencher manualmente
    // Carregar código da entrada se existir
    if (row.entry) {
      setFormInputCodigo(row.entry.codigo);
    }
    // NÃO setar o tipo automaticamente - deixar para o usuário escolher
    // O usuário deve escolher se quer editar a entrada ou saída
  };

  const handleNovoPlantao = () => {
    setSelectedPontoId(null);
    setSelectedEntryId(null);
    setSelectedExitId(null);
    setFormCooperadoId('');
    setFormCooperadoInput('');
    setFormSetorId('');
    setFormData('');
    setFormHora('');
    setFormTipo(TipoPonto.ENTRADA);
    setFormInputCodigo('');
  };

  const generateRandomCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleSalvar = () => {
    if (!filterHospital) {
        alert("Selecione uma Unidade Hospitalar no filtro acima para realizar lançamentos.");
        return;
    }

    if (!formCooperadoId || !formSetorId || !formData || !formHora) {
        alert("Preencha todos os campos obrigatórios.");
        return;
    }

    if (!formTipo) {
        alert("Selecione o tipo de registro (Entrada ou Saída).");
        return;
    }

    const timestamp = new Date(`${formData}T${formHora}:00`).toISOString();
    const cooperado = cooperados.find(c => c.id === formCooperadoId);
    const hospital = hospitais.find(h => h.id === filterHospital);
    const setor = setoresDisponiveis.find(s => s.id.toString() === formSetorId);

    if (!cooperado || !hospital || !setor) {
      console.error('Validação falhou:', { cooperado: !!cooperado, hospital: !!hospital, setor: !!setor, formSetorId, setoresDisponiveis });
      alert("Erro: Cooperado, Hospital ou Setor não encontrado.");
      return;
    }

    // Se há um registro selecionado, EDITAR ao invés de criar novo
    if (selectedPontoId) {
        // Validar que um tipo foi selecionado
        if (formTipo === TipoPonto.ENTRADA && selectedEntryId) {
            const existingEntry = logs.find(p => p.id === selectedEntryId);
            if (existingEntry) {
                const updatedEntry: RegistroPonto = {
                    ...existingEntry,
                    timestamp: timestamp,
                    local: `${hospital.nome} - ${setor.nome}`,
                    hospitalId: hospital.id,
                    setorId: setor.id.toString()
                };
                StorageService.updatePonto(updatedEntry);
                loadData();
                handleNovoPlantao();
                return;
            }
        } else if (formTipo === TipoPonto.SAIDA) {
            // Se existe saída já, editar a saída existente
            if (selectedExitId) {
                const existingExit = logs.find(p => p.id === selectedExitId);
                if (existingExit) {
                    const updatedExit: RegistroPonto = {
                        ...existingExit,
                        timestamp: timestamp,
                        local: `${hospital.nome} - ${setor.nome}`,
                        hospitalId: hospital.id,
                        setorId: setor.id.toString()
                    };
                    StorageService.updatePonto(updatedExit);
                    loadData();
                    handleNovoPlantao();
                    return;
                }
            } 
            // Se NÃO existe saída ainda, criar uma nova saída vinculada à entrada
            else if (selectedEntryId) {
                const entryPonto = logs.find(p => p.id === selectedEntryId);
                if (!entryPonto) {
                    alert("Entrada não encontrada.");
                    return;
                }
                if (entryPonto.status === 'Fechado') {
                    alert("Este registro já foi fechado.");
                    return;
                }
                if (entryPonto.cooperadoId !== cooperado.id) {
                    alert("O código pertence a outro cooperado.");
                    return;
                }

                const exitPonto: RegistroPonto = {
                    id: crypto.randomUUID(),
                    codigo: entryPonto.codigo,
                    cooperadoId: cooperado.id,
                    cooperadoNome: cooperado.nome,
                    timestamp: timestamp,
                    tipo: TipoPonto.SAIDA,
                    local: `${hospital.nome} - ${setor.nome}`,
                    hospitalId: hospital.id,
                    setorId: setor.id.toString(),
                    isManual: true,
                    status: 'Fechado',
                    validadoPor: 'Admin',
                    relatedId: entryPonto.id
                };

                // Atualizar entrada para vincular bidirecional
                const updatedEntry = { ...entryPonto, status: 'Fechado' as const, relatedId: exitPonto.id };
                
                StorageService.savePonto(exitPonto);
                StorageService.updatePonto(updatedEntry);
                
                loadData();
                handleNovoPlantao();
                return;
            }
        }
        
        alert("Por favor, selecione o tipo de registro (Entrada ou Saída) para editar.");
        return;
    }

    // CRIAR novo registro
    if (formTipo === TipoPonto.ENTRADA) {
        const newCode = generateRandomCode();
        const novoPonto: RegistroPonto = {
            id: crypto.randomUUID(),
            codigo: newCode,
            cooperadoId: cooperado.id,
            cooperadoNome: cooperado.nome,
            timestamp: timestamp,
            tipo: TipoPonto.ENTRADA,
            local: `${hospital.nome} - ${setor.nome}`,
            hospitalId: hospital.id,
            setorId: setor.id.toString(),
            isManual: true,
            status: 'Aberto',
            validadoPor: 'Admin'
        };
        StorageService.savePonto(novoPonto);
        alert(`Entrada registrada! Código: ${newCode}`);
    } 
    else {
        if (!formInputCodigo) {
            alert("Para registrar SAÍDA, informe o Código de Registro da Entrada.");
            return;
        }
        const entryPonto = logs.find(p => p.codigo === formInputCodigo && p.tipo === TipoPonto.ENTRADA);

        if (!entryPonto) {
            alert("Código de entrada não encontrado.");
            return;
        }
        if (entryPonto.status === 'Fechado') {
            alert("Este registro já foi fechado.");
            return;
        }
        if (entryPonto.cooperadoId !== cooperado.id) {
            alert("O código pertence a outro cooperado.");
            return;
        }

        const exitPonto: RegistroPonto = {
            id: crypto.randomUUID(),
            codigo: entryPonto.codigo,
            cooperadoId: cooperado.id,
            cooperadoNome: cooperado.nome,
            timestamp: timestamp,
            tipo: TipoPonto.SAIDA,
            local: `${hospital.nome} - ${setor.nome}`,
            hospitalId: hospital.id,
            setorId: setor.id.toString(),
            isManual: true,
            status: 'Fechado',
            validadoPor: 'Admin',
            relatedId: entryPonto.id
        };

        // Atualizar entrada para vincular bidirecional e marcar como fechada
        const updatedEntry = { ...entryPonto, status: 'Fechado' as const, relatedId: exitPonto.id };
        
        StorageService.savePonto(exitPonto);
        StorageService.updatePonto(updatedEntry);
        
        alert("Saída registrada!");
    }

    loadData();
    handleNovoPlantao();
  };

  const handleExcluir = () => {
    // Buscar IDs reais dos pontos a partir das rows selecionadas
    const idsToDelete: string[] = [];
    
    if (selectedRows.size > 0) {
      // Múltiplas seleções - buscar entry e exit de cada row
      selectedRows.forEach(rowId => {
        const row = shiftRows.find(r => r.id === rowId);
        if (row) {
          if (row.entry) idsToDelete.push(row.entry.id);
          if (row.exit) idsToDelete.push(row.exit.id);
        }
      });
    } else if (selectedPontoId) {
      // Seleção única - buscar pela row
      const row = shiftRows.find(r => r.id === selectedPontoId || r.entry?.id === selectedPontoId || r.exit?.id === selectedPontoId);
      if (row) {
        if (row.entry) idsToDelete.push(row.entry.id);
        if (row.exit) idsToDelete.push(row.exit.id);
      }
    }
    
    if (idsToDelete.length === 0) {
        alert("Selecione ao menos um registro para excluir.");
        return;
    }
    
    const plantoes = selectedRows.size > 0 ? selectedRows.size : 1;
    const confirmMsg = plantoes === 1 
      ? "Tem certeza que deseja excluir este plantão completo (entrada e saída)?"
      : `Tem certeza que deseja excluir ${plantoes} plantões completos?`;
    
    if (confirm(confirmMsg)) {
        console.log('[handleExcluir] 🗑️ Excluindo pontos:', idsToDelete);
        idsToDelete.forEach(id => {
          console.log('[handleExcluir] 🗑️ Deletando ponto:', id);
          StorageService.deletePonto(id);
        });
        
        // Limpar cache local para garantir atualização imediata
        console.log('[handleExcluir] 🧹 Limpando cache local...');
        localStorage.removeItem('biohealth_pontos');
        localStorage.removeItem('biohealth_justificativas');
        
        // Disparar evento customizado para notificar outras views na mesma aba
        const customEvent = new CustomEvent('biohealth:pontos:changed', { 
          detail: { action: 'delete', ids: idsToDelete, timestamp: Date.now() } 
        });
        window.dispatchEvent(customEvent);
        
        // Limpar seleção e formulário
        setSelectedRows(new Set());
        handleNovoPlantao();
        
        // Recarregar dados imediatamente (gestor)
        console.log('[handleExcluir] 🔄 Recarregando dados após exclusão...');
        loadData();
    }
  };

  const toggleRowSelection = (rowId: string) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === shiftRows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(shiftRows.map(r => r.id)));
    }
  };

  const clearFilters = () => {
    setFilterHospital('');
    setFilterSetor('');
    setFilterCooperado('');
    setFilterCooperadoInput('');
    setFilterDataIni('');
    setFilterDataFim('');
    setShowRecusadas(false);
  }

  // Removido: handlers de justificativa parcial

  const resetMissingShiftForm = () => {
    setMissingHospitalId('');
    setMissingSetorId('');
    setMissingDate('');
    setMissingEntrada('');
    setMissingSaida('');
    setMissingReason('Esquecimento');
    setMissingDesc('');
  };

  const submitMissingShift = async () => {
    if (mode !== 'cooperado') return;
    if (!cooperadoLogadoData) return;

    if (!missingHospitalId || !missingSetorId || !missingDate || !missingEntrada || !missingSaida) {
      alert('Preencha data, entrada, saída, hospital e setor.');
      return;
    }

    if (!missingReason.trim()) {
      alert('Selecione o motivo da falta de registro.');
      return;
    }

    if (missingReason === 'Outro Motivo' && !missingDesc.trim()) {
      alert('Descreva o motivo quando selecionar "Outro Motivo".');
      return;
    }

    // Validação: não permitir justificativa com data futura
    const dataPlantao = new Date(missingDate);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    dataPlantao.setHours(0, 0, 0, 0);

    if (dataPlantao > hoje) {
      alert('❌ Plantão futuro. Não permitido!');
      return;
    }

    const hospital = hospitais.find(h => String(h.id) === String(missingHospitalId));
    const localNome = hospital?.nome || 'Hospital não informado';

    // Calcular timestamps com lógica automática de dia seguinte
    const entradaTimestamp = new Date(`${missingDate}T${missingEntrada}:00`).toISOString();
    
    // Se saída < entrada, é plantao noturno: saída é no dia seguinte
    let dataSaida = missingDate;
    if (missingSaida < missingEntrada) {
      const dataEntrada = new Date(missingDate);
      dataEntrada.setDate(dataEntrada.getDate() + 1);
      dataSaida = dataEntrada.toISOString().split('T')[0];
    }
    const saidaTimestamp = new Date(`${dataSaida}T${missingSaida}:00`).toISOString();

    const justificativa: Justificativa = {
      id: crypto.randomUUID(),
      cooperadoId: cooperadoLogadoData.id,
      cooperadoNome: cooperadoLogadoData.nome,
      pontoId: undefined,
      hospitalId: String(missingHospitalId || ''),
      motivo: missingReason,
      descricao: missingDesc,
      dataSolicitacao: new Date().toISOString(),
      status: 'Pendente',
      setorId: missingSetorId,
      dataPlantao: missingDate,
      entradaPlantao: missingEntrada,
      saidaPlantao: missingSaida,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log('[ControleDeProducao] 📝 Criando justificativa:', {
      id: justificativa.id,
      cooperadoId: justificativa.cooperadoId,
      cooperadoNome: justificativa.cooperadoNome,
      status: justificativa.status,
      dataPlantao: justificativa.dataPlantao
    });
    
    StorageService.saveJustificativa(justificativa);

    alert('Plantão incluído e enviado para aprovação do gestor.');
    resetMissingShiftForm();
    
    // Aguardar 500ms para garantir que syncToNeon complete antes de recarregar
    await new Promise(resolve => setTimeout(resolve, 500));
    await loadData();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">
          {mode === 'cooperado' ? 'Espelho da Biometria' : 'Controle de Produção'}
        </h2>
        {mode === 'cooperado' && (
          <p className="text-sm text-gray-600">Consulte seu histórico de produção e registros de ponto</p>
        )}
      </div>

      {/* --- FILTERS SECTION --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 mb-3 text-primary-700 font-semibold border-b pb-2">
            <Filter className="h-5 w-5" />
            <h3>Filtros de {mode === 'cooperado' ? 'Consulta' : 'Visualização'}</h3>
        </div>
        
        <div className={`grid grid-cols-1 md:grid-cols-2 ${mode === 'manager' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
            {/* Hospital Filter */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Hospital</label>
                <select 
                    className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    value={filterHospital}
                    onChange={e => { setFilterHospital(e.target.value); setFilterSetor(''); }}
                >
                    <option value="">Todos os {mode === 'cooperado' ? 'Locais' : 'Hospitais'}</option>
                    {hospitais.map(h => (
                        <option key={h.id} value={h.id}>{h.nome}</option>
                    ))}
                </select>
            </div>

            {/* Setor Filter */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Setor</label>
                <select 
                    className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-gray-100"
                    value={filterSetor}
                    onChange={e => setFilterSetor(e.target.value)}
                    disabled={!filterHospital}
                >
                    <option value="">Todos os Setores</option>
                    {getAvailableSetoresForFilter().map(s => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                </select>
            </div>

            {/* Cooperado Filter - Apenas para mode=manager */}
            {mode === 'manager' && (
            <div className="relative space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Cooperado</label>
                <div className="relative">
                    <input 
                        type="text" 
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 pr-8"
                        placeholder="Todos os Cooperados"
                        value={filterCooperadoInput}
                        onChange={e => {
                            setFilterCooperadoInput(e.target.value);
                            setFilterCooperado(''); 
                            setShowFilterCooperadoSuggestions(true);
                        }}
                        onFocus={() => setShowFilterCooperadoSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowFilterCooperadoSuggestions(false), 200)}
                    />
                    {filterCooperadoInput && (
                        <button 
                            onClick={() => {
                                setFilterCooperado('');
                                setFilterCooperadoInput('');
                            }}
                            className="absolute right-2 top-2 text-gray-400 hover:text-red-500"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                    
                    {showFilterCooperadoSuggestions && filterCooperadoInput && !filterCooperado && (
                        <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-b-lg shadow-lg max-h-60 overflow-y-auto mt-1">
                            {cooperados.filter(c => c.nome.toLowerCase().includes(filterCooperadoInput.toLowerCase())).length > 0 ? (
                                cooperados
                                .filter(c => c.nome.toLowerCase().includes(filterCooperadoInput.toLowerCase()))
                                .map(c => (
                                    <div 
                                        key={c.id} 
                                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700"
                                        onMouseDown={() => {
                                            setFilterCooperado(c.id);
                                            setFilterCooperadoInput(c.nome);
                                            setShowFilterCooperadoSuggestions(false);
                                        }}
                                    >
                                        <span className="font-bold">{c.nome}</span> 
                                        <span className="text-gray-400 text-xs ml-2">({c.matricula})</span>
                                    </div>
                                ))
                            ) : (
                                <div className="px-4 py-2 text-sm text-gray-400 italic">Nenhum encontrado</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            )}

            {/* Date Filters */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Data Inicial</label>
                <input 
                    type="date" 
                    className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2 text-sm outline-none"
                    value={filterDataIni}
                    onChange={e => setFilterDataIni(e.target.value)}
                />
            </div>
            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Data Final</label>
                <input 
                    type="date" 
                    className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2 text-sm outline-none"
                    value={filterDataFim}
                    onChange={e => setFilterDataFim(e.target.value)}
                />
            </div>
        </div>
        
        <div className="mt-3 flex flex-col md:flex-row justify-between md:items-center gap-3">
          <button 
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-red-500 flex items-center gap-1"
          >
              <X className="h-4 w-4" /> Limpar Filtros
          </button>
        </div>
      </div>

      {/* Plantão não registrado (modo cooperado) */}
      {mode === 'cooperado' && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-amber-200">
          <div className="flex items-center gap-2 mb-3 text-amber-700 font-semibold border-b pb-2">
            <PlusCircle className="h-5 w-5" />
            <h3>Justificativa de Plantão</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Hospital</label>
              <select
                className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                value={missingHospitalId}
                onChange={e => { setMissingHospitalId(e.target.value); setMissingSetorId(''); }}
              >
                <option value="">Selecione</option>
                {hospitais.map(h => (
                  <option key={h.id} value={h.id}>{h.nome}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Setor</label>
              <select
                className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-gray-100"
                value={missingSetorId}
                onChange={e => setMissingSetorId(e.target.value)}
                disabled={!missingHospitalId}
              >
                <option value="">Selecione</option>
                {missingSetores.map(s => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Data do plantão</label>
              <input
                type="date"
                className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2 text-sm outline-none"
                value={missingDate}
                onChange={e => setMissingDate(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Horário de entrada</label>
              <input
                type="time"
                className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2 text-sm outline-none"
                value={missingEntrada}
                onChange={e => setMissingEntrada(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Horário de saída</label>
              <input
                type="time"
                className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2 text-sm outline-none"
                value={missingSaida}
                onChange={e => setMissingSaida(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Motivo da falha</label>
              <select
                className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                value={missingReason}
                onChange={e => setMissingReason(e.target.value)}
              >
                <option value="">-- Selecione um motivo --</option>
                <option value="Esquecimento">Esquecimento</option>
                <option value="Computador Inoperante">Computador Inoperante</option>
                <option value="Falta de Energia">Falta de Energia</option>
                <option value="Outro Motivo">Outro Motivo</option>
              </select>
            </div>

            {missingReason === 'Outro Motivo' && (
              <div className="space-y-1 md:col-span-2 lg:col-span-3">
                <label className="text-xs font-bold text-gray-500 uppercase">Descrição detalhada</label>
                <textarea
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  placeholder="Descreva o motivo..."
                  value={missingDesc}
                  onChange={e => setMissingDesc(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mt-4">
            <div className="text-xs text-gray-500">Use este formulário apenas quando não houve registro de entrada e saída.</div>
            <div className="flex gap-2">
              <button
                onClick={resetMissingShiftForm}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Limpar
              </button>
              <button
                onClick={submitMissingShift}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center gap-2"
              >
                <PlusCircle className="h-4 w-4" />
                Incluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TABLE SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-primary-600 text-white font-bold sticky top-0 z-10">
              <tr>
                {mode === 'manager' && (
                  <th className="px-4 py-3 w-12">
                    <input 
                      type="checkbox" 
                      checked={selectedRows.size === shiftRows.length && shiftRows.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-4 py-3">Local / Setor</th>
                {mode === 'manager' && <th className="px-4 py-3">Cooperado</th>}
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3 text-center">Entrada</th>
                <th className="px-4 py-3 text-center">Saída</th>
                <th className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span>Status</span>
                    {mode === 'manager' && (
                      <button
                        onClick={() => {
                          const newValue = !showRecusadas;
                          setShowRecusadas(newValue);
                          console.log('[ControleDeProducao] Toggle exibir todos: antes=', showRecusadas, 'depois=', newValue);
                        }}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          showRecusadas
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                        title={showRecusadas ? 'Ocultando pendentes/recusados' : 'Exibindo apenas aceitos'}
                      >
                        Exibir todos
                      </button>
                    )}
                  </div>
                </th>
                {mode === 'cooperado' && <th className="px-4 py-3 text-center">Origem</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:bg-gray-900">
              {shiftRows.map((row) => (
                <tr 
                    key={row.id} 
                    onClick={mode === 'manager' ? () => handleSelectRow(row) : undefined}
                    className={mode === 'manager' ? `cursor-pointer transition-colors ${
                        (selectedPontoId === row.entry?.id || selectedPontoId === row.exit?.id) 
                          ? 'bg-primary-200 dark:bg-primary-800 font-semibold' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100'
                    }` : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100'}
                >
                  {mode === 'manager' && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedRows.has(row.id)}
                        onChange={() => toggleRowSelection(row.id)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 truncate max-w-[200px] text-gray-700 dark:text-gray-300" title={row.local}>
                    {row.setorNome}
                  </td>
                  {mode === 'manager' && <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.cooperadoNome}</td>}
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.data}</td>
                  
                  {/* Coluna Entrada */}
                  <td className="px-4 py-3 text-center font-mono font-bold text-green-700 dark:text-green-400 bg-green-50/50 dark:bg-green-950/30">
                    {row.entry ? new Date(row.entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                  </td>

                  {/* Coluna Saída */}
                  <td className="px-4 py-3 text-center font-mono font-bold text-red-700 dark:text-red-400 bg-red-50/50 dark:bg-red-950/30">
                    {row.exit ? (
                      new Date(row.exit.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                    ) : (
                      '--:--'
                    )}
                  </td>

                  <td className="px-4 py-3 text-center">
                    {(() => {
                      const isAnomalia = row.status.startsWith('⚠️');
                      const isPendente = row.status === 'Pendente';
                      const isAberto = row.status.includes('Aberto');
                      const isFechado = row.status === 'Fechado';
                      const isRecusado = row.status === 'Recusado';
                      
                      let badgeClass = 'bg-gray-500';
                      let label = row.status;
                      let detailsText = row.statusDetails || null;
                      
                      if (isAnomalia) {
                        badgeClass = 'bg-red-600';
                      } else if (isPendente) {
                        badgeClass = 'bg-amber-500';
                        label = 'Pendente';
                      } else if (isAberto) {
                        badgeClass = 'bg-amber-500';
                        label = 'Em Aberto';
                      } else if (isFechado) {
                        badgeClass = 'bg-green-600';
                        label = 'Fechado';
                      } else if (isRecusado) {
                        badgeClass = 'bg-red-600';
                        label = 'Recusado';
                      }
                      
                      return (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`px-2 py-1 text-xs rounded-full text-white font-bold shadow-sm ${badgeClass}`}>
                            {label}
                          </span>
                          {detailsText && (
                            <span className="text-[10px] text-gray-600 font-medium max-w-xs break-words text-center px-1">{detailsText}</span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  
                  {mode === 'cooperado' && (
                    <td className="px-4 py-3 text-center text-xs text-gray-600">
                      {(() => {
                        const isManualVal2 = (val: any, status?: string) => val === true || val === 'true' || val === 1 || val === '1' || status === 'Pendente';
                        const manualEntrada = isManualVal2((row.entry as any)?.isManual, row.entry?.status);
                        const manualSaida = isManualVal2((row.exit as any)?.isManual, row.exit?.status);
                        const hasManual = manualEntrada || manualSaida;
                        const hasBio = (!manualEntrada && row.entry) || (!manualSaida && row.exit);
                        if (hasManual && hasBio) return 'Biometria/Manual';
                        if (hasManual) return 'Manual';
                        return 'Biometria';
                      })()}
                    </td>
                  )}
                </tr>
              ))}
              {shiftRows.length === 0 && (
                <tr>
                    <td colSpan={mode === 'manager' ? 8 : 6} className="text-center py-12 text-gray-400">
                        <div className="flex flex-col items-center">
                            <Clock className="h-8 w-8 mb-2 opacity-30" />
                            <span>Nenhum registro encontrado{mode === 'cooperado' ? ' para o período selecionado.' : '.'}</span>
                        </div>
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FORM SECTION - Apenas para mode=manager */}
      {mode === 'manager' && (
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 mt-6">
        <h3 className="text-lg font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary-600" />
            Lançamento Manual / Correção
        </h3>
        
        {/* Info Box about Hospital Context */}
        <div className="mb-4 bg-primary-50 border border-primary-100 text-primary-800 px-4 py-2 rounded text-sm flex items-center">
            <Filter className="h-4 w-4 mr-2" />
            {filterHospital 
                ? <span>Unidade Selecionada: <strong>{hospitais.find(h => h.id === filterHospital)?.nome}</strong></span>
                : <span className="text-red-600 font-bold">Atenção: Selecione um Hospital no filtro acima para habilitar o cadastro.</span>
            }
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Autocomplete Cooperado Input */}
            <div className="relative space-y-1">
                <label className="text-sm font-bold text-gray-700">Cooperado</label>
                <div className="relative">
                    <input 
                        type="text" 
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="Digite o nome..."
                        value={formCooperadoInput}
                        onChange={e => {
                            setFormCooperadoInput(e.target.value);
                            setFormCooperadoId(''); 
                            setShowCooperadoSuggestions(true);
                        }}
                        onFocus={() => setShowCooperadoSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowCooperadoSuggestions(false), 200)}
                    />
                    {showCooperadoSuggestions && formCooperadoInput && (
                        <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-b-lg shadow-lg max-h-60 overflow-y-auto mt-1">
                            {cooperados.filter(c => c.nome.toLowerCase().includes(formCooperadoInput.toLowerCase())).length > 0 ? (
                                cooperados
                                .filter(c => c.nome.toLowerCase().includes(formCooperadoInput.toLowerCase()))
                                .map(c => (
                                    <div 
                                        key={c.id} 
                                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700"
                                        onMouseDown={() => {
                                            setFormCooperadoId(c.id);
                                            setFormCooperadoInput(c.nome);
                                            setShowCooperadoSuggestions(false);
                                        }}
                                    >
                                        <span className="font-bold">{c.nome}</span> 
                                        <span className="text-gray-400 text-xs ml-2">({c.matricula})</span>
                                    </div>
                                ))
                            ) : (
                                <div className="px-4 py-2 text-sm text-gray-400 italic">Nenhum encontrado</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Setor dependent on Filter Hospital */}
            <div className="space-y-1">
                <label className="text-sm font-bold text-gray-700">Setor</label>
                <select 
                    className="w-full bg-white text-gray-900 border border-gray-300 rounded p-2 focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-gray-100"
                    value={formSetorId}
                    onChange={e => setFormSetorId(e.target.value)}
                    disabled={!filterHospital && !selectedPontoId}
                >
                    <option value="">Selecione...</option>
                    {getAvailableSetoresForForm().map(s => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                </select>
            </div>

            <div className="space-y-1 lg:block hidden"></div>
            <div className="space-y-1 lg:block hidden"></div>

            {/* Row 2 */}
            <div className="space-y-1">
                <label className="text-sm font-bold text-gray-700">Data do Plantão</label>
                <input 
                    type="date" 
                    className="w-full bg-white text-gray-900 border border-gray-300 rounded p-2 outline-none"
                    value={formData}
                    onChange={e => setFormData(e.target.value)}
                />
            </div>

            <div className="space-y-1">
                <label className="text-sm font-bold text-gray-700">Hora</label>
                <input 
                    type="time" 
                    className="w-full bg-white text-gray-900 border border-gray-300 rounded p-2 outline-none"
                    value={formHora}
                    onChange={e => setFormHora(e.target.value)}
                />
            </div>

            <div className="space-y-1">
                <label className="text-sm font-bold text-gray-700 block mb-2">Tipo de Registro</label>
                <div className="flex items-center space-x-6">
                    <label className="flex items-center cursor-pointer">
                        <input 
                            type="radio" 
                            name="tipoPonto" 
                            className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                            checked={formTipo === TipoPonto.ENTRADA}
                            onChange={() => setFormTipo(TipoPonto.ENTRADA)}
                        />
                        <span className="ml-2 text-gray-900 font-medium">Entrada</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                        <input 
                            type="radio" 
                            name="tipoPonto" 
                            className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                            checked={formTipo === TipoPonto.SAIDA}
                            onChange={() => setFormTipo(TipoPonto.SAIDA)}
                        />
                        <span className="ml-2 text-gray-900 font-medium">Saída</span>
                    </label>
                </div>
            </div>

        </div>

        <div className="flex flex-wrap gap-4 mt-8 pt-4 border-t border-gray-100">
            <button 
                onClick={handleSalvar}
                className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-6 rounded shadow transition-colors"
            >
                Salvar Registro
            </button>
            
            <button 
                onClick={handleNovoPlantao}
                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded shadow transition-colors"
            >
                Limpar Campos
            </button>

            <div className="flex-1"></div>

            <button 
                onClick={handleExcluir}
                disabled={selectedRows.size === 0 && !selectedPontoId}
                className={`font-bold py-2 px-6 rounded shadow transition-colors flex items-center ${
                    (selectedRows.size === 0 && !selectedPontoId)
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
            >
                <Trash2 className="w-4 h-4 mr-2" />
                {selectedRows.size > 0 ? `Excluir (${selectedRows.size})` : 'Excluir Registro'}
            </button>
        </div>
      </div>
      )}

        {/* Removido: modal de justificativa de horário */}
    </div>
  );
};
