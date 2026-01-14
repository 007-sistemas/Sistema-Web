
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Justificativa, Setor } from '../types';
import { apiGet, apiPost, syncToNeon } from '../services/api';
import { CheckCircle, XCircle, AlertCircle, Calendar, Clock, MapPin, User, CheckSquare, Search, Filter, X, FileText, FileSpreadsheet } from 'lucide-react';
import { exportJustificativasToExcel, exportJustificativasToPDF, ExportFilters, JustificativaStats } from '../services/reportExport';

export const AutorizacaoPonto: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pendentes' | 'historico'>('pendentes');
  const [pendingJustificativas, setPendingJustificativas] = useState<Justificativa[]>([]);
  const [allJustificativas, setAllJustificativas] = useState<Justificativa[]>([]);
  const [setoresDisponiveis, setSetoresDisponiveis] = useState<Setor[]>([]);
  const [hospitais, setHospitais] = useState<any[]>([]);
  
  // Filtros do histórico
  const [filterCooperado, setFilterCooperado] = useState('');
  const [filterHospital, setFilterHospital] = useState('');
  const [filterDataIni, setFilterDataIni] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Sincronizar justificativas do Neon antes de ler localStorage
      await StorageService.refreshJustificativasFromRemote();
      
      // Tenta buscar do Neon
      const remoteRaw = await apiGet<Justificativa[]>('sync?action=list_justificativas');
      // Normalizar status legados do banco
      const remote = remoteRaw.map(j => j.status === 'Aguardando autorização' ? { ...j, status: 'Pendente' as const } : j);
      const pendingRemote = remote.filter(j => j.status === 'Pendente');

      setPendingJustificativas(pendingRemote.sort((a, b) => 
        new Date(a.dataSolicitacao).getTime() - new Date(b.dataSolicitacao).getTime()
      ));

      setAllJustificativas(remote.sort((a, b) => 
        new Date(b.dataSolicitacao).getTime() - new Date(a.dataSolicitacao).getTime()
      ));
    } catch (err) {
      console.warn('[AutorizacaoPonto] Falha ao buscar justificativas no Neon, usando localStorage:', err);
      const all = StorageService.getJustificativas();
      const pending = all.filter(j => j.status === 'Pendente');

      setPendingJustificativas(pending.sort((a, b) => 
        new Date(a.dataSolicitacao).getTime() - new Date(b.dataSolicitacao).getTime()
      ));

      setAllJustificativas(all.sort((a, b) => 
        new Date(b.dataSolicitacao).getTime() - new Date(a.dataSolicitacao).getTime()
      ));
    }

    // Carregar hospitais
    const hospitaisList = StorageService.getHospitais();
    setHospitais(hospitaisList);

    // Carregar setores disponíveis
    const loadSetores = async () => {
      const allSetores: Setor[] = [];
      for (const hospital of hospitaisList) {
        try {
          const setores = await StorageService.getSetoresByHospital(hospital.id);
          allSetores.push(...setores);
        } catch (err) {
          console.warn(`Erro ao buscar setores para hospital ${hospital.id}:`, err);
        }
      }
      setSetoresDisponiveis(allSetores);
    };
    loadSetores();
  };

  // Filtrar justificativas do histórico
  const getFilteredHistorico = () => {
    return allJustificativas.filter(j => {
      // Filtro por cooperado (pesquisa partial)
      if (filterCooperado && !j.cooperadoNome.toLowerCase().includes(filterCooperado.toLowerCase())) {
        return false;
      }

      // Filtro por hospital
      if (filterHospital) {
        // Buscar hospital do ponto relacionado
        if (j.pontoId) {
          const ponto = StorageService.getPontos().find(p => p.id === j.pontoId);
          if (ponto && ponto.hospitalId !== filterHospital) {
            return false;
          }
        }
      }

      // Filtro por período
      if (filterDataIni) {
        const justData = new Date(j.dataSolicitacao).toISOString().split('T')[0];
        if (justData < filterDataIni) return false;
      }
      if (filterDataFim) {
        const justData = new Date(j.dataSolicitacao).toISOString().split('T')[0];
        if (justData > filterDataFim) return false;
      }

      return true;
    });
  };

  const clearFilters = () => {
    setFilterCooperado('');
    setFilterHospital('');
    setFilterDataIni('');
    setFilterDataFim('');
  };

  // Preparar linhas para exportação do histórico
  const buildHistoricoRows = () => {
    const setoresMap = new Map<string, string>();
    setoresDisponiveis.forEach(s => setoresMap.set(String(s.id), s.nome));
    const pontos = StorageService.getPontos();
    const hospitaisMap = new Map<string, string>();
    hospitais.forEach(h => hospitaisMap.set(String(h.id), h.nome));

    return getFilteredHistorico().map(j => {
      const ponto = j.pontoId ? pontos.find(p => p.id === j.pontoId) : null;
      const hospitalNome = ponto ? (hospitaisMap.get(String(ponto.hospitalId)) || '-') : '-';
      const pontoInfo = getPontoInfo(j);
      const statusLabel = j.status === 'Fechado' ? 'Aprovada' : j.status === 'Rejeitado' ? 'Recusada' : 'Pendente';
      return {
        dataSolicitacao: new Date(j.dataSolicitacao).toLocaleDateString('pt-BR'),
        cooperado: j.cooperadoNome,
        hospital: hospitalNome,
        setor: j.setorId ? (setoresMap.get(String(j.setorId)) || `ID: ${j.setorId}`) : '-',
        dataPlantao: pontoInfo?.data || '-',
        entrada: pontoInfo?.horarioEntrada || '--:--',
        saida: pontoInfo?.horarioSaida || '--:--',
        motivo: j.motivo,
        status: statusLabel,
        autorizadoPor: j.validadoPor || j.rejeitadoPor || '-',
        dataDecisao: j.dataAprovacao ? new Date(j.dataAprovacao).toLocaleDateString('pt-BR') : '-'
      };
    });
  };

  const buildFiltersLabel = (): ExportFilters => {
    const filters: ExportFilters = {};
    if (filterCooperado) filters.cooperado = filterCooperado;
    if (filterHospital) {
      const h = hospitais.find(h => String(h.id) === String(filterHospital));
      filters.hospital = h?.nome || filterHospital;
    }
    if (filterDataIni) filters.dataIni = filterDataIni;
    if (filterDataFim) filters.dataFim = filterDataFim;
    return filters;
  };

  const buildStats = (rows: ReturnType<typeof buildHistoricoRows>): JustificativaStats => {
    const total = rows.length;
    const aprovadas = rows.filter(r => r.status === 'Aprovada').length;
    const recusadas = rows.filter(r => r.status === 'Recusada').length;
    const pendentes = rows.filter(r => r.status === 'Pendente').length;
    return { total, aprovadas, recusadas, pendentes };
  };

  const handleExportHistoricoExcel = async () => {
    const rows = buildHistoricoRows();
    if (rows.length === 0) { alert('Nenhum dado para exportar'); return; }
    await exportJustificativasToExcel(rows, buildFiltersLabel(), buildStats(rows));
  };

  const handleExportHistoricoPDF = async () => {
    const rows = buildHistoricoRows();
    if (rows.length === 0) { alert('Nenhum dado para exportar'); return; }
    await exportJustificativasToPDF(rows, buildFiltersLabel(), buildStats(rows));
  };

  // Helper para buscar ponto relacionado e extrair informações
  const getPontoInfo = (justificativa: Justificativa) => {
    if (!justificativa.pontoId && !justificativa.dataPlantao) return null;
    
    // Se tem dataPlantao (informada manualmente), usar ela
    if (justificativa.dataPlantao) {
      // Não usar new Date() para evitar problema de timezone - formatar direto da string YYYY-MM-DD
      const [year, month, day] = justificativa.dataPlantao.split('-');
      const dataFormatada = `${day}/${month}/${year}`;
      return {
        data: dataFormatada,
        horarioEntrada: justificativa.entradaPlantao || null,
        horarioSaida: justificativa.saidaPlantao || null
      };
    }
    
    const pontos = StorageService.getPontos();
    const ponto = pontos.find(p => p.id === justificativa.pontoId);

    // Se não houver ponto no localStorage (navegador do gestor), tentar usar dados vindos do Neon
    if (!ponto && (justificativa.pontoTimestamp || justificativa.pontoDate)) {
      const dataBase = justificativa.pontoTimestamp || justificativa.pontoDate || justificativa.dataSolicitacao;
      const data = new Date(dataBase);
      const dataFormatada = data.toLocaleDateString();

      const horarioEntrada = justificativa.pontoEntrada || null;
      const horarioSaida = justificativa.pontoSaida || null;

      return {
        data: dataFormatada,
        horarioEntrada,
        horarioSaida
      };
    }
    
    if (!ponto) return null;
    
    const data = new Date(ponto.timestamp);
    const horaFormatada = data.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dataFormatada = data.toLocaleDateString();
    
    // Buscar se há um ponto pareado (entrada/saída)
    const pontoRelacionado = ponto.relatedId 
      ? pontos.find(p => p.id === ponto.relatedId)
      : null;
    
    let horarioEntrada = null;
    let horarioSaida = null;
    
    if (ponto.tipo === 'ENTRADA') {
      horarioEntrada = horaFormatada;
      if (pontoRelacionado && pontoRelacionado.tipo === 'SAIDA') {
        horarioSaida = new Date(pontoRelacionado.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    } else {
      horarioSaida = horaFormatada;
      if (pontoRelacionado && pontoRelacionado.tipo === 'ENTRADA') {
        horarioEntrada = new Date(pontoRelacionado.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    }
    
    return {
      data: dataFormatada,
      horarioEntrada,
      horarioSaida
    };
  };

  const handleApprove = async (justificativa: Justificativa) => {
    if (!confirm('Confirmar autorização desta justificativa?')) return;

    try {
        const session = StorageService.getSession();
        console.log('[AutorizacaoPonto] Sessão completa:', JSON.stringify(session, null, 2));
        
        // Tentar pegar o nome do gestor de várias formas
        const aprovador = session?.user?.username 
          || session?.user?.nome 
          || session?.user?.nomeCompleto 
          || session?.user?.id
          || 'Gestor';
        
        console.log('[AutorizacaoPonto] Aprovando justificativa:', justificativa.id, 'por', aprovador);
        
        // Atualizar justificativa localmente
        StorageService.aprovarJustificativa(justificativa.id, aprovador);

        // Atualizar no Neon - usar status 'Fechado' com validadoPor
        const updatedJustificativa = {
          ...justificativa,
          status: 'Fechado' as const,
          validadoPor: aprovador,
          dataAprovacao: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        // Sync Neon de forma tolerante (não bloquear em dev sem DATABASE_URL)
        await syncToNeon('sync_justificativa', updatedJustificativa);

        // NOVO FLUXO: Criar pontos (entrada e saída) somente na aprovação
        if (!justificativa.pontoId && justificativa.dataPlantao && justificativa.entradaPlantao && justificativa.saidaPlantao) {
          const hospId = justificativa.hospitalId || undefined;
          const hospital = hospId ? hospitais.find(h => String(h.id) === String(hospId)) : null;
          const localNome = hospital?.nome || 'Hospital não informado';

          // Helper para criar ISO timestamp preservando a data/hora local (não UTC)
          const createLocalISOTimestamp = (dateStr: string, timeStr: string): string => {
            const [year, month, day] = dateStr.split('-').map(Number);
            const [hour, minute] = timeStr.split(':').map(Number);
            const d = new Date(year, month - 1, day, hour, minute, 0);
            // Não fazer conversão - new Date() já cria no timezone local, toISOString() converte para UTC corretamente
            return d.toISOString();
          };

          // Calcular timestamps com lógica de noite
          const entradaTimestamp = createLocalISOTimestamp(justificativa.dataPlantao, justificativa.entradaPlantao);
          let saidaDate = justificativa.dataPlantao;
          if (justificativa.saidaPlantao < justificativa.entradaPlantao) {
            const d = new Date(justificativa.dataPlantao);
            d.setDate(d.getDate() + 1);
            saidaDate = d.toISOString().split('T')[0];
          }
          const saidaTimestamp = createLocalISOTimestamp(saidaDate, justificativa.saidaPlantao);

          const entryId = crypto.randomUUID();
          const exitId = crypto.randomUUID();
          const codigoBase = `MAN-${Date.now()}`;

          const pontoEntrada = {
            id: entryId,
            codigo: codigoBase,
            cooperadoId: justificativa.cooperadoId,
            cooperadoNome: justificativa.cooperadoNome,
            timestamp: entradaTimestamp,
            tipo: 'ENTRADA',
            local: localNome,
            hospitalId: hospId,
            setorId: justificativa.setorId,
            isManual: true,
            status: 'Fechado',
            validadoPor: aprovador
          };

          const pontoSaida = {
            id: exitId,
            codigo: codigoBase,
            cooperadoId: justificativa.cooperadoId,
            cooperadoNome: justificativa.cooperadoNome,
            timestamp: saidaTimestamp,
            tipo: 'SAIDA',
            local: localNome,
            hospitalId: hospId,
            setorId: justificativa.setorId,
            isManual: true,
            status: 'Fechado',
            validadoPor: aprovador,
            relatedId: entryId
          };

          StorageService.savePonto(pontoEntrada as any);
          StorageService.savePonto(pontoSaida as any);
          await syncToNeon('sync_ponto', pontoEntrada);
          await syncToNeon('sync_ponto', pontoSaida);

          // Vincular justificativa ao ponto de saída criado
          const justAtualizada = { ...updatedJustificativa, pontoId: exitId };
          await syncToNeon('sync_justificativa', justAtualizada);
        }

        console.log('[AutorizacaoPonto] ✅ Aprovação concluída com sucesso');
        
        // Disparar evento customizado para notificar outras abas/componentes
        const customEvent = new CustomEvent('biohealth:justificativa:updated', { 
          detail: { id: justificativa.id, status: 'Fechado', timestamp: Date.now() } 
        });
        window.dispatchEvent(customEvent);
        
        alert('Justificativa aprovada com sucesso!');
        // Recarregar dados frescos do banco
        await loadData();
    } catch (error) {
        console.error("Erro ao aprovar:", error);
        alert("Erro ao processar aprovação.");
    }
  };

  const handleReject = async (justificativa: Justificativa) => {
    const reason = prompt("Motivo da rejeição:");
    if (reason === null) return; // Cancelled by user
    if (!reason.trim()) {
        alert("Por favor, informe o motivo da rejeição.");
        return;
    }

    try {
        const session = StorageService.getSession();
        console.log('[AutorizacaoPonto] Sessão completa:', JSON.stringify(session, null, 2));
        
        const rejeitador = session?.user?.username 
          || session?.user?.nome 
          || session?.user?.nomeCompleto 
          || session?.user?.id
          || 'Gestor';
        
        console.log('[AutorizacaoPonto] Rejeitando justificativa:', justificativa.id, 'por', rejeitador, 'motivo:', reason);
        
        // Atualizar justificativa localmente
        StorageService.rejeitarJustificativa(justificativa.id, rejeitador, reason);

        // Atualizar no Neon - usar status 'Rejeitado' com rejeitadoPor
        const updatedJustificativa = {
          ...justificativa,
          status: 'Rejeitado' as const,
          rejeitadoPor: rejeitador,
          motivoRejeicao: reason,
          dataAprovacao: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        // Sync Neon de forma tolerante (não bloquear em dev sem DATABASE_URL)
        await syncToNeon('sync_justificativa', updatedJustificativa);

        // Novo fluxo: rejeição não cria/atualiza pontos; apenas a justificativa é marcada como Rejeitada

        console.log('[AutorizacaoPonto] ✅ Rejeição concluída com sucesso');
        
        // Disparar evento customizado para notificar outras abas/componentes
        const customEvent = new CustomEvent('biohealth:justificativa:updated', { 
          detail: { id: justificativa.id, status: 'Rejeitado', timestamp: Date.now() } 
        });
        window.dispatchEvent(customEvent);
        
        alert('Justificativa recusada com sucesso!');
        // Recarregar dados frescos do banco
        await loadData();
    } catch (error) {
        console.error("Erro ao rejeitar:", error);
        alert("Erro ao processar rejeição.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <div className="bg-amber-100 p-2 rounded-full">
            <CheckSquare className="h-8 w-8 text-amber-600" />
        </div>
        <div>
           <h2 className="text-2xl font-bold text-gray-800">Justificativa de Plantão</h2>
           <p className="text-gray-500">Gerencie as justificativas de horários enviadas pelos cooperados</p>
        </div>
      </div>

      {/* TABS */}
      <div className="bg-white rounded-t-xl border border-gray-200 border-b-0">
        <div className="flex gap-0">
          <button
            onClick={() => setActiveTab('pendentes')}
            className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
              activeTab === 'pendentes'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Pendentes {pendingJustificativas.length > 0 && `(${pendingJustificativas.length})`}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('historico')}
            className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
              activeTab === 'historico'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Histórico
            </div>
          </button>
        </div>
      </div>

      {/* TAB CONTENT */}
      <div className="bg-white rounded-b-xl shadow-sm border border-gray-200 border-t-0 overflow-hidden">
        {activeTab === 'pendentes' ? (
          // --- ABA PENDENTES ---
          <>
            {pendingJustificativas.length === 0 ? (
                <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                    <CheckCircle className="h-16 w-16 mb-4 text-green-100" />
                    <span className="text-lg font-medium text-gray-600">Tudo em dia!</span>
                    <span className="text-sm">Nenhuma solicitação pendente de autorização.</span>
                </div>
            ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3">Data Solicitação</th>
                        <th className="px-4 py-3">Cooperado</th>
                        <th className="px-4 py-3">Data do Plantão</th>
                        <th className="px-4 py-3">Entrada / Saída</th>
                        <th className="px-4 py-3">Setor</th>
                        <th className="px-4 py-3">Motivo</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pendingJustificativas.map((just) => {
                        const pontoInfo = getPontoInfo(just);
                        return (
                          <tr key={just.id} className="hover:bg-amber-50/30 transition-colors group">
                            <td className="px-4 py-3">
                              <div className="flex flex-col text-xs">
                                  <span className="font-bold text-gray-800">
                                      {new Date(just.dataSolicitacao).toLocaleDateString()}
                                  </span>
                                  <span className="text-gray-400">
                                      {new Date(just.dataSolicitacao).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                  </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-gray-400" />
                                  <span className="font-medium text-gray-900">{just.cooperadoNome}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {pontoInfo ? (
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {pontoInfo.data}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {pontoInfo ? (
                                <div className="flex flex-col text-xs">
                                  <span className="text-green-700 font-medium flex items-center gap-1">
                                    <span>📥</span> {pontoInfo.horarioEntrada || '--:--'}
                                  </span>
                                  <span className="text-red-700 font-medium flex items-center gap-1">
                                    <span>📤</span> {pontoInfo.horarioSaida || '--:--'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {just.setorId ? (
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  {setoresDisponiveis.find(s => String(s.id) === String(just.setorId))?.nome || `ID: ${just.setorId}`}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200 w-fit">
                                    {just.motivo}
                                </span>
                                {just.descricao && (
                                  <span className="text-xs text-gray-500 italic max-w-[250px] block truncate" title={just.descricao}>
                                    "{just.descricao}"
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                      onClick={() => handleReject(just)}
                                      className="p-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors shadow-sm"
                                      title="Rejeitar"
                                  >
                                      <XCircle className="h-5 w-5" />
                                  </button>
                                  <button 
                                      onClick={() => handleApprove(just)}
                                      className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm font-medium text-sm"
                                      title="Autorizar"
                                  >
                                      <CheckCircle className="h-4 w-4" />
                                      Autorizar
                                  </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
            )}
          </>
        ) : (
          // --- ABA HISTÓRICO ---
          <>
            {/* FILTROS */}
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3 font-semibold text-gray-700">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportHistoricoPDF}
                    className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs"
                    title="Exportar histórico em PDF"
                  >
                    <FileText className="h-4 w-4" />
                    Exportar PDF
                  </button>
                  <button
                    onClick={handleExportHistoricoExcel}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs"
                    title="Exportar histórico em Excel"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Exportar Excel
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Cooperado</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Buscar nome..."
                    value={filterCooperado}
                    onChange={e => setFilterCooperado(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Hospital</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    value={filterHospital}
                    onChange={e => setFilterHospital(e.target.value)}
                  >
                    <option value="">Todos os Hospitais</option>
                    {hospitais.map(h => (
                      <option key={h.id} value={h.id}>{h.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Data Inicial</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                    value={filterDataIni}
                    onChange={e => setFilterDataIni(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Data Final</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                    value={filterDataFim}
                    onChange={e => setFilterDataFim(e.target.value)}
                  />
                </div>
              </div>
              {(filterCooperado || filterHospital || filterDataIni || filterDataFim) && (
                <button
                  onClick={clearFilters}
                  className="mt-3 px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  Limpar Filtros
                </button>
              )}
            </div>

            {/* TABELA HISTÓRICO */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Data Solicitação</th>
                    <th className="px-4 py-3">Cooperado</th>
                    <th className="px-4 py-3">Hospital</th>
                    <th className="px-4 py-3">Setor</th>
                    <th className="px-4 py-3">Data do Plantão</th>
                    <th className="px-4 py-3">Entrada / Saída</th>
                    <th className="px-4 py-3">Motivo</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Decidido Por</th>
                    <th className="px-4 py-3">Data Decisão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {getFilteredHistorico().map((just) => {
                    const ponto = just.pontoId ? StorageService.getPontos().find(p => p.id === just.pontoId) : null;
                    const hospital = ponto ? hospitais.find(h => h.id === ponto.hospitalId) : null;
                    const pontoInfo = getPontoInfo(just);
                    return (
                      <tr key={just.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex flex-col text-xs">
                            <span className="font-bold text-gray-800">
                              {new Date(just.dataSolicitacao).toLocaleDateString()}
                            </span>
                            <span className="text-gray-400">
                              {new Date(just.dataSolicitacao).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium">{just.cooperadoNome}</td>
                        <td className="px-4 py-3 text-xs">{hospital?.nome || '-'}</td>
                        <td className="px-4 py-3">
                          {just.setorId ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                              <MapPin className="h-3 w-3 mr-1" />
                              {setoresDisponiveis.find(s => String(s.id) === String(just.setorId))?.nome || `ID: ${just.setorId}`}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {pontoInfo ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                              <Calendar className="h-3 w-3 mr-1" />
                              {pontoInfo.data}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {pontoInfo ? (
                            <div className="flex flex-col text-xs">
                              <span className="text-green-700 font-medium flex items-center gap-1">
                                <span>📥</span> {pontoInfo.horarioEntrada || '--:--'}
                              </span>
                              <span className="text-red-700 font-medium flex items-center gap-1">
                                <span>📤</span> {pontoInfo.horarioSaida || '--:--'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200 w-fit">
                              {just.motivo}
                            </span>
                            {just.descricao && (
                              <span className="text-xs text-gray-500 italic max-w-[200px] truncate" title={just.descricao}>
                                "{just.descricao}"
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {just.status === 'Fechado' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200 justify-center">
                              Aprovada
                            </span>
                          ) : just.status === 'Rejeitado' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200 justify-center">
                              Recusada
                            </span>
                          ) : just.status === 'Excluído' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-700 border border-gray-300 justify-center">
                              Excluído
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 justify-center">
                              Pendente
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-gray-900">{just.validadoPor || just.rejeitadoPor || '-'}</span>
                            {just.status === 'Rejeitado' && just.motivoRejeicao && (
                              <span className="text-gray-500 italic text-[10px] max-w-[120px] truncate" title={just.motivoRejeicao}>
                                ({just.motivoRejeicao})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {just.dataAprovacao ? new Date(just.dataAprovacao).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {getFilteredHistorico().length === 0 && (
                <div className="p-12 text-center text-gray-400">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Nenhuma justificativa encontrada com os filtros aplicados.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
