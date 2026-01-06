
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Justificativa } from '../types';
import { CheckCircle, XCircle, AlertCircle, Calendar, Clock, MapPin, User, CheckSquare } from 'lucide-react';

export const AutorizacaoPonto: React.FC = () => {
  const [pendingJustificativas, setPendingJustificativas] = useState<Justificativa[]>([]);
  const [processedJustificativas, setProcessedJustificativas] = useState<Justificativa[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const all = StorageService.getJustificativas();
    const pending = all.filter(j => j.status === 'Pendente');
    const processed = all.filter(j => j.status === 'Aprovada' || j.status === 'Rejeitada');

    // Sort oldest first (FIFO) for pending
    setPendingJustificativas(pending.sort((a, b) => 
      new Date(a.dataSolicitacao).getTime() - new Date(b.dataSolicitacao).getTime()
    ));

    // Sort newest first for processed
    setProcessedJustificativas(processed.sort((a, b) => 
      new Date(b.dataAprovacao || b.dataSolicitacao).getTime() - new Date(a.dataAprovacao || a.dataSolicitacao).getTime()
    ));
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
        
        StorageService.aprovarJustificativa(justificativa.id, aprovador);

        // Se a justificativa referencia um ponto específico, atualizar o status do ponto também
        if (justificativa.pontoId) {
          const pontos = StorageService.getPontos();
          const ponto = pontos.find(p => p.id === justificativa.pontoId);
            
          if (ponto && (ponto.status === 'Pendente' || ponto.status === 'Aguardando autorização')) {
            const updatedPonto = { ...ponto, status: 'Fechado' as const, validadoPor: aprovador };
            StorageService.updatePonto(updatedPonto);
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
        
        StorageService.rejeitarJustificativa(justificativa.id, rejeitador, reason);

        // Se a justificativa referencia um ponto, marcar como rejeitado
        if (justificativa.pontoId) {
          const pontos = StorageService.getPontos();
          const ponto = pontos.find(p => p.id === justificativa.pontoId);
            
          if (ponto && (ponto.status === 'Pendente' || ponto.status === 'Aguardando autorização')) {
            const updatedPonto = { 
              ...ponto, 
              status: 'Rejeitado' as const,
              rejeitadoPor: rejeitador,
              motivoRejeicao: reason
            };
            StorageService.updatePonto(updatedPonto);
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
      </div>

      {/* PROCESSED JUSTIFICATIVAS */}
      {processedJustificativas.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="font-bold text-gray-800">Histórico de Decisões</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">Data Solicitação</th>
                  <th className="px-6 py-4">Cooperado</th>
                  <th className="px-6 py-4">Motivo</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Decisão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {processedJustificativas.map((just) => (
                  <tr key={just.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-xs">
                        <span className="font-bold text-gray-800">
                          {new Date(just.dataSolicitacao).toLocaleDateString()}
                        </span>
                        <span className="text-gray-400">
                          {new Date(just.dataSolicitacao).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{just.cooperadoNome}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                        {just.motivo}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {just.status === 'Aprovada' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                          ✓ Aprovada
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                          ✕ Rejeitada
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <div className="flex flex-col gap-1">
                        <span className="text-gray-700 font-medium">
                          {just.status === 'Aprovada' ? '✓' : '✕'} {just.aprovadoPor}
                        </span>
                        <span className="text-gray-400">
                          {new Date(just.dataAprovacao || '').toLocaleDateString()}
                        </span>
                        {just.motivoRejeicao && (
                          <span className="text-red-600 font-medium mt-1 border-t border-red-200 pt-1">
                            Motivo: {just.motivoRejeicao}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
