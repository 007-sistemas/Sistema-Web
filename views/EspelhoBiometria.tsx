
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { RegistroPonto, Hospital, TipoPonto } from '../types';
import { Calendar, Building2, Filter, FileClock, Clock } from 'lucide-react';

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
  
  // User Session
  const session = StorageService.getSession();
  const cooperadoId = session?.type === 'COOPERADO' ? session.user.id : null;

  // Filters
  const [filterHospital, setFilterHospital] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  useEffect(() => {
    // Set default date range (Current Month)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    setDateStart(firstDay);
    setDateEnd(lastDay);

    loadData();
  }, []);

  const loadData = () => {
    if (!cooperadoId) return;

    // 1. Get all points for this Cooperado
    const allPontos = StorageService.getPontos().filter(p => p.cooperadoId === cooperadoId);
    
    // Sort descending (newest first) for initial state, though pairing logic handles sorting
    const sorted = allPontos.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setLogs(sorted);

    // 2. Identify Hospitals where the user has records to populate the dropdown
    const uniqueHospitalIds = [...new Set(sorted.map(p => p.hospitalId).filter(Boolean))];
    const allHospitais = StorageService.getHospitais();
    const myHospitais = allHospitais.filter(h => uniqueHospitalIds.includes(h.id));
    
    setHospitais(myHospitais);
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
        // Try to find matching exit in the filtered logs
        const matchingExit = filtered.find(l => l.tipo === TipoPonto.SAIDA && l.relatedId === log.id);
        
        if (matchingExit) {
          processedExits.add(matchingExit.id);
        }

        // Extract clean sector name
        const parts = log.local.split(' - ');
        const setorNome = parts.length > 1 ? parts[1] : parts[0];

        shifts.push({
          id: log.id,
          local: log.local,
          setorNome: setorNome,
          data: new Date(log.timestamp).toLocaleDateString('pt-BR'),
          entry: log,
          exit: matchingExit,
          status: matchingExit ? 'Fechado' : 'Em Aberto'
        });
      }
    });

    // 2. Process Orphan Exits
    filtered.forEach(log => {
      if (log.tipo === TipoPonto.SAIDA && !processedExits.has(log.id)) {
        // Extract clean sector name
        const parts = log.local.split(' - ');
        const setorNome = parts.length > 1 ? parts[1] : parts[0];

        shifts.push({
          id: log.id,
          local: log.local,
          setorNome: setorNome,
          data: new Date(log.timestamp).toLocaleDateString('pt-BR'),
          entry: undefined,
          exit: log,
          status: 'Fechado (S/E)'
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

  if (!cooperadoId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <FileClock className="h-12 w-12 mb-2 opacity-50" />
        <p>Acesso restrito a cooperados.</p>
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
            {/* Dynamic Hospital Dropdown */}
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

            {/* Date Range - Start */}
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

            {/* Date Range - End */}
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
                        {/* Optional: Show full hospital name if not filtering by hospital */}
                        {!filterHospital && (
                           <span className="text-[10px] text-gray-500">{row.local.split(' - ')[0]}</span>
                        )}
                    </div>
                  </td>
                  
                  {/* Coluna Entrada */}
                  <td className="px-6 py-4 text-center font-mono font-bold text-green-700 bg-green-50/50">
                    {row.entry ? new Date(row.entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                  </td>

                  {/* Coluna Saída */}
                  <td className="px-6 py-4 text-center font-mono font-bold text-red-700 bg-red-50/50">
                    {row.exit ? new Date(row.exit.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                  </td>

                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                        row.status.includes('Aberto') ? 'bg-amber-500 text-white' : 'bg-green-600 text-white'
                    }`}>
                        {row.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-gray-400">
                    {(row.entry?.isManual || row.exit?.isManual) ? 'Manual (Ajuste)' : 'Biometria'}
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
    </div>
  );
};
