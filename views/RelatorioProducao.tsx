
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { RegistroPonto, Cooperado, Hospital, TipoPonto, Setor } from '../types';
import { apiGet } from '../services/api';
import { Search, Save, Trash2, Clock, Filter, X, ArrowRight } from 'lucide-react';

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

export const RelatorioProducao: React.FC = () => {
      // Critérios de ordenação
      const orderOptions = [
        { value: 'cooperadoNome', label: 'Nome' },
        { value: 'categoriaProfissional', label: 'Categoria Profissional' },
        { value: 'setorNome', label: 'Setor' },
        { value: 'data', label: 'Data' },
        { value: 'entrada', label: 'Entrada' },
        { value: 'saida', label: 'Saída' },
      ];
      const [order1, setOrder1] = useState('cooperadoNome');
      const [order2, setOrder2] = useState('data');
      const [order3, setOrder3] = useState('entrada');
      const [order4, setOrder4] = useState('');
    // Filtro de status
    const [filterStatus, setFilterStatus] = useState<'all' | 'fechados' | 'abertos'>('all');
  const [logs, setLogs] = useState<RegistroPonto[]>([]);
  const [cooperados, setCooperados] = useState<Cooperado[]>([]);
  const [hospitais, setHospitais] = useState<Hospital[]>([]);
  const [setoresDisponiveis, setSetoresDisponiveis] = useState<Setor[]>([]);
  const [todosSetores, setTodosSetores] = useState<Setor[]>([]); // Setores de todos os hospitais para exibição
  
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

  useEffect(() => {
    const init = async () => {
      await loadData();
    };
    init();
  }, []);

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
    setLogs(sorted);
  };

  const loadAllSetores = async (hospitaisList: Hospital[]) => {
    try {
      const setoresByHospital = await Promise.all(
        hospitaisList.map(async (hospital) => {
          try {
            const setores = await apiGet<Setor[]>(`hospital-setores?hospitalId=${hospital.id}`);
            return setores || [];
          } catch {
            return [];
          }
        })
      );

      const flattened = setoresByHospital.flat();
      const unique = flattened.filter((setor, index, self) => index === self.findIndex(s => s.id === setor.id));
      setTodosSetores(unique);
    } catch (error) {
      console.error('[RelatorioProducao] Erro ao carregar todos os setores:', error);
    }
  };

  // --- FILTER LOGIC ---
  const getFilteredLogs = () => {
    return logs.filter(log => {
      // 1. Hospital Filter
      if (filterHospital && log.hospitalId !== filterHospital) return false;
      // 2. Setor Filter
      if (filterSetor && log.setorId !== filterSetor) return false;
      // 3. Cooperado Filter
      if (filterCooperado && log.cooperadoId !== filterCooperado) return false;
      // 4. Date Range
      if (filterDataIni) {
        const logDate = new Date(log.timestamp).toISOString().split('T')[0];
        if (logDate < filterDataIni) return false;
      }
      if (filterDataFim) {
        const logDate = new Date(log.timestamp).toISOString().split('T')[0];
        if (logDate > filterDataFim) return false;
      }
      // 5. Status Filter
      if (filterStatus === 'fechados' && log.status !== 'Fechado') return false;
      if (filterStatus === 'abertos' && log.status !== 'Aberto') return false;
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
    const setoresDisponiveis = getAvailableSetoresForFilter();
    // 1. Process Entries
    filteredLogs.forEach(log => {
      if (log.tipo === TipoPonto.ENTRADA) {
        const matchingExit = filteredLogs.find(l => l.tipo === TipoPonto.SAIDA && l.relatedId === log.id);
        if (matchingExit) processedExits.add(matchingExit.id);
        shifts.push({
          id: log.id,
          cooperadoNome: log.cooperadoNome,
          local: log.local,
          setorNome: (() => {
            const setorId = String(log.setorId);
            const setorName = log.setorId ? todosSetores.find(s => String(s.id) === setorId)?.nome : '';
            const hospital = hospitais.find(h => h.id === log.hospitalId);
            const isFiltered = filterHospital && filterHospital !== '';
            const result = isFiltered ? (setorName || log.local) : `${hospital?.nome || log.local}${setorName ? ' - ' + setorName : ''}`;
            return result;
          })(),
          data: new Date(log.timestamp).toLocaleDateString(),
          entry: log,
          exit: matchingExit,
          status: matchingExit ? 'Fechado' : 'Em Aberto',
          categoriaProfissional: cooperados.find(c => c.id === log.cooperadoId)?.categoriaProfissional || ''
        });
      }
    });
    // 2. Process Orphan Exits
    filteredLogs.forEach(log => {
      if (log.tipo === TipoPonto.SAIDA && !processedExits.has(log.id)) {
        shifts.push({
          id: log.id,
          cooperadoNome: log.cooperadoNome,
          local: log.local,
          setorNome: (() => {
            const setorId = String(log.setorId);
            const setorName = log.setorId ? todosSetores.find(s => String(s.id) === setorId)?.nome : '';
            const hospital = hospitais.find(h => h.id === log.hospitalId);
            const isFiltered = filterHospital && filterHospital !== '';
            const result = isFiltered ? (setorName || log.local) : `${hospital?.nome || log.local}${setorName ? ' - ' + setorName : ''}`;
            return result;
          })(),
          data: new Date(log.timestamp).toLocaleDateString(),
          entry: undefined,
          exit: log,
          status: 'Fechado (S/E)',
          categoriaProfissional: cooperados.find(c => c.id === log.cooperadoId)?.categoriaProfissional || ''
        });
      }
    });
    // Ordenação dinâmica
    const orderFields = [order1, order2, order3, order4].filter(Boolean);
    const compare = (a: any, b: any) => {
      for (const field of orderFields) {
        let valA = a[field] || '';
        let valB = b[field] || '';
        // Datas e horários: comparar como data
        if (field === 'data') {
          valA = new Date(a.entry?.timestamp || a.exit?.timestamp || 0).getTime();
          valB = new Date(b.entry?.timestamp || b.exit?.timestamp || 0).getTime();
        }
        if (field === 'entrada') {
          valA = a.entry ? new Date(a.entry.timestamp).getTime() : 0;
          valB = b.entry ? new Date(b.entry.timestamp).getTime() : 0;
        }
        if (field === 'saida') {
          valA = a.exit ? new Date(a.exit.timestamp).getTime() : 0;
          valB = b.exit ? new Date(b.exit.timestamp).getTime() : 0;
        }
        if (valA < valB) return -1;
        if (valA > valB) return 1;
      }
      return 0;
    };
    return shifts.sort(compare);
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
        loadData();
        handleNovoPlantao();
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Controle de Produção</h2>
      </div>

      {/* --- FILTERS SECTION --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                {/* CLASSIFICAR E ORGANIZAR */}
                <div className="mb-4 mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-primary-700 text-sm">Classificar e Organizar</span>
                    <span className="text-xs text-gray-400">(opcional)</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 font-semibold">1º Critério</label>
                      <select className="w-full border rounded p-1" value={order1} onChange={e => setOrder1(e.target.value)}>
                        {orderOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-semibold">2º Critério</label>
                      <select className="w-full border rounded p-1" value={order2} onChange={e => setOrder2(e.target.value)}>
                        <option value="">(nenhum)</option>
                        {orderOptions.filter(opt => opt.value !== order1).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-semibold">3º Critério</label>
                      <select className="w-full border rounded p-1" value={order3} onChange={e => setOrder3(e.target.value)}>
                        <option value="">(nenhum)</option>
                        {orderOptions.filter(opt => opt.value !== order1 && opt.value !== order2).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-semibold">4º Critério</label>
                      <select className="w-full border rounded p-1" value={order4} onChange={e => setOrder4(e.target.value)}>
                        <option value="">(nenhum)</option>
                        {orderOptions.filter(opt => opt.value !== order1 && opt.value !== order2 && opt.value !== order3).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
        <div className="flex items-center gap-2 mb-3 text-primary-700 font-semibold border-b pb-2">
            <Filter className="h-5 w-5" />
            <h3>Filtros de Visualização</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                  {/* Status Filter */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
                    <select 
                      className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                      value={filterStatus}
                      onChange={e => setFilterStatus(e.target.value as any)}
                    >
                      <option value="all">Fechados e Abertos</option>
                      <option value="fechados">Apenas Fechados</option>
                      <option value="abertos">Apenas Abertos</option>
                    </select>
                  </div>
            {/* Hospital Filter */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Hospital</label>
                <select 
                    className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    value={filterHospital}
                    onChange={e => { setFilterHospital(e.target.value); setFilterSetor(''); }}
                >
                    <option value="">Todos os Hospitais</option>
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

            {/* Cooperado Filter - Autocomplete */}
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

      {/* TABLE SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-primary-600 text-white font-bold sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">Selecionar</th>
                <th className="px-4 py-3">Setor</th>
                <th className="px-4 py-3">Cooperado</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3 text-center">Entrada</th>
                <th className="px-4 py-3 text-center">Saída</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Código</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:bg-gray-900">
              {shiftRows.map((row) => (
                <tr 
                    key={row.id} 
                    onClick={() => handleSelectRow(row)}
                    className={`cursor-pointer transition-colors ${
                        (selectedPontoId === row.entry?.id || selectedPontoId === row.exit?.id) 
                          ? 'bg-primary-200 dark:bg-primary-800 font-semibold' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100'
                    }`}
                >
                  <td className="px-4 py-3">
                    <button className="text-xs text-primary-600 dark:text-primary-400 underline font-medium">Selecionar</button>
                  </td>
                  <td className="px-4 py-3 truncate max-w-[200px] text-gray-700 dark:text-gray-300" title={row.local}>
                    {row.setorNome}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.cooperadoNome}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.data}</td>
                  
                  {/* Coluna Entrada */}
                  <td className="px-4 py-3 text-center font-mono font-bold text-green-700 dark:text-green-400 bg-green-50/50 dark:bg-green-950/30">
                    {row.entry ? new Date(row.entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                  </td>

                  {/* Coluna Saída */}
                  <td className="px-4 py-3 text-center font-mono font-bold text-red-700 dark:text-red-400 bg-red-50/50 dark:bg-red-950/30">
                    {row.exit ? new Date(row.exit.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                  </td>

                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs rounded-full text-white font-bold shadow-sm ${row.status.includes('Aberto') ? 'bg-amber-500' : 'bg-green-600'}`}>
                        {row.status === 'Aberto' ? 'Em Aberto' : row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                    {row.entry?.codigo || row.exit?.codigo}
                  </td>
                </tr>
              ))}
              {shiftRows.length === 0 && (
                <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">
                        <div className="flex flex-col items-center">
                            <Clock className="h-8 w-8 mb-2 opacity-30" />
                            <span>Nenhum registro encontrado.</span>
                        </div>
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FORM SECTION */}
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
    </div>
  );
};
