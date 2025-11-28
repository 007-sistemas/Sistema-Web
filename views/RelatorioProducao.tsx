
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { RegistroPonto, Cooperado, Hospital, TipoPonto } from '../types';
import { Search, Save, Trash2, Clock, Filter, X } from 'lucide-react';

export const RelatorioProducao: React.FC = () => {
  const [logs, setLogs] = useState<RegistroPonto[]>([]);
  const [cooperados, setCooperados] = useState<Cooperado[]>([]);
  const [hospitais, setHospitais] = useState<Hospital[]>([]);
  
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
    loadData();
  }, []);

  const loadData = () => {
    setCooperados(StorageService.getCooperados());
    setHospitais(StorageService.getHospitais());
    const allPontos = StorageService.getPontos();
    // Order: Ascending (Oldest top, Newest bottom) as per requirement
    const sorted = allPontos.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    setLogs(sorted);
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

      return true;
    });
  };

  const filteredLogs = getFilteredLogs();

  // Helper to get sectors based on selected HOSPITAL FILTER
  const getAvailableSetoresForForm = () => {
    const h = hospitais.find(hp => hp.id === filterHospital);
    return h ? h.setores : [];
  };
  
  const getAvailableSetoresForFilter = () => {
    const h = hospitais.find(hp => hp.id === filterHospital);
    return h ? h.setores : [];
  };

  const handleSelectRow = (ponto: RegistroPonto) => {
    setSelectedPontoId(ponto.id);
    
    // Populate form just for visual reference or editing (limited editing)
    setFormCooperadoId(ponto.cooperadoId);
    setFormCooperadoInput(ponto.cooperadoNome); // Fill text input
    setFormSetorId(ponto.setorId || '');
    
    const d = new Date(ponto.timestamp);
    setFormData(d.toISOString().split('T')[0]);
    setFormHora(d.toTimeString().substring(0,5));
    
    setFormTipo(ponto.tipo);
    // If selecting an Entry, fill the code input to facilitate creating an Exit
    if (ponto.tipo === TipoPonto.ENTRADA) {
        setFormInputCodigo(ponto.codigo);
    } else {
        setFormInputCodigo('');
    }
  };

  const handleNovoPlantao = () => {
    setSelectedPontoId(null);
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
    // Validation: Hospital must be selected in the FILTER to know where to save
    if (!filterHospital) {
        alert("Selecione uma Unidade Hospitalar no filtro acima para realizar lançamentos.");
        return;
    }

    if (!formCooperadoId || !formSetorId || !formData || !formHora) {
        alert("Preencha todos os campos obrigatórios. Certifique-se de selecionar um cooperado da lista.");
        return;
    }

    const timestamp = new Date(`${formData}T${formHora}:00`).toISOString();
    const cooperado = cooperados.find(c => c.id === formCooperadoId);
    const hospital = hospitais.find(h => h.id === filterHospital); // Uses Filter Context
    const setor = hospital?.setores.find(s => s.id === formSetorId);

    if (!cooperado || !hospital || !setor) return;

    if (formTipo === TipoPonto.ENTRADA) {
        // --- REGISTER ENTRY ---
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
            setorId: setor.id,
            isManual: true,
            status: 'Aberto',
            validadoPor: 'Admin'
        };
        StorageService.savePonto(novoPonto);
        alert(`Entrada registrada com sucesso! Código: ${newCode}`);
    } 
    else {
        // --- REGISTER EXIT ---
        if (!formInputCodigo) {
            alert("Para registrar SAÍDA, informe o Código de Registro da Entrada.");
            return;
        }

        // 1. Find the entry by code
        const entryPonto = logs.find(p => p.codigo === formInputCodigo && p.tipo === TipoPonto.ENTRADA);

        if (!entryPonto) {
            alert("Código de entrada não encontrado.");
            return;
        }

        if (entryPonto.status === 'Fechado') {
            alert("Este registro de entrada já foi fechado.");
            return;
        }

        if (entryPonto.cooperadoId !== cooperado.id) {
            alert("O código informado pertence a outro cooperado.");
            return;
        }

        // 2. Create Exit Record
        const exitPonto: RegistroPonto = {
            id: crypto.randomUUID(),
            codigo: entryPonto.codigo,
            cooperadoId: cooperado.id,
            cooperadoNome: cooperado.nome,
            timestamp: timestamp,
            tipo: TipoPonto.SAIDA,
            local: `${hospital.nome} - ${setor.nome}`,
            hospitalId: hospital.id,
            setorId: setor.id,
            isManual: true,
            status: 'Fechado',
            validadoPor: 'Admin',
            relatedId: entryPonto.id // Link to Entry
        };

        // 3. Update Entry to Fechado
        const updatedEntry = { ...entryPonto, status: 'Fechado' as const };
        
        StorageService.savePonto(exitPonto);
        StorageService.updatePonto(updatedEntry);
        
        alert("Saída registrada e ciclo fechado com sucesso!");
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
        <h2 className="text-2xl font-bold text-gray-800">Relatório e Lançamento de Produção</h2>
      </div>

      {/* --- FILTERS SECTION --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 mb-3 text-primary-700 font-semibold border-b pb-2">
            <Filter className="h-5 w-5" />
            <h3>Filtros de Visualização</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                            setFilterCooperado(''); // Clear ID if typing to force selection or search
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
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-amber-500 text-white font-bold sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">Selecionar</th>
                <th className="px-4 py-3">Setor</th>
                <th className="px-4 py-3">Cooperado</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Hora</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">A/F</th>
                <th className="px-4 py-3">Código</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-amber-50/30">
              {filteredLogs.map((log) => (
                <tr 
                    key={log.id} 
                    onClick={() => handleSelectRow(log)}
                    className={`cursor-pointer hover:bg-amber-100 transition-colors ${selectedPontoId === log.id ? 'bg-blue-100 ring-1 ring-blue-300' : ''}`}
                >
                  <td className="px-4 py-2">
                    <button className="text-xs text-blue-600 underline">Selecionar</button>
                  </td>
                  <td className="px-4 py-2 truncate max-w-[200px]" title={log.local}>
                    {log.setorId && filterHospital ? (getAvailableSetoresForFilter().find(s => s.id === log.setorId)?.nome || log.local) : log.local}
                  </td>
                  <td className="px-4 py-2 font-medium text-gray-900">{log.cooperadoNome}</td>
                  <td className="px-4 py-2">{new Date(log.timestamp).toLocaleDateString()}</td>
                  <td className="px-4 py-2">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                  <td className="px-4 py-2">
                    <span className={`font-bold ${log.tipo === 'ENTRADA' ? 'text-gray-800' : 'text-gray-800'}`}>
                        {log.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 text-xs rounded text-white font-bold ${log.status === 'Aberto' ? 'bg-red-500' : 'bg-green-600'}`}>
                        {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{log.codigo}</td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400">
                        Nenhum registro encontrado com os filtros atuais.
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
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2 rounded text-sm flex items-center">
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
                            setFormCooperadoId(''); // Reset ID when typing to force valid selection
                            setShowCooperadoSuggestions(true);
                        }}
                        onFocus={() => setShowCooperadoSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowCooperadoSuggestions(false), 200)} // Delay to allow click
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
                    disabled={!filterHospital}
                >
                    <option value="">Selecione...</option>
                    {getAvailableSetoresForForm().map(s => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                </select>
            </div>

            <div className="space-y-1">
               {/* Spacer */}
            </div>
            <div className="space-y-1">
               {/* Spacer */}
            </div>

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
                <label className="text-sm font-bold text-gray-700">Hora Inicial</label>
                <input 
                    type="time" 
                    className="w-full bg-white text-gray-900 border border-gray-300 rounded p-2 outline-none"
                    value={formHora}
                    onChange={e => setFormHora(e.target.value)}
                />
            </div>

            <div className="space-y-1">
                <label className="text-sm font-bold text-gray-700 block mb-2">Tipo</label>
                <div className="flex items-center space-x-6">
                    <label className="flex items-center cursor-pointer">
                        <input 
                            type="radio" 
                            name="tipoPonto" 
                            className="w-4 h-4 text-primary-600"
                            checked={formTipo === TipoPonto.ENTRADA}
                            onChange={() => setFormTipo(TipoPonto.ENTRADA)}
                        />
                        <span className="ml-2 text-gray-900 font-medium">Entrada</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                        <input 
                            type="radio" 
                            name="tipoPonto" 
                            className="w-4 h-4 text-primary-600"
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
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded shadow transition-colors"
            >
                Salvar Plantão
            </button>
            
            <button 
                onClick={handleNovoPlantao}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded shadow transition-colors"
            >
                Novo Plantão
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
                Excluir Plantão
            </button>
        </div>
      </div>
    </div>
  );
};
