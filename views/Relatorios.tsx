import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { RegistroPonto, Cooperado, Hospital, Setor } from '../types';
import { apiGet } from '../services/api';
import { exportToExcel, exportToPDF, exportToExcelByCooperado, exportToPDFByCooperado } from '../services/reportExport';
import { FileText, Download, Filter, X, FileSpreadsheet, Calendar } from 'lucide-react';

interface RelatorioRow {
  cooperadoNome: string;
  especialidade: string;
  hospital: string;
  setor: string;
  data: string;
  entrada: string;
  saida: string;
  totalHoras: string;
  status: string;
}

export const Relatorios: React.FC = () => {
  const [logs, setLogs] = useState<RegistroPonto[]>([]);
  const [cooperados, setCooperados] = useState<Cooperado[]>([]);
  const [hospitais, setHospitais] = useState<Hospital[]>([]);
  const [setoresDisponiveis, setSetoresDisponiveis] = useState<Setor[]>([]);
  const [todosSetores, setTodosSetores] = useState<Setor[]>([]); // Todos os setores de todos os hospitais
  
  // Filtros
  const [filterHospital, setFilterHospital] = useState('');
  const [filterSetor, setFilterSetor] = useState('');
  const [filterCooperado, setFilterCooperado] = useState('');
  const [filterCooperadoInput, setFilterCooperadoInput] = useState('');
  const [showCooperadoSuggestions, setShowCooperadoSuggestions] = useState(false);
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterDataIni, setFilterDataIni] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');

  // Dados processados
  const [relatorioData, setRelatorioData] = useState<RelatorioRow[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  // Carregar todos os setores quando hospitais mudarem
  useEffect(() => {
    if (hospitais.length > 0) {
      loadAllSetores();
    }
  }, [hospitais]);

  // Carregar setores quando hospital for selecionado
  useEffect(() => {
    if (filterHospital) {
      loadSetores(filterHospital);
    } else {
      setSetoresDisponiveis([]);
    }
  }, [filterHospital]);

  // Reprocessar dados quando filtros mudarem
  useEffect(() => {
    processarRelatorio();
  }, [logs, cooperados, hospitais, setoresDisponiveis, todosSetores, filterHospital, filterSetor, filterCooperado, filterCategoria, filterDataIni, filterDataFim]);

  const loadData = async () => {
    try {
      // Buscar dados do Neon antes de carregar do localStorage
      await StorageService.refreshPontosFromRemote();
      await StorageService.refreshCooperadosFromRemote();
      await StorageService.refreshHospitaisFromRemote();
    } catch (error) {
      console.error('Erro ao sincronizar dados do Neon:', error);
    }
    
    // Agora carrega dados atualizados do localStorage
    const pontosData = StorageService.getPontos();
    const cooperadosData = StorageService.getCooperados();
    const hospitaisData = StorageService.getHospitais();
    
    setLogs(pontosData);
    setCooperados(cooperadosData);
    setHospitais(hospitaisData);
  };

  const loadSetores = async (hospitalId: string) => {
    try {
      const response = await apiGet<Setor[]>(`hospital-setores?hospitalId=${hospitalId}`);
      if (response && response.length > 0) {
        setSetoresDisponiveis(response);
      } else {
        // Fallback para setores padrão
        const defaultSetores: Setor[] = [
          { id: 1, nome: 'UTI' },
          { id: 2, nome: 'Pronto Atendimento' },
          { id: 3, nome: 'Centro Cirúrgico' },
          { id: 4, nome: 'Ambulatório' },
          { id: 5, nome: 'Maternidade' }
        ];
        setSetoresDisponiveis(defaultSetores);
      }
    } catch (error) {
      console.error('Erro ao carregar setores:', error);
      // Fallback para setores padrão
      const defaultSetores: Setor[] = [
        { id: 1, nome: 'UTI' },
        { id: 2, nome: 'Pronto Atendimento' },
        { id: 3, nome: 'Centro Cirúrgico' },
        { id: 4, nome: 'Ambulatório' },
        { id: 5, nome: 'Maternidade' }
      ];
      setSetoresDisponiveis(defaultSetores);
    }
  };

  const loadAllSetores = async () => {
    try {
      const setoresByHospital = await Promise.all(
        hospitais.map(async (hospital) => {
          try {
            const setores = await apiGet<Setor[]>(`hospital-setores?hospitalId=${hospital.id}`);
            return setores || [];
          } catch {
            return [];
          }
        })
      );

      const flattened = setoresByHospital.flat();
      const unique = flattened.filter((setor, index, self) => 
        index === self.findIndex(s => s.id === setor.id)
      );
      setTodosSetores(unique);
      console.log('[Relatorios] Setores carregados:', unique);
    } catch (error) {
      console.error('[Relatorios] Erro ao carregar todos os setores:', error);
      setTodosSetores([]);
    }
  };

  const processarRelatorio = () => {
    // Agrupar registros de entrada e saída
    const entradas = logs.filter(l => l.tipo === 'ENTRADA');
    const saidas = logs.filter(l => l.tipo === 'SAIDA');

    const rows: RelatorioRow[] = [];

    entradas.forEach(entrada => {
      // Encontrar saída correspondente pelo código
      const saida = saidas.find(s => s.codigo === entrada.codigo);
      
      const cooperado = cooperados.find(c => c.id === entrada.cooperadoId);
      const hospital = hospitais.find(h => h.id === entrada.hospitalId);
      // Buscar setor em todosSetores (não apenas setoresDisponiveis do filtro)
      const setor = todosSetores.find(s => s.id.toString() === entrada.setorId);

      if (!cooperado || !hospital) return;

      // Aplicar filtros
      if (filterHospital && entrada.hospitalId !== filterHospital) return;
      if (filterSetor && entrada.setorId !== filterSetor) return;
      if (filterCooperado && entrada.cooperadoId !== filterCooperado) return;
      if (filterCategoria && cooperado.especialidade !== filterCategoria) return;

      const dataEntrada = new Date(entrada.timestamp);
      if (filterDataIni && dataEntrada < new Date(filterDataIni)) return;
      if (filterDataFim && dataEntrada > new Date(filterDataFim + 'T23:59:59')) return;

      const entradaHora = new Date(entrada.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const saidaHora = saida ? new Date(saida.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
      
      let totalHoras = '--';
      if (saida) {
        const diffMs = new Date(saida.timestamp).getTime() - new Date(entrada.timestamp).getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        totalHoras = `${diffHours}h ${diffMinutes}m`;
      }

      const status = saida ? 'Fechado' : 'Em Aberto';

      rows.push({
        cooperadoNome: cooperado.nome,
        especialidade: cooperado.especialidade || 'N/A',
        hospital: hospital.nome,
        setor: setor?.nome || 'N/A',
        data: dataEntrada.toLocaleDateString('pt-BR'),
        entrada: entradaHora,
        saida: saidaHora,
        totalHoras,
        status
      });
    });

    // Ordenar por data (mais recente primeiro)
    rows.sort((a, b) => {
      const dateA = a.data.split('/').reverse().join('-');
      const dateB = b.data.split('/').reverse().join('-');
      return dateB.localeCompare(dateA);
    });

    setRelatorioData(rows);
  };

  const handleLimparFiltros = () => {
    setFilterHospital('');
    setFilterSetor('');
    setFilterCooperado('');
    setFilterCooperadoInput('');
    setFilterCategoria('');
    setFilterDataIni('');
    setFilterDataFim('');
  };

  const handleExportarPDF = async () => {
    if (relatorioData.length === 0) {
      alert('Não há dados para exportar');
      return;
    }

    // Preparar dados dos filtros com nomes legíveis
    const filterLabels: any = {};
    if (filterHospital) {
      const hospital = hospitais.find(h => h.id === filterHospital);
      filterLabels.hospital = hospital?.nome || filterHospital;
    }
    if (filterSetor) {
      const setor = todosSetores.find(s => s.id.toString() === filterSetor);
      filterLabels.setor = setor?.nome || filterSetor;
    }
    if (filterCooperado) {
      const cooperado = cooperados.find(c => c.id === filterCooperado);
      filterLabels.cooperado = cooperado?.nome || filterCooperado;
    }

    const stats = {
      totalRegistros: relatorioData.length,
      plantoesFechados: relatorioData.filter(r => r.status === 'Fechado').length,
      plantoesAbertos: relatorioData.filter(r => r.status === 'Em Aberto').length,
      totalHoras: relatorioData.reduce((acc, r) => {
        if (r.totalHoras === '--') return acc;
        const [hours, minutes] = r.totalHoras.replace('h', '').replace('m', '').split(' ').map(Number);
        return acc + hours + (minutes / 60);
      }, 0).toFixed(1) + 'h'
    };

    await exportToPDF(relatorioData, {
      hospital: filterLabels.hospital || undefined,
      setor: filterLabels.setor || undefined,
      cooperado: filterLabels.cooperado || undefined,
      categoria: filterCategoria || undefined,
      dataIni: filterDataIni || undefined,
      dataFim: filterDataFim || undefined
    }, stats);
  };

  const handleExportarExcel = async () => {
    if (relatorioData.length === 0) {
      alert('Não há dados para exportar');
      return;
    }

    // Preparar dados dos filtros com nomes legíveis
    const filterLabels: any = {};
    if (filterHospital) {
      const hospital = hospitais.find(h => h.id === filterHospital);
      filterLabels.hospital = hospital?.nome || filterHospital;
    }
    if (filterSetor) {
      const setor = todosSetores.find(s => s.id.toString() === filterSetor);
      filterLabels.setor = setor?.nome || filterSetor;
    }
    if (filterCooperado) {
      const cooperado = cooperados.find(c => c.id === filterCooperado);
      filterLabels.cooperado = cooperado?.nome || filterCooperado;
    }

    const stats = {
      totalRegistros: relatorioData.length,
      plantoesFechados: relatorioData.filter(r => r.status === 'Fechado').length,
      plantoesAbertos: relatorioData.filter(r => r.status === 'Em Aberto').length,
      totalHoras: relatorioData.reduce((acc, r) => {
        if (r.totalHoras === '--') return acc;
        const [hours, minutes] = r.totalHoras.replace('h', '').replace('m', '').split(' ').map(Number);
        return acc + hours + (minutes / 60);
      }, 0).toFixed(1) + 'h'
    };

    await exportToExcel(relatorioData, {
      hospital: filterLabels.hospital || undefined,
      setor: filterLabels.setor || undefined,
      cooperado: filterLabels.cooperado || undefined,
      categoria: filterCategoria || undefined,
      dataIni: filterDataIni || undefined,
      dataFim: filterDataFim || undefined
    }, stats);
  };

  const handleExportarExcelByCooperado = async () => {
    if (relatorioData.length === 0) {
      alert('Não há dados para exportar');
      return;
    }

    // Preparar dados dos filtros com nomes legíveis
    const filterLabels: any = {};
    if (filterHospital) {
      const hospital = hospitais.find(h => h.id === filterHospital);
      filterLabels.hospital = hospital?.nome || filterHospital;
    }
    if (filterSetor) {
      const setor = todosSetores.find(s => s.id.toString() === filterSetor);
      filterLabels.setor = setor?.nome || filterSetor;
    }
    if (filterCooperado) {
      const cooperado = cooperados.find(c => c.id === filterCooperado);
      filterLabels.cooperado = cooperado?.nome || filterCooperado;
    }

    const stats = {
      totalRegistros: relatorioData.length,
      plantoesFechados: relatorioData.filter(r => r.status === 'Fechado').length,
      plantoesAbertos: relatorioData.filter(r => r.status === 'Em Aberto').length,
      totalHoras: relatorioData.reduce((acc, r) => {
        if (r.totalHoras === '--') return acc;
        const [hours, minutes] = r.totalHoras.replace('h', '').replace('m', '').split(' ').map(Number);
        return acc + hours + (minutes / 60);
      }, 0).toFixed(1) + 'h'
    };

    await exportToExcelByCooperado(relatorioData, {
      hospital: filterLabels.hospital || undefined,
      setor: filterLabels.setor || undefined,
      cooperado: filterLabels.cooperado || undefined,
      categoria: filterCategoria || undefined,
      dataIni: filterDataIni || undefined,
      dataFim: filterDataFim || undefined
    }, stats);
  };

  const handleExportarPDFByCooperado = async () => {
    if (relatorioData.length === 0) {
      alert('Não há dados para exportar');
      return;
    }

    // Preparar dados dos filtros com nomes legíveis
    const filterLabels: any = {};
    if (filterHospital) {
      const hospital = hospitais.find(h => h.id === filterHospital);
      filterLabels.hospital = hospital?.nome || filterHospital;
    }
    if (filterSetor) {
      const setor = todosSetores.find(s => s.id.toString() === filterSetor);
      filterLabels.setor = setor?.nome || filterSetor;
    }
    if (filterCooperado) {
      const cooperado = cooperados.find(c => c.id === filterCooperado);
      filterLabels.cooperado = cooperado?.nome || filterCooperado;
    }

    const stats = {
      totalRegistros: relatorioData.length,
      plantoesFechados: relatorioData.filter(r => r.status === 'Fechado').length,
      plantoesAbertos: relatorioData.filter(r => r.status === 'Em Aberto').length,
      totalHoras: relatorioData.reduce((acc, r) => {
        if (r.totalHoras === '--') return acc;
        const [hours, minutes] = r.totalHoras.replace('h', '').replace('m', '').split(' ').map(Number);
        return acc + hours + (minutes / 60);
      }, 0).toFixed(1) + 'h'
    };

    await exportToPDFByCooperado(relatorioData, {
      hospital: filterLabels.hospital || undefined,
      setor: filterLabels.setor || undefined,
      cooperado: filterLabels.cooperado || undefined,
      categoria: filterCategoria || undefined,
      dataIni: filterDataIni || undefined,
      dataFim: filterDataFim || undefined
    }, stats);
  };

  const filteredCooperados = cooperados.filter(c => 
    c.nome.toLowerCase().includes(filterCooperadoInput.toLowerCase())
  );

  const categoriasProfissionais = Array.from(new Set(cooperados.map(c => c.especialidade).filter(Boolean)));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Relatórios de Produção</h2>
        <div className="flex gap-6">
          {/* Relatório Geral */}
          <div className="flex gap-2">
            <button
              onClick={handleExportarPDF}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              title="Exportar todos os dados em um único arquivo"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
            <button
              onClick={handleExportarExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              title="Exportar todos os dados em um único arquivo"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </button>
          </div>

          {/* Relatório por Cooperado */}
          <div className="flex gap-2 border-l border-gray-300 pl-6">
            <button
              onClick={handleExportarPDFByCooperado}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              title="Exportar com uma página para cada cooperado"
            >
              <FileText className="w-4 h-4" />
              PDF por Cooperado
            </button>
            <button
              onClick={handleExportarExcelByCooperado}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              title="Exportar com uma aba para cada cooperado"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel por Cooperado
            </button>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-purple-700">
            <Filter className="w-5 h-5" />
            <h3 className="font-semibold">Filtros de Relatório</h3>
          </div>
          <button
            onClick={handleLimparFiltros}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition-colors"
          >
            <X className="w-4 h-4" />
            Limpar Filtros
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Hospital */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hospital
            </label>
            <select
              value={filterHospital}
              onChange={(e) => setFilterHospital(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Todos os Hospitais</option>
              {hospitais.map(h => (
                <option key={h.id} value={h.id}>{h.nome}</option>
              ))}
            </select>
          </div>

          {/* Setor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Setor
            </label>
            <select
              value={filterSetor}
              onChange={(e) => setFilterSetor(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={!filterHospital}
            >
              <option value="">Todos os Setores</option>
              {setoresDisponiveis.map(s => (
                <option key={s.id} value={s.id.toString()}>{s.nome}</option>
              ))}
            </select>
          </div>

          {/* Cooperado */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cooperado
            </label>
            <input
              type="text"
              value={filterCooperadoInput}
              onChange={(e) => {
                setFilterCooperadoInput(e.target.value);
                setShowCooperadoSuggestions(true);
                if (!e.target.value) setFilterCooperado('');
              }}
              onFocus={() => setShowCooperadoSuggestions(true)}
              placeholder="Digite o nome..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {showCooperadoSuggestions && filterCooperadoInput && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredCooperados.length > 0 ? (
                  filteredCooperados.map(c => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setFilterCooperado(c.id);
                        setFilterCooperadoInput(c.nome);
                        setShowCooperadoSuggestions(false);
                      }}
                      className="px-3 py-2 hover:bg-purple-50 cursor-pointer"
                    >
                      {c.nome} - {c.categoriaProfissional}
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-gray-500">Nenhum cooperado encontrado</div>
                )}
              </div>
            )}
          </div>

          {/* Categoria Profissional */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoria Profissional
            </label>
            <select
              value={filterCategoria}
              onChange={(e) => setFilterCategoria(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Todas as Categorias</option>
              {categoriasProfissionais.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Data Inicial */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Inicial
            </label>
            <input
              type="date"
              value={filterDataIni}
              onChange={(e) => setFilterDataIni(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Data Final */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Final
            </label>
            <input
              type="date"
              value={filterDataFim}
              onChange={(e) => setFilterDataFim(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* ESTATÍSTICAS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">Total de Registros</div>
          <div className="text-2xl font-bold text-purple-700">{relatorioData.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">Plantões Fechados</div>
          <div className="text-2xl font-bold text-green-600">
            {relatorioData.filter(r => r.status === 'Fechado').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">Plantões em Aberto</div>
          <div className="text-2xl font-bold text-orange-600">
            {relatorioData.filter(r => r.status === 'Em Aberto').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">Total de Horas</div>
          <div className="text-2xl font-bold text-blue-600">
            {relatorioData.reduce((acc, r) => {
              if (r.totalHoras === '--') return acc;
              const [hours, minutes] = r.totalHoras.replace('h', '').replace('m', '').split(' ').map(Number);
              return acc + hours + (minutes / 60);
            }, 0).toFixed(1)}h
          </div>
        </div>
      </div>

      {/* TABELA */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-purple-700 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Cooperado</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Categoria</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Hospital</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Setor</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Data</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Entrada</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Saída</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Total</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {relatorioData.length > 0 ? (
                relatorioData.map((row, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{row.cooperadoNome}</td>
                    <td className="px-4 py-3 text-sm">{row.especialidade}</td>
                    <td className="px-4 py-3 text-sm">{row.hospital}</td>
                    <td className="px-4 py-3 text-sm">{row.setor}</td>
                    <td className="px-4 py-3 text-sm">{row.data}</td>
                    <td className="px-4 py-3 text-sm text-green-600 font-medium">{row.entrada}</td>
                    <td className="px-4 py-3 text-sm text-red-600 font-medium">{row.saida}</td>
                    <td className="px-4 py-3 text-sm font-medium">{row.totalHoras}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        row.status === 'Fechado' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    Nenhum registro encontrado com os filtros aplicados
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
