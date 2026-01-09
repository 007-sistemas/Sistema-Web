
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Justificativa, Setor } from '../types';
import { apiGet } from '../services/api';
import { CheckCircle, XCircle, AlertCircle, Calendar, Clock, MapPin, User, CheckSquare, Search, Filter, X } from 'lucide-react';

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
      // Tenta buscar do Neon
      const remote = await apiGet<Justificativa[]>('justificativas');
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

  // Helper para buscar ponto relacionado e extrair informações
  const getPontoInfo = (justificativa: Justificativa) => {
    if (!justificativa.pontoId) return null;
    
    const pontos = StorageService.getPontos();
    const ponto = pontos.find(p => p.id === justificativa.pontoId);
    
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

  const handleApprove = (justificativa: Justificativa) => {
    if (!confirm('Confirmar autorização desta justificativa?')) return;

    try {
        const session = StorageService.getSession();
        const aprovador = session?.user?.username || session?.user?.nome || 'Gestor';
        
        console.log('[AutorizacaoPonto] Aprovando justificativa:', justificativa.id, 'por', aprovador);
        
        StorageService.aprovarJustificativa(justificativa.id, aprovador);

        // IMPORTANTE: Atualizar TODOS os pontos relacionados (entrada E saída)
        if (justificativa.pontoId) {
          const pontos = StorageService.getPontos();
          const ponto = pontos.find(p => p.id === justificativa.pontoId);
          
          console.log('[AutorizacaoPonto] Ponto encontrado:', ponto);
            
          if (ponto) {
            // Atualizar o ponto principal
            const updatedPonto = { ...ponto, status: 'Fechado' as const, validadoPor: aprovador };
            console.log('[AutorizacaoPonto] Atualizando ponto principal:', updatedPonto.id, updatedPonto);
            StorageService.updatePonto(updatedPonto);
            
            // Se tem relatedId, atualizar o ponto relacionado também
            if (ponto.relatedId) {
              const pontoRelacionado = pontos.find(p => p.id === ponto.relatedId);
              if (pontoRelacionado) {
                const updatedRelacionado = { ...pontoRelacionado, status: 'Fechado' as const, validadoPor: aprovador };
                console.log('[AutorizacaoPonto] Atualizando ponto relacionado:', updatedRelacionado.id, updatedRelacionado);
                StorageService.updatePonto(updatedRelacionado);
              }
            }
            
            // Procurar se há algum ponto que aponta para este como relatedId
            const pontosPareados = pontos.filter(p => p.relatedId === ponto.id);
            pontosPareados.forEach(p => {
              const updatedPareado = { ...p, status: 'Fechado' as const, validadoPor: aprovador };
              console.log('[AutorizacaoPonto] Atualizando ponto pareado:', updatedPareado.id, updatedPareado);
              StorageService.updatePonto(updatedPareado);
            });
          }
        }

        alert('Justificativa aprovada com sucesso!');
        loadData();
    } catch (error) {
        console.error("Erro ao aprovar:", error);
        alert("Erro ao processar aprovação.");
    }
  };

  const handleReject = (justificativa: Justificativa) => {
    const reason = prompt("Motivo da rejeição:");
    if (reason === null) return; // Cancelled by user
    if (!reason.trim()) {
        alert("Por favor, informe o motivo da rejeição.");
        return;
    }

    try {
        const session = StorageService.getSession();
        const rejeitador = session?.user?.username || session?.user?.nome || 'Gestor';
        
        console.log('[AutorizacaoPonto] Rejeitando justificativa:', justificativa.id, 'por', rejeitador, 'motivo:', reason);
        
        StorageService.rejeitarJustificativa(justificativa.id, rejeitador, reason);

        // IMPORTANTE: Atualizar TODOS os pontos relacionados (entrada E saída)
        if (justificativa.pontoId) {
          const pontos = StorageService.getPontos();
          const ponto = pontos.find(p => p.id === justificativa.pontoId);
          
          console.log('[AutorizacaoPonto] Ponto encontrado:', ponto);
            
          if (ponto) {
            // Atualizar o ponto principal
            const updatedPonto = { 
              ...ponto, 
              status: 'Rejeitado' as const,
              rejeitadoPor: rejeitador,
              motivoRejeicao: reason
            };
            console.log('[AutorizacaoPonto] Atualizando ponto principal:', updatedPonto.id, updatedPonto);
            StorageService.updatePonto(updatedPonto);
            
            // Se tem relatedId, atualizar o ponto relacionado também
            if (ponto.relatedId) {
              const pontoRelacionado = pontos.find(p => p.id === ponto.relatedId);
              if (pontoRelacionado) {
                const updatedRelacionado = { 
                  ...pontoRelacionado, 
                  status: 'Rejeitado' as const,
                  rejeitadoPor: rejeitador,
                  motivoRejeicao: reason
                };
                console.log('[AutorizacaoPonto] Atualizando ponto relacionado:', updatedRelacionado.id, updatedRelacionado);
                StorageService.updatePonto(updatedRelacionado);
              }
            }
            
            // Procurar se há algum ponto que aponta para este como relatedId
            const pontosPareados = pontos.filter(p => p.relatedId === ponto.id);
            pontosPareados.forEach(p => {
              const updatedPareado = { 
                ...p, 
                status: 'Rejeitado' as const,
                rejeitadoPor: rejeitador,
                motivoRejeicao: reason
              };
              console.log('[AutorizacaoPonto] Atualizando ponto pareado:', updatedPareado.id, updatedPareado);
              StorageService.updatePonto(updatedPareado);
            });
          }
        }
        
        alert('Justificativa rejeitada.');
        loadData();
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
              <div className="flex items-center gap-2 mb-3 font-semibold text-gray-700">
                <Filter className="h-4 w-4" />
                Filtros
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
                    <th className="px-4 py-3">Motivo</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Autorizado Por</th>
                    <th className="px-4 py-3">Data Decisão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {getFilteredHistorico().map((just) => {
                    const ponto = just.pontoId ? StorageService.getPontos().find(p => p.id === just.pontoId) : null;
                    const hospital = ponto ? hospitais.find(h => h.id === ponto.hospitalId) : null;
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
                          {just.status === 'Aprovada' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                              ✓ Aprovada
                            </span>
                          ) : just.status === 'Rejeitada' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                              ✕ Rejeitada
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              ⏳ Pendente
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {just.status === 'Aprovada' ? just.aprovadoPor : just.rejeitadoPor ? just.rejeitadoPor : '-'}
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
