import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { RegistroPonto, Cooperado, Hospital } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download, Search, Filter, Calendar } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [pontos, setPontos] = useState<RegistroPonto[]>([]);
  const [hospitais, setHospitais] = useState<Hospital[]>([]);
  const [filterCooperado, setFilterCooperado] = useState('');
  
  useEffect(() => {
    const loadData = async () => {
      try {
        await StorageService.refreshPontosFromRemote();
        await StorageService.refreshHospitaisFromRemote();
      } catch (error) {
        console.error('Erro ao sincronizar dados:', error);
      }
      setPontos(StorageService.getPontos().reverse());
      setHospitais(StorageService.getHospitais());
    };
    loadData();
  }, []);

  // Simple aggregation for chart (Points per day)
  const getChartData = () => {
    const data: {[key: string]: number} = {};
    pontos.forEach(p => {
      const date = new Date(p.timestamp).toLocaleDateString();
      data[date] = (data[date] || 0) + 1;
    });
    return Object.keys(data).map(date => ({ name: date, Registros: data[date] })).slice(0, 7);
  };

  const filteredPontos = pontos.filter(p => 
    p.cooperadoNome.toLowerCase().includes(filterCooperado.toLowerCase())
  );

  const handleExport = () => {
    alert("Exportando relatório para PDF/Excel... (Simulação)");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Dashboard de Produção</h2>
          <p className="text-gray-500">Visão geral da produtividade e plantões</p>
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center space-x-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 shadow-sm"
        >
          <Download className="h-4 w-4" />
          <span>Exportar Relatório</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
           <p className="text-sm font-medium text-gray-500">Registros Hoje</p>
           <h3 className="text-3xl font-bold text-primary-600 mt-2">
             {pontos.filter(p => new Date(p.timestamp).toDateString() === new Date().toDateString()).length}
           </h3>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
           <p className="text-sm font-medium text-gray-500">Cooperados Ativos</p>
           <h3 className="text-3xl font-bold text-blue-600 mt-2">
             {StorageService.getCooperados().length}
           </h3>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
           <p className="text-sm font-medium text-gray-500">Hospitais Cadastrados</p>
           <h3 className="text-3xl font-bold text-amber-500 mt-2">{hospitais.length}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Section - Now spans 3 columns on large screens or we keep layout but remove links */}
        <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-6">Volume de Plantões (7 Dias)</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getChartData()}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                    cursor={{fill: '#f3e8ff'}}
                  />
                  <Bar dataKey="Registros" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
        </div>

        {/* Table Section */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-fit">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <h3 className="font-semibold text-gray-800">Histórico de Registros</h3>
            <div className="relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
              <input 
                type="text"
                placeholder="Filtrar cooperado..."
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                value={filterCooperado}
                onChange={e => setFilterCooperado(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-white text-gray-700 font-medium sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-3">Data/Hora</th>
                  <th className="px-6 py-3">Cooperado</th>
                  <th className="px-6 py-3">Tipo</th>
                  <th className="px-6 py-3">Local/Setor</th>
                  <th className="px-6 py-3">Obs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPontos.length > 0 ? (
                  filteredPontos.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-mono text-gray-500">
                        {new Date(p.timestamp).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-3 font-medium text-gray-900">{p.cooperadoNome}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          p.tipo === 'ENTRADA' ? 'bg-green-100 text-green-700' :
                          p.tipo === 'SAIDA' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {p.tipo === 'ENTRADA' ? 'INÍCIO' : p.tipo === 'SAIDA' ? 'FIM' : p.tipo}
                        </span>
                      </td>
                      <td className="px-6 py-3 truncate max-w-[200px]" title={p.local}>{p.local}</td>
                      <td className="px-6 py-3 text-gray-400 italic text-xs truncate max-w-[150px]">
                        {p.observacao || '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-400">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};