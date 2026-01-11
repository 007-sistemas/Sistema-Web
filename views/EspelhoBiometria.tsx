
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { RegistroPonto, Hospital, TipoPonto, Justificativa, Setor } from '../types';
import { Calendar, Building2, Filter, FileClock, Clock, RefreshCw } from 'lucide-react';
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
  statusDetails?: string;
}

export const EspelhoBiometria: React.FC = () => {
  const [logs, setLogs] = useState<RegistroPonto[]>([]);
  const [hospitais, setHospitais] = useState<Hospital[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  
  // Filters
  const [filterHospital, setFilterHospital] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Removido: justificativa parcial de horário (entrada/saída)

  // Derived states
  const cooperadoId = session?.type === 'COOPERADO' ? session?.user?.id : null;
  const cooperadoData = session?.type === 'COOPERADO' ? session?.user : null;

  const matchesCooperado = (log: any, coopId?: string | null, sess?: any) => {
    const effectiveId = coopId || cooperadoId;
    const effectiveName = sess?.user?.nome || cooperadoData?.nome;
    if (!effectiveId && !effectiveName) return true;
    const sameId = effectiveId ? log.cooperadoId === effectiveId : false;
    const sameName = effectiveName && log.cooperadoNome && log.cooperadoNome.trim().toLowerCase() === effectiveName.trim().toLowerCase();
    return sameId || sameName;
  };


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
      const cooperadoIdFromSession = currentSession?.user?.id;
      loadData(cooperadoIdFromSession, currentSession);
    }
  }, []);

  // Auto-refresh a cada 5 segundos para pegar aprovações do gestor
  useEffect(() => {
    if (!cooperadoId || !session) return;
    
    const interval = setInterval(() => {
      console.log('[EspelhoBiometria] Auto-refresh dos pontos');
      loadData();
    }, 3000); // 3 segundos para atualização rápida
    
    return () => clearInterval(interval);
  }, [cooperadoId, session]);

  const loadData = async (coopId?: string, sess?: any) => {
    const effectiveCoopId = coopId || cooperadoId;
    const effectiveSession = sess || session;
    
    if (!effectiveCoopId || !effectiveSession) {
      console.warn('[EspelhoBiometria] Sem session ou cooperadoId, abortando loadData');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Mesma lógica do Controle de Produção: sincronizar storage e usar storage como fonte principal
      try {
        await StorageService.refreshHospitaisFromRemote();
        await StorageService.refreshCooperadosFromRemote();
        await StorageService.refreshPontosFromRemote();
      } catch (syncErr) {
        console.warn('[EspelhoBiometria] Falha ao sincronizar remoto, seguindo com dados locais:', syncErr);
      }

      const allPontos = StorageService.getPontos().filter(p => matchesCooperado(p, effectiveCoopId, effectiveSession));
      const existingIds = new Set(allPontos.map(p => p.id));

      // Unir justificativas sem ponto (ou com ponto ausente no storage) para exibir pendentes/recusadas
      let synthetic: RegistroPonto[] = [];
      try {
        const justs = await apiGet<Justificativa[]>('sync?action=list_justificativas');
        const filteredJust = justs.filter(j => matchesCooperado({ cooperadoId: j.cooperadoId, cooperadoNome: j.cooperadoNome }, effectiveCoopId, effectiveSession));
        const missingJust = filteredJust.filter(j => !j.pontoId || !existingIds.has(j.pontoId));
        synthetic = buildPontosFromJustificativas(missingJust, StorageService.getHospitais(), existingIds);
      } catch (e) {
        console.warn('[EspelhoBiometria] Falha ao buscar justificativas remotas, usando local:', e);
        const localJust = StorageService.getJustificativas().filter(j => matchesCooperado({ cooperadoId: j.cooperadoId, cooperadoNome: j.cooperadoNome }, effectiveCoopId, effectiveSession));
        const missingJust = localJust.filter(j => !j.pontoId || !existingIds.has(j.pontoId));
        synthetic = buildPontosFromJustificativas(missingJust, StorageService.getHospitais(), existingIds);
      }

      const merged = [...allPontos, ...synthetic];
      const sorted = merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(sorted);

      // Identificar hospitais onde o usuário tem registros
      const uniqueHospitalIds = [...new Set(sorted.map(p => p.hospitalId).filter(Boolean))];
      const allHospitais = StorageService.getHospitais();
      const myHospitais = allHospitais.filter(h => uniqueHospitalIds.includes(h.id));

      setHospitais(myHospitais);

      // Carregar setores de todos os hospitais
      await loadAllSetores(myHospitais);
    } catch (err) {
      console.error('[EspelhoBiometria] Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
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
      setSetores(unique);
    } catch (error) {
      console.error('[EspelhoBiometria] Erro ao carregar setores:', error);
    }
  };

  const getFilteredLogs = () => {
    return logs.filter(log => {
      // Modo cooperado: garantir que o registro pertence ao usuário logado (fallback por nome se faltar ID)
      if (cooperadoId && !matchesCooperado(log, cooperadoId, session)) return false;

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

    // Ordenar por timestamp ascendente (mais antigo primeiro) para pareamento correto
    const sortedFiltered = filtered.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const entradas = sortedFiltered.filter(r => r.tipo === TipoPonto.ENTRADA);
    const saidas = sortedFiltered.filter(r => r.tipo === TipoPonto.SAIDA);

    // Função auxiliar para construir nome do setor
    const getSetorNome = (log: RegistroPonto) => {
      const setorId = String(log.setorId);
      const setorName = log.setorId ? setores.find(s => String(s.id) === setorId)?.nome : '';
      const hospital = hospitais.find(h => h.id === log.hospitalId);
      const isFiltered = filterHospital && filterHospital !== '';
      return isFiltered
        ? (setorName || log.local || 'Não especificado')
        : `${hospital?.nome || log.local || 'Não especificado'}${setorName ? ' - ' + setorName : ''}`;
    };

    // 1. Parear cada ENTRADA com a próxima SAÍDA disponível
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

      let statusDisplay = 'Em Aberto';
      let statusDetails = '';
      
      if (saidaPareada) {
        if (saidaPareada.status === 'Fechado' && saidaPareada.validadoPor) {
          statusDisplay = 'Fechado';
          statusDetails = saidaPareada.validadoPor;
        } else if (saidaPareada.status === 'Rejeitado' && saidaPareada.rejeitadoPor) {
          statusDisplay = 'Recusado';
          statusDetails = `${saidaPareada.rejeitadoPor}${saidaPareada.motivoRejeicao ? ': ' + saidaPareada.motivoRejeicao : ''}`;
        } else if (saidaPareada.status === 'Pendente') {
          statusDisplay = 'Aguardando Autorização';
        } else {
          statusDisplay = saidaPareada.status || 'Fechado';
        }
      } else if (entrada.status === 'Fechado' && entrada.validadoPor) {
        statusDisplay = 'Fechado';
        statusDetails = entrada.validadoPor;
      } else if (entrada.status === 'Rejeitado' && entrada.rejeitadoPor) {
        statusDisplay = 'Recusado';
        statusDetails = `${entrada.rejeitadoPor}${entrada.motivoRejeicao ? ': ' + entrada.motivoRejeicao : ''}`;
      }

      shifts.push({
        id: entrada.id,
        local: entrada.local || 'Não especificado',
        setorNome: getSetorNome(entrada),
        data: new Date(entrada.timestamp).toLocaleDateString('pt-BR'),
        entry: entrada,
        exit: saidaPareada,
        status: statusDisplay,
        statusDetails
      });
    });

    // 2. Processar SAÍDAs órfãs (saídas sem entrada anterior)
    saidas.forEach(saida => {
      if (!processedExits.has(saida.id)) {
        let statusDisplay = 'Fechado (S/E)';
        let statusDetails = '';
        
        if (saida.status === 'Fechado' && saida.validadoPor) {
          statusDisplay = 'Fechado';
          statusDetails = saida.validadoPor;
        } else if (saida.status === 'Rejeitado' && saida.rejeitadoPor) {
          statusDisplay = 'Recusado';
          statusDetails = `${saida.rejeitadoPor}${saida.motivoRejeicao ? ': ' + saida.motivoRejeicao : ''}`;
        } else if (saida.status === 'Pendente') {
          statusDisplay = 'Aguardando Autorização';
        }

        shifts.push({
          id: saida.id,
          local: saida.local || 'Não especificado',
          setorNome: getSetorNome(saida),
          data: new Date(saida.timestamp).toLocaleDateString('pt-BR'),
          entry: undefined,
          exit: saida,
          status: statusDisplay,
          statusDetails
        });
      }
    });

    // Sort by Date/Time descending (mais recente primeiro)
    return shifts.sort((a, b) => {
      const timeA = a.entry ? new Date(a.entry.timestamp).getTime() : new Date(a.exit!.timestamp).getTime();
      const timeB = b.entry ? new Date(b.entry.timestamp).getTime() : new Date(b.exit!.timestamp).getTime();
      return timeB - timeA;
    });
  };

  const shiftRows = getShiftRows();

  const buildPontosFromJustificativas = (justs: Justificativa[], hospitaisList: Hospital[], existingIds?: Set<string>): RegistroPonto[] => {
    const hospMap = new Map(hospitaisList.map(h => [String(h.id), h.nome]));
    const resultados: RegistroPonto[] = [];

    justs.forEach(j => {
      if (!j.dataPlantao) return;

      if (j.pontoId && existingIds && existingIds.has(j.pontoId)) return;

      const hospNome = j.hospitalId ? hospMap.get(String(j.hospitalId)) || 'Hospital não informado' : 'Hospital não informado';
      const baseDate = j.dataPlantao;
      const entradaHora = j.entradaPlantao || '00:00';
      const saidaHora = j.saidaPlantao || entradaHora;

      const entradaTs = new Date(`${baseDate}T${entradaHora}:00`).toISOString();
      let saidaDate = baseDate;
      if (saidaHora < entradaHora) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + 1);
        saidaDate = d.toISOString().split('T')[0];
      }
      const saidaTs = new Date(`${saidaDate}T${saidaHora}:00`).toISOString();

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
        data: baseDate,
        entrada: j.entradaPlantao,
        saida: undefined,
        local: hospNome,
        hospitalId: j.hospitalId,
        setorId: j.setorId,
        observacao: j.descricao,
        relatedId: exitId,
        status,
        isManual: true,
        validadoPor: status === 'Fechado' ? j.validadoPor : undefined,
        rejeitadoPor: status === 'Rejeitado' ? j.rejeitadoPor : undefined,
        motivoRejeicao: j.motivoRejeicao,
        biometriaEntradaHash: undefined,
        biometriaSaidaHash: undefined
      };

      const pontoSaida: RegistroPonto = {
        id: exitId,
        codigo: `JUST-${j.id}`,
        cooperadoId: j.cooperadoId,
        cooperadoNome: j.cooperadoNome,
        timestamp: saidaTs,
        tipo: TipoPonto.SAIDA,
        data: saidaDate,
        entrada: undefined,
        saida: j.saidaPlantao,
        local: hospNome,
        hospitalId: j.hospitalId,
        setorId: j.setorId,
        observacao: j.descricao,
        relatedId: entryId,
        status,
        isManual: true,
        validadoPor: status === 'Fechado' ? j.validadoPor : undefined,
        rejeitadoPor: status === 'Rejeitado' ? j.rejeitadoPor : undefined,
        motivoRejeicao: j.motivoRejeicao,
        biometriaEntradaHash: undefined,
        biometriaSaidaHash: undefined
      };

      resultados.push(pontoEntrada, pontoSaida);
    });

    return resultados;
  };

  // Removido: handlers de justificativa parcial

  if (loading && !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

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
        
        <button
          onClick={() => loadData()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Atualizando...' : 'Atualizar Dados'}
        </button>
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
                      '--:--'
                    )}
                  </td>

                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                          row.status.includes('Aguardando') ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                          row.status.includes('Recusado') ? 'bg-red-100 text-red-700 border border-red-200' :
                          row.status.includes('Aberto') ? 'bg-amber-500 text-white' : 'bg-green-600 text-white'
                      }`}>
                          {row.status}
                      </span>
                      {row.statusDetails && (
                        <span className="text-xs text-gray-600 italic max-w-[150px]">{row.statusDetails}</span>
                      )}
                    </div>
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

        {/* Removido: modal de justificativa de horário */}
    </div>
  );
};
