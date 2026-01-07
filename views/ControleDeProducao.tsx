
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { RegistroPonto, Cooperado, Hospital, TipoPonto, Setor, Justificativa } from '../types';
import { apiGet } from '../services/api';
import { Search, Save, Trash2, Clock, Filter, X, ArrowRight, AlertTriangle, AlertCircle, CheckCircle, PlusCircle } from 'lucide-react';

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

  const [filterDataIni, setFilterDataIni] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');

  // Selection State
  const [selectedPontoId, setSelectedPontoId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null); // Para rastrear qual é a entrada
  const [selectedExitId, setSelectedExitId] = useState<string | null>(null); // Para rastrear qual é a saída

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [justificationTarget, setJustificationTarget] = useState<{ entryId: string; type: 'SAIDA' | 'ENTRADA' } | null>(null);
  const [justificationTime, setJustificationTime] = useState('');
  const [justificationReason, setJustificationReason] = useState('Esquecimento');
  const [justificationDesc, setJustificationDesc] = useState('');

  // Registro completo de plantão não registrado (modo cooperado)
  const [missingHospitalId, setMissingHospitalId] = useState('');
  const [missingSetorId, setMissingSetorId] = useState('');
  const [missingDate, setMissingDate] = useState('');
  const [missingEntrada, setMissingEntrada] = useState('');
  const [missingSaida, setMissingSaida] = useState('');
  const [missingReason, setMissingReason] = useState('Esquecimento');
  const [missingDesc, setMissingDesc] = useState('');
  const [missingSetores, setMissingSetores] = useState<Setor[]>([]);

  // Dados do cooperado logado (modo cooperado)
  const cooperadoLogadoId = mode === 'cooperado' && session?.type === 'COOPERADO' ? session?.user?.id : null;
  const cooperadoLogadoData = mode === 'cooperado' && session?.type === 'COOPERADO' ? session?.user : null;

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

    return () => clearInterval(pollInterval);
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
      await StorageService.refreshPontosFromRemote();
      await StorageService.refreshCooperadosFromRemote();
      await StorageService.refreshHospitaisFromRemote();
    } catch (error) {
      console.error('Erro ao sincronizar dados do Neon:', error);
    }
    
    setCooperados(StorageService.getCooperados());
    setHospitais(StorageService.getHospitais());
    const allPontos = StorageService.getPontos();
    // Carregar setores de todos os hospitais para exibição (Hospital - Setor quando filtro vazio)
    await loadAllSetores(StorageService.getHospitais());
    // Order: Ascending (Oldest top, Newest bottom)
    const sorted = allPontos.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const normalized = sorted.map((p) => {
      const manualFlag = p.isManual === true 
        || (p as any).isManual === 'true' 
        || (p as any).isManual === 1 
        || (p as any).isManual === '1' 
        || (p.codigo && String(p.codigo).startsWith('MAN-'))
        || p.status === 'Pendente';

      // Só sobrescrever status para 'Pendente' se for manual E NÃO tiver sido aprovado/rejeitado
      if (manualFlag && !p.validadoPor && !p.rejeitadoPor && p.status !== 'Fechado' && p.status !== 'Rejeitado') {
        return { ...p, isManual: true, status: 'Pendente' };
      }

      return { ...p, isManual: manualFlag || p.isManual };
    });

    // Persistir normalização no storage oficial (biohealth_pontos)
    localStorage.setItem('biohealth_pontos', JSON.stringify(normalized));

    setLogs(normalized);
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

  // --- FILTER LOGIC ---
  const getFilteredLogs = () => {
    return logs.filter(log => {
      // 0. Modo Cooperado: filtrar apenas registros do cooperado logado
      if (mode === 'cooperado' && cooperadoLogadoId && log.cooperadoId !== cooperadoLogadoId) {
        return false;
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
        // Procurar SAÍDA posterior não pareada
        const saidaIndex = saidas.findIndex(s => 
          new Date(s.timestamp).getTime() > new Date(entrada.timestamp).getTime() &&
          !processedExits.has(s.id)
        );

        let saidaPareada: RegistroPonto | undefined;
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
          
          // Se está filtrando por hospital, mostrar apenas setor
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

        const entradaManual = entrada.isManual === true || entrada.isManual === 'true' || entrada.status === 'Pendente';
        const saidaManual = saidaPareada && (saidaPareada.isManual === true || saidaPareada.isManual === 'true' || saidaPareada.status === 'Pendente');

        const aguardandoEntrada = entrada.status === 'Pendente' || (!entrada.status && entradaManual);
        const aguardandoSaida = saidaPareada && (saidaPareada.status === 'Pendente' || (!saidaPareada.status && saidaManual));

        const manualPair = entradaManual || saidaManual;
        const hasApproval = (entrada.validadoPor && entrada.status === 'Fechado') || (saidaPareada && saidaPareada.validadoPor && saidaPareada.status === 'Fechado');

        let statusLabel = 'Em Aberto';
        if (entrada.status === 'Rejeitado' || (saidaPareada?.status === 'Rejeitado')) {
          statusLabel = 'Rejeitado';
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
          status: statusLabel
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
            
            // Se está filtrando por hospital, mostrar apenas setor
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

          shifts.push({
            id: saida.id,
            cooperadoNome: saida.cooperadoNome,
            local: saida.local,
            setorNome: getSetorNomeOrfao(saida),
            data: new Date(saida.timestamp).toLocaleDateString(),
            entry: undefined,
            exit: saida,
            status: 'Em Aberto'
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
    
    // Definir o hospital do registro
    setFilterHospital(ponto.hospitalId);
    
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

                const updatedEntry = { ...entryPonto, status: 'Fechado' as const };
                
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

        const updatedEntry = { ...entryPonto, status: 'Fechado' as const };
        
        StorageService.savePonto(exitPonto);
        StorageService.updatePonto(updatedEntry);
        
        alert("Saída registrada!");
    }

    loadData();
    handleNovoPlantao();
  };

  const handleExcluir = () => {
    if (!selectedPontoId) {
        alert("Selecione um registro na tabela para excluir.");
        return;
    }
    
    if (confirm("Tem certeza? Se for uma Entrada, a Saída vinculada também será excluída.")) {
        StorageService.deletePonto(selectedPontoId);
        
        // Atualizar estado imediatamente (sem aguardar Neon)
        const updated = StorageService.getPontos();
        const sorted = updated.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        setLogs(sorted);
        
        handleNovoPlantao();
        
        // Sincronizar com Neon em background (assíncrono)
        loadData();
    }
  };

  const clearFilters = () => {
    setFilterHospital('');
    setFilterSetor('');
    setFilterCooperado('');
    setFilterCooperadoInput('');
    setFilterDataIni('');
    setFilterDataFim('');
  }

  // Handlers de Justificativa (modo cooperado)
  const handleOpenJustification = (entryId: string, type: 'SAIDA' | 'ENTRADA') => {
    setJustificationTarget({ entryId, type });
    setJustificationTime('');
    setJustificationReason('Esquecimento');
    setJustificationDesc('');
    setIsModalOpen(true);
  };

  const submitJustification = () => {
    if (!justificationTarget || !justificationTime) return;
    if (!cooperadoLogadoData) return;

    // Find the original Entry
    const entry = logs.find(l => l.id === justificationTarget.entryId);
    if (!entry) return;

    // Construct timestamp based on Entry Date + Justification Time
    const entryDate = new Date(entry.timestamp).toISOString().split('T')[0];
    const newTimestamp = new Date(`${entryDate}T${justificationTime}:00`).toISOString();

    // Criar justificativa na tabela separada
    const novaJustificativa: Justificativa = {
      id: crypto.randomUUID(),
      cooperadoId: cooperadoLogadoData.id,
      cooperadoNome: cooperadoLogadoData.nome,
      pontoId: undefined, // Será criado após aprovação
      motivo: justificationReason,
      descricao: justificationDesc,
      dataSolicitacao: new Date().toISOString(),
      status: 'Pendente',
      setorId: entry.setorId, // Adicionar setor da entrada original
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    StorageService.saveJustificativa(novaJustificativa);

    // Criar ponto vinculado à justificativa
    const novoPonto: RegistroPonto = {
        id: crypto.randomUUID(),
        codigo: entry.codigo,
        cooperadoId: cooperadoLogadoData.id,
        cooperadoNome: cooperadoLogadoData.nome,
        timestamp: newTimestamp,
        tipo: justificationTarget.type === 'SAIDA' ? TipoPonto.SAIDA : TipoPonto.ENTRADA,
        local: entry.local,
        hospitalId: entry.hospitalId,
        setorId: entry.setorId,
        isManual: true,
        status: 'Pendente',
        relatedId: entry.id
    };

    StorageService.savePonto(novoPonto);
    
    // Vincular ponto à justificativa
    novaJustificativa.pontoId = novoPonto.id;
    StorageService.saveJustificativa(novaJustificativa);

    setIsModalOpen(false);
    loadData();
    alert('Justificativa enviada com sucesso! Aguarde a aprovação do gestor.');
  };

  const resetMissingShiftForm = () => {
    setMissingHospitalId('');
    setMissingSetorId('');
    setMissingDate('');
    setMissingEntrada('');
    setMissingSaida('');
    setMissingReason('Esquecimento');
    setMissingDesc('');
  };

  const submitMissingShift = () => {
    if (mode !== 'cooperado') return;
    if (!cooperadoLogadoData) return;

    if (!missingHospitalId || !missingSetorId || !missingDate || !missingEntrada || !missingSaida) {
      alert('Preencha data, entrada, saída, hospital e setor.');
      return;
    }

    if (missingEntrada >= missingSaida) {
      alert('O horário de saída deve ser maior que o de entrada.');
      return;
    }

    if (missingReason === 'Outro Motivo' && !missingDesc.trim()) {
      alert('Descreva o motivo quando selecionar "Outro Motivo".');
      return;
    }

    const hospital = hospitais.find(h => String(h.id) === String(missingHospitalId));
    const localNome = hospital?.nome || 'Hospital não informado';

    const entradaTimestamp = new Date(`${missingDate}T${missingEntrada}:00`).toISOString();
    const saidaTimestamp = new Date(`${missingDate}T${missingSaida}:00`).toISOString();

    const entryId = crypto.randomUUID();
    const exitId = crypto.randomUUID();
    const codigoBase = `MAN-${Date.now()}`;

    const justificativa: Justificativa = {
      id: crypto.randomUUID(),
      cooperadoId: cooperadoLogadoData.id,
      cooperadoNome: cooperadoLogadoData.nome,
      pontoId: undefined,
      motivo: missingReason,
      descricao: missingDesc,
      dataSolicitacao: new Date().toISOString(),
      status: 'Pendente',
      setorId: missingSetorId, // Adicionar setor selecionado
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const pontoEntrada: RegistroPonto = {
      id: entryId,
      codigo: codigoBase,
      cooperadoId: cooperadoLogadoData.id,
      cooperadoNome: cooperadoLogadoData.nome,
      timestamp: entradaTimestamp,
      tipo: TipoPonto.ENTRADA,
      local: localNome,
      hospitalId: hospital?.id || missingHospitalId,
      setorId: missingSetorId,
      isManual: true,
      status: 'Pendente'
    };

    const pontoSaida: RegistroPonto = {
      id: exitId,
      codigo: codigoBase,
      cooperadoId: cooperadoLogadoData.id,
      cooperadoNome: cooperadoLogadoData.nome,
      timestamp: saidaTimestamp,
      tipo: TipoPonto.SAIDA,
      local: localNome,
      hospitalId: hospital?.id || missingHospitalId,
      setorId: missingSetorId,
      isManual: true,
      status: 'Pendente',
      relatedId: entryId
    };

    StorageService.saveJustificativa(justificativa);
    StorageService.savePonto(pontoEntrada);
    StorageService.savePonto(pontoSaida);

    justificativa.pontoId = pontoSaida.id;
    StorageService.saveJustificativa(justificativa);

    alert('Plantão incluído e enviado para aprovação do gestor.');
    resetMissingShiftForm();
    loadData();
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
        
        <div className="mt-3 flex justify-end">
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
                {mode === 'manager' && <th className="px-4 py-3">Selecionar</th>}
                <th className="px-4 py-3">Local / Setor</th>
                {mode === 'manager' && <th className="px-4 py-3">Cooperado</th>}
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3 text-center">Entrada</th>
                <th className="px-4 py-3 text-center">Saída</th>
                <th className="px-4 py-3 text-center">Status</th>
                {mode === 'cooperado' && <th className="px-4 py-3 text-center">Origem</th>}
                {mode === 'manager' && <th className="px-4 py-3">Código</th>}
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
                    <td className="px-4 py-3">
                      <button className="text-xs text-primary-600 dark:text-primary-400 underline font-medium">Selecionar</button>
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
                      mode === 'cooperado' && row.entry && row.entry.status !== 'Pendente' ? (
                        <button 
                          onClick={() => handleOpenJustification(row.id, 'SAIDA')}
                          className="text-primary-600 hover:text-primary-800 underline text-xs flex items-center justify-center w-full gap-1"
                          title="Justificar horário em aberto"
                        >
                          <AlertTriangle className="h-3 w-3" /> --:--
                        </button>
                      ) : '--:--'
                    )}
                  </td>

                  <td className="px-4 py-3 text-center">
                    {(() => {
                      const isAnomalia = row.status.startsWith('⚠️');
                      const isPendente = row.status === 'Pendente';
                      const isAberto = row.status.includes('Aberto');
                      const isFechado = row.status === 'Fechado';
                      const isRejeitado = row.status === 'Rejeitado';
                      
                      // Debug: check what data we have
                      console.log('[Status Badge] row.status:', row.status, 'entry:', row.entry, 'exit:', row.exit);
                      
                      let badgeClass = 'bg-gray-500';
                      let label = row.status;
                      let detailsText = null;
                      
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
                        const validador = row.entry?.validadoPor || row.exit?.validadoPor;
                        if (validador) {
                          detailsText = validador;
                        }
                      } else if (isRejeitado) {
                        badgeClass = 'bg-red-600';
                        label = 'Recusado';
                        const rejeitador = row.entry?.rejeitadoPor || row.exit?.rejeitadoPor;
                        const motivo = row.entry?.motivoRejeicao || row.exit?.motivoRejeicao;
                        if (rejeitador || motivo) {
                          detailsText = `${rejeitador || 'Gestor'}${motivo ? ' - ' + motivo : ''}`;
                        }
                      }
                      
                      return (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`px-2 py-1 text-xs rounded-full text-white font-bold shadow-sm ${badgeClass}`}>
                            {label}
                          </span>
                          {detailsText && (
                            <span className="text-xs text-gray-600 font-medium max-w-xs break-words">{detailsText}</span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  
                  {mode === 'cooperado' && (
                    <td className="px-4 py-3 text-center text-xs text-gray-600">
                      {(() => {
                        const manualEntrada = row.entry?.isManual === true || row.entry?.isManual === 'true' || row.entry?.status === 'Pendente';
                        const manualSaida = row.exit?.isManual === true || row.exit?.isManual === 'true' || row.exit?.status === 'Pendente';
                        const hasManual = manualEntrada || manualSaida;
                        const hasBio = (!manualEntrada && row.entry) || (!manualSaida && row.exit);
                        if (hasManual && hasBio) return 'Biometria/Manual';
                        if (hasManual) return 'Manual';
                        return 'Biometria';
                      })()}
                    </td>
                  )}
                  
                  {mode === 'manager' && (
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {row.entry?.codigo || row.exit?.codigo}
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

            <div className="space-y-1">
                <label className={`text-sm font-bold ${formTipo === TipoPonto.SAIDA ? 'text-gray-700' : 'text-gray-300'}`}>
                    Cód. Registro Entrada
                </label>
                <input 
                    type="text" 
                    placeholder="Obrigatório para Saída"
                    className="w-full bg-white text-gray-900 border border-gray-300 rounded p-2 outline-none disabled:bg-gray-100"
                    disabled={formTipo !== TipoPonto.SAIDA}
                    value={formInputCodigo}
                    onChange={e => setFormInputCodigo(e.target.value)}
                />
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
                disabled={!selectedPontoId}
                className={`font-bold py-2 px-6 rounded shadow transition-colors flex items-center ${
                    !selectedPontoId 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
            >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir Registro
            </button>
        </div>
      </div>
      )}

      {/* Modal de Justificativa */}
      {mode === 'cooperado' && isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md animate-fade-in mx-4">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-500" />
                        Justificativa de Horário
                    </h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm mb-4">
                        Preencha os dados abaixo. Sua solicitação será enviada para aprovação do gestor.
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-bold text-gray-700">Horário Realizado</label>
                        <input 
                            type="time" 
                            className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary-500"
                            value={justificationTime}
                            onChange={e => setJustificationTime(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-bold text-gray-700">Motivo da Falha</label>
                        <select 
                            className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                            value={justificationReason}
                            onChange={e => setJustificationReason(e.target.value)}
                        >
                            <option value="Esquecimento">Esquecimento</option>
                            <option value="Computador Inoperante">Computador Inoperante</option>
                            <option value="Falta de Energia">Falta de Energia</option>
                            <option value="Outro Motivo">Outro Motivo</option>
                        </select>
                    </div>

                    {justificationReason === 'Outro Motivo' && (
                        <div className="space-y-1">
                            <label className="text-sm font-bold text-gray-700">Descrição Detalhada</label>
                            <textarea 
                                className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                                rows={3}
                                placeholder="Descreva o motivo..."
                                value={justificationDesc}
                                onChange={e => setJustificationDesc(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="flex justify-end space-x-2 pt-2">
                        <button 
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={submitJustification}
                            disabled={!justificationTime || (justificationReason === 'Outro Motivo' && !justificationDesc)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            <CheckCircle className="h-4 w-4" />
                            Concluir
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
