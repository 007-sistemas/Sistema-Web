
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { RegistroPonto, Hospital, TipoPonto, Justificativa } from '../types';
import { Calendar, Building2, Filter, FileClock, Clock, AlertTriangle, X, CheckCircle, AlertCircle } from 'lucide-react';
import { apiGet } from '../services/api';

// Interface auxiliar para exibição (Mesma do Relatório)
interface ShiftRow {
  id: string; 
  local: string;
  setorNome: string;
  data: string;
  entry?: RegistroPonto;
  exit?: RegistroPonto;
  status: string;
}

export const EspelhoBiometria: React.FC = () => {
  const [logs, setLogs] = useState<RegistroPonto[]>([]);
  const [hospitais, setHospitais] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  
  // Filters
  const [filterHospital, setFilterHospital] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Modal Justificativa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [justificationTarget, setJustificationTarget] = useState<{entryId: string, type: 'SAIDA' | 'ENTRADA'} | null>(null);
  const [justificationTime, setJustificationTime] = useState('');
  const [justificationReason, setJustificationReason] = useState('Esquecimento');
  const [justificationDesc, setJustificationDesc] = useState('');

  // Derived states
  const cooperadoId = session?.type === 'COOPERADO' ? session?.user?.id : null;
  const cooperadoData = session?.type === 'COOPERADO' ? session?.user : null;

  useEffect(() => {
    // Recarregar session ao montar o componente
    const currentSession = StorageService.getSession();
    setSession(currentSession);
    
    // Set default date range (Current Month)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    setDateStart(firstDay);
    setDateEnd(lastDay);

    if (currentSession?.type === 'COOPERADO') {
      loadData();
    }
  }, []);

  const loadData = async () => {
    if (!cooperadoId || !session) {
      console.warn('[EspelhoBiometria] Sem session ou cooperadoId, abortando loadData');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Buscar pontos do NEON
      const pontos = await apiGet<any[]>(`pontos?cooperadoId=${cooperadoId}`);
      
      if (!Array.isArray(pontos)) {
        throw new Error('Resposta inválida da API');
      }
      
      // Filtrar pontos rejeitados e ordenar
      const filtered = pontos.filter(p => p.status !== 'Rejeitado');
      const sorted = filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(sorted);

      // Identificar hospitais onde o usuário tem registros
      const uniqueHospitalIds = [...new Set(sorted.map(p => p.hospitalId).filter(Boolean))];
      const allHospitais = StorageService.getHospitais();
      const myHospitais = allHospitais.filter(h => uniqueHospitalIds.includes(h.id));
      
      setHospitais(myHospitais);
    } catch (err) {
      console.error('[EspelhoBiometria] Erro ao carregar pontos do NEON:', err);
      // Fallback para localStorage se a API falhar
      console.warn('[EspelhoBiometria] Usando fallback para localStorage');
      const allPontos = StorageService.getPontos().filter(p => p.cooperadoId === cooperadoId && p.status !== 'Rejeitado');
      const sorted = allPontos.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(sorted);

      const uniqueHospitalIds = [...new Set(sorted.map(p => p.hospitalId).filter(Boolean))];
      const allHospitais = StorageService.getHospitais();
      const myHospitais = allHospitais.filter(h => uniqueHospitalIds.includes(h.id));
      setHospitais(myHospitais);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredLogs = () => {
    return logs.filter(log => {
      // Filter by Hospital
      if (filterHospital && log.hospitalId !== filterHospital) return false;

      // Filter by Date Range
      if (dateStart || dateEnd) {
        const logDate = new Date(log.timestamp).toISOString().split('T')[0];
        if (dateStart && logDate < dateStart) return false;
        if (dateEnd && logDate > dateEnd) return false;
      }

      return true;
    });
  };

  // --- PAIRING LOGIC (Shift View) ---
  const getShiftRows = (): ShiftRow[] => {
    const filtered = getFilteredLogs();
    const shifts: ShiftRow[] = [];
    const processedExits = new Set<string>();

    // 1. Process Entries
    filtered.forEach(log => {
      if (log.tipo === TipoPonto.ENTRADA) {
        // Try to find matching exit (can be Closed or Pending)
        const matchingExit = filtered.find(l => l.tipo === TipoPonto.SAIDA && l.relatedId === log.id);
        
        if (matchingExit) {
          processedExits.add(matchingExit.id);
        }

        // Extract clean sector name
        const parts = log.local.split(' - ');
        const setorNome = parts.length > 1 ? parts[1] : parts[0];

        let statusDisplay = 'Em Aberto';
        if (matchingExit) {
            if (matchingExit.status === 'Pendente') statusDisplay = 'Aguardando Autorização';
            else if (matchingExit.status === 'Fechado') statusDisplay = 'Fechado';
        }

        shifts.push({
          id: log.id,
          local: log.local,
          setorNome: setorNome,
          data: new Date(log.timestamp).toLocaleDateString('pt-BR'),
          entry: log,
          exit: matchingExit,
          status: statusDisplay
        });
      }
    });

    // 2. Process Orphan Exits
    filtered.forEach(log => {
      if (log.tipo === TipoPonto.SAIDA && !processedExits.has(log.id)) {
        // Extract clean sector name
        const parts = log.local.split(' - ');
        const setorNome = parts.length > 1 ? parts[1] : parts[0];

        let statusDisplay = 'Fechado (S/E)';
        if (log.status === 'Pendente') statusDisplay = 'Aguardando Autorização';

        shifts.push({
          id: log.id,
          local: log.local,
          setorNome: setorNome,
          data: new Date(log.timestamp).toLocaleDateString('pt-BR'),
          entry: undefined,
          exit: log,
          status: statusDisplay
        });
      }
    });

    // Sort by Date/Time descending
    return shifts.sort((a, b) => {
      const timeA = a.entry ? new Date(a.entry.timestamp).getTime() : new Date(a.exit!.timestamp).getTime();
      const timeB = b.entry ? new Date(b.entry.timestamp).getTime() : new Date(b.exit!.timestamp).getTime();
      return timeB - timeA;
    });
  };

  const shiftRows = getShiftRows();

  const handleOpenJustification = (entryId: string, type: 'SAIDA' | 'ENTRADA') => {
    setJustificationTarget({ entryId, type });
    setJustificationTime('');
    setJustificationReason('Esquecimento');
    setJustificationDesc('');
    setIsModalOpen(true);
  };

  const submitJustification = () => {
    if (!justificationTarget || !justificationTime) return;
    if (!cooperadoData) return;

    // Find the original Entry
    const entry = logs.find(l => l.id === justificationTarget.entryId);
    if (!entry) return;

    // Construct timestamp based on Entry Date + Justification Time
    const entryDate = new Date(entry.timestamp).toISOString().split('T')[0];
    const newTimestamp = new Date(`${entryDate}T${justificationTime}:00`).toISOString();

    // Criar justificativa na tabela separada
    const novaJustificativa: Justificativa = {
        id: crypto.randomUUID(),
        cooperadoId: cooperadoData.id,
        cooperadoNome: cooperadoData.nome,
        pontoId: undefined, // Será criado após aprovação
        motivo: justificationReason,
        descricao: justificationDesc,
        dataSolicitacao: new Date().toISOString(),
        status: 'Pendente',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    StorageService.saveJustificativa(novaJustificativa);

    // Criar ponto vinculado à justificativa
    const novoPonto: RegistroPonto = {
        id: crypto.randomUUID(),
        codigo: entry.codigo,
        cooperadoId: cooperadoData.id,
        cooperadoNome: cooperadoData.nome,
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

  if (!cooperadoId || !session || session.type !== 'COOPERADO') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <FileClock className="h-12 w-12 mb-2 opacity-50" />
        <p>Acesso restrito a cooperados.</p>
        <p className="text-xs mt-2">Faça login como cooperado para acessar seu espelho de biometria.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <div className="animate-spin">
          <Clock className="h-8 w-8" />
        </div>
        <p className="mt-4">Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileClock className="h-7 w-7 text-primary-600" />
            Espelho da Biometria
          </h2>
          <p className="text-gray-500">Consulte seu histórico de produção e registros de ponto</p>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 mb-4 text-primary-700 font-semibold border-b border-gray-100 pb-2">
            <Filter className="h-5 w-5" />
            <h3>Filtros de Consulta</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Hospital de Atuação
                </label>
                <select 
                    className="w-full bg-gray-50 text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    value={filterHospital}
                    onChange={e => setFilterHospital(e.target.value)}
                >
                    <option value="">Todos os Locais</option>
                    {hospitais.map(h => (
                        <option key={h.id} value={h.id}>{h.nome}</option>
                    ))}
                </select>
                {hospitais.length === 0 && (
                    <p className="text-[10px] text-gray-400 mt-1 italic">Nenhum histórico encontrado para gerar lista de locais.</p>
                )}
            </div>

            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Período Início
                </label>
                <input 
                    type="date" 
                    className="w-full bg-gray-50 text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                    value={dateStart}
                    onChange={e => setDateStart(e.target.value)}
                />
            </div>

            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Período Fim
                </label>
                <input 
                    type="date" 
                    className="w-full bg-gray-50 text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                    value={dateEnd}
                    onChange={e => setDateEnd(e.target.value)}
                />
            </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-primary-600 text-white font-bold sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Setor / Local</th>
                <th className="px-6 py-4 text-center">Entrada</th>
                <th className="px-6 py-4 text-center">Saída</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shiftRows.map((row) => (
                <tr key={row.id} className="hover:bg-primary-50 transition-colors">
                  <td className="px-6 py-4 font-mono font-medium text-gray-900">
                    {row.data}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                        <span className="font-medium text-gray-800">{row.setorNome}</span>
                        {!filterHospital && (
                           <span className="text-[10px] text-gray-500">{row.local.split(' - ')[0]}</span>
                        )}
                    </div>
                  </td>
                  
                  {/* Coluna Entrada */}
                  <td className="px-6 py-4 text-center font-mono font-bold bg-green-50/50">
                    {row.entry ? (
                        <span className={row.entry.status === 'Pendente' ? 'text-amber-600 flex items-center justify-center gap-1' : 'text-green-700'}>
                            {row.entry.status === 'Pendente' && <Clock className="h-3 w-3" />}
                            {new Date(row.entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                    ) : '--:--'}
                  </td>

                  {/* Coluna Saída */}
                  <td className="px-6 py-4 text-center font-mono font-bold bg-red-50/50">
                    {row.exit ? (
                        <span className={row.exit.status === 'Pendente' ? 'text-amber-600 flex items-center justify-center gap-1' : 'text-red-700'}>
                            {row.exit.status === 'Pendente' && <Clock className="h-3 w-3" />}
                            {new Date(row.exit.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                    ) : (
                        row.entry && row.entry.status !== 'Pendente' ? (
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

                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                        row.status.includes('Aguardando') ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                        row.status.includes('Aberto') ? 'bg-amber-500 text-white' : 'bg-green-600 text-white'
                    }`}>
                        {row.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-gray-400">
                    {(row.entry?.isManual || row.exit?.isManual) ? 'Manual / Ajuste' : 'Biometria'}
                  </td>
                </tr>
              ))}
              {shiftRows.length === 0 && (
                <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400 bg-gray-50">
                        <div className="flex flex-col items-center">
                            <Clock className="h-8 w-8 mb-2 opacity-30" />
                            <span>Nenhum registro encontrado para o período selecionado.</span>
                        </div>
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Justificativa */}
      {isModalOpen && (
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
