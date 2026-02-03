import React, { useState, useEffect } from 'react';
import { Cooperado, StatusCooperado } from '../types';
import { StorageService } from '../services/storage';
import { Plus, Save, Search, Edit2, Trash2, X, Fingerprint, Briefcase, AlertCircle, Upload, Download, CheckCircle, AlertTriangle } from 'lucide-react';
import { parseCSV, validateAndPrepareImport, importCooperados, parseExcelFile } from '../services/csvParser';
import { normalizeNome } from '../services/normalize';
import * as XLSX from 'xlsx';

export const CooperadoRegister: React.FC = () => {
  const [cooperados, setCooperados] = useState<Cooperado[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Cooperado; direction: 'asc' | 'desc' }>({ key: 'nome', direction: 'asc' });
  
  // Category Modal State
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Duplicate Cooperado Modal State
  const [duplicateCooperado, setDuplicateCooperado] = useState<Cooperado | null>(null);
  const [duplicateType, setDuplicateType] = useState<'cpf' | 'matricula' | null>(null);

  // CSV Import State
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [csvPreview, setCsvPreview] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Form State
  const initialFormState: Partial<Cooperado> = {
    nome: '',
    cpf: '',
    matricula: '',
    categoriaProfissional: '', // Categoria Profissional
    email: '',
    telefone: '',
    status: StatusCooperado.ATIVO,
    biometrias: []
  };
  const [formData, setFormData] = useState<Partial<Cooperado>>(initialFormState);

  useEffect(() => {
    loadCooperados();
    loadCategorias();
  }, []);

  const loadCooperados = () => {
    setCooperados(StorageService.getCooperados());
  };

  const loadCategorias = () => {
    setCategorias(StorageService.getCategorias());
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.cpf) return alert('Campos obrigatórios faltando');

    // Verificar se existe CPF duplicado
    const duplicateCpf = StorageService.checkDuplicateCpfCooperado(formData.cpf, formData.id);
    if (duplicateCpf) {
      setDuplicateCooperado(duplicateCpf);
      setDuplicateType('cpf');
      return;
    }

    // Verificar se existe matrícula duplicada
    const duplicateMatricula = StorageService.checkDuplicateMatriculaCooperado(formData.matricula, formData.id);
    if (duplicateMatricula) {
      setDuplicateCooperado(duplicateMatricula);
      setDuplicateType('matricula');
      return;
    }

    const newCooperado: Cooperado = {
      ...formData as Cooperado,
      nome: normalizeNome(formData.nome || ''),
      id: formData.id || crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
      biometrias: formData.biometrias || []
    };

    StorageService.saveCooperado(newCooperado);
    loadCooperados();
    setIsFormOpen(false);
    setFormData(initialFormState);
  };

  const handleAccessDuplicateCooperado = () => {
    if (duplicateCooperado) {
      setFormData(duplicateCooperado);
      setDuplicateCooperado(null);
      setDuplicateType(null);
    }
  };

  const handleCloseDuplicateCooperadoModal = () => {
    setDuplicateCooperado(null);
    setDuplicateType(null);
  };

  const handleEdit = (c: Cooperado) => {
    setFormData(c);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja inativar/remover este cooperado?')) {
      StorageService.deleteCooperado(id);
      loadCooperados();
    }
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    StorageService.saveCategoria(newCategoryName.trim());
    loadCategorias();
    setNewCategoryName('');
    setIsCatModalOpen(false);
  };

  const handleCSVFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let rows;
      
      // Detectar tipo de arquivo
      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        rows = parseCSV(text);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.xlsm')) {
        rows = await parseExcelFile(file);
      } else {
        alert('Formato de arquivo não suportado. Use CSV ou Excel (xlsx, xls, xlsm)');
        return;
      }

      const result = validateAndPrepareImport(rows);
      setCsvPreview(result);
      setImportResult(null);
    } catch (error) {
      console.error('Erro ao ler arquivo:', error);
      alert('Erro ao ler arquivo. Verifique se o arquivo está válido.');
    }
  };

  const handleImportCSV = async () => {
    if (!csvPreview) return;
    
    setIsImporting(true);
    try {
      importCooperados(csvPreview.sucesso);
      setImportResult({
        success: true,
        count: csvPreview.sucesso.length,
        errors: csvPreview.erros.length
      });
      loadCooperados();
      setTimeout(() => {
        setCsvPreview(null);
        setShowCSVImport(false);
        setImportResult(null);
      }, 2000);
    } catch (err) {
      setImportResult({
        success: false,
        error: 'Erro ao importar cooperados'
      });
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    // Criar template Excel vazio com 10 linhas para preenchimento
    // Status sempre será ATIVO por padrão
    const templateData = [
      { nome: '', cpf: '', matricula: '', categoriaProfissional: '', telefone: '', email: '' },
      { nome: '', cpf: '', matricula: '', especialidade: '', telefone: '', email: '' },
      { nome: '', cpf: '', matricula: '', especialidade: '', telefone: '', email: '' },
      { nome: '', cpf: '', matricula: '', especialidade: '', telefone: '', email: '' },
      { nome: '', cpf: '', matricula: '', especialidade: '', telefone: '', email: '' },
      { nome: '', cpf: '', matricula: '', especialidade: '', telefone: '', email: '' },
      { nome: '', cpf: '', matricula: '', especialidade: '', telefone: '', email: '' },
      { nome: '', cpf: '', matricula: '', especialidade: '', telefone: '', email: '' },
      { nome: '', cpf: '', matricula: '', especialidade: '', telefone: '', email: '' },
      { nome: '', cpf: '', matricula: '', especialidade: '', telefone: '', email: '' },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Ajustar largura das colunas
    ws['!cols'] = [
      { wch: 25 }, // nome
      { wch: 15 }, // cpf
      { wch: 15 }, // matricula
      { wch: 20 }, // categoriaProfissional
      { wch: 15 }, // telefone
      { wch: 25 }  // email
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cooperados');
    XLSX.writeFile(wb, 'cooperados_modelo.xlsx');
  };


  const filteredCooperados = cooperados.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.matricula.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Ordenação
  const sortedCooperados = [...filteredCooperados].sort((a, b) => {
    const { key, direction } = sortConfig;
    let aValue = a[key];
    let bValue = b[key];
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      aValue = aValue.toUpperCase();
      bValue = bValue.toUpperCase();
    }
    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: keyof Cooperado) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Cadastro de Cooperados</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={downloadTemplate}
            className="flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors"
            title="Baixar modelo em Excel"
          >
            <Download className="h-4 w-4" />
            <span>Modelo Planilha</span>
          </button>
          <button 
            onClick={() => setShowCSVImport(true)}
            className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Upload className="h-4 w-4" />
            <span>Importar Planilha</span>
          </button>
          <button 
            onClick={() => { setFormData(initialFormState); setIsFormOpen(true); }}
            className="flex items-center justify-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Cooperado</span>
          </button>
        </div>
      </div>

      {/* Duplicate Cooperado Modal - Renderizado Fora */}
      {duplicateCooperado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm animate-fade-in mx-4">
            <div className="flex items-center gap-2 mb-4 text-orange-600">
              <AlertCircle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-gray-800">
                {duplicateType === 'cpf' ? 'CPF Já Cadastrado' : 'Matrícula Já Cadastrada'}
              </h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              {duplicateType === 'cpf' 
                ? 'Já existe um cooperado registrado com este CPF:'
                : 'Já existe um cooperado registrado com esta matrícula:'}
            </p>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <div className="space-y-2 text-sm">
                <div><span className="font-semibold text-gray-700">Nome:</span> {duplicateCooperado.nome}</div>
                <div><span className="font-semibold text-gray-700">CPF:</span> {duplicateCooperado.cpf}</div>
                <div><span className="font-semibold text-gray-700">Matrícula:</span> {duplicateCooperado.matricula}</div>
                <div><span className="font-semibold text-gray-700">Email:</span> {duplicateCooperado.email}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCloseDuplicateCooperadoModal}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAccessDuplicateCooperado}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                Acessar Cadastro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Planilha Import Modal */}
      {showCSVImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl animate-fade-in mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <div className="flex items-center gap-2">
                <Upload className="h-6 w-6 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-800">Importar Cooperados via Planilha</h3>
              </div>
              <button 
                onClick={() => {
                  setShowCSVImport(false);
                  setCsvPreview(null);
                  setImportResult(null);
                }} 
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!csvPreview && !importResult ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Selecione uma planilha com os dados dos cooperados a importar.</p>
                
                <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 bg-blue-50 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-100 transition-colors">
                  <input 
                    type="file"
                    accept=".csv,.xlsx,.xls,.xlsm"
                    onChange={handleCSVFileChange}
                    className="hidden"
                    id="csvFileInput"
                  />
                  <label htmlFor="csvFileInput" className="cursor-pointer flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-blue-500" />
                    <span className="text-sm font-medium text-blue-600">Clique para selecionar arquivo</span>
                    <span className="text-xs text-gray-500">Excel (xlsx, xls, xlsm) ou CSV</span>
                  </label>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Colunas obrigatórias:</p>
                  <p className="text-xs text-gray-600 font-mono mb-3">nome | cpf | matricula | categoriaProfissional | telefone | email</p>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p><span className="font-semibold">Nota:</span> O status será sempre "ATIVO" por padrão</p>
                    <p><span className="font-semibold">Exemplo:</span></p>
                    <p className="font-mono">João Silva,12345678901,MAT001,Cardiologia,11999999999,joao@email.com</p>
                  </div>
                </div>
              </div>
            ) : importResult?.success ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
                  <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-green-700">Importação concluída!</p>
                    <p className="text-sm text-green-600">{importResult.count} cooperado(s) importado(s) com sucesso.</p>
                    {importResult.errors > 0 && (
                      <p className="text-sm text-orange-600">{importResult.errors} linha(s) continha erro(s) e foi(ram) ignorada(s).</p>
                    )}
                  </div>
                </div>
              </div>
            ) : importResult?.error ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                  <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-red-700">Erro na importação</p>
                    <p className="text-sm text-red-600">{importResult.error}</p>
                  </div>
                </div>
              </div>
            ) : csvPreview ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <p className="text-sm text-gray-600">Linhas válidas</p>
                    <p className="text-2xl font-bold text-green-600">{csvPreview.sucesso.length}</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                    <p className="text-sm text-gray-600">Linhas com erro</p>
                    <p className="text-2xl font-bold text-orange-600">{csvPreview.erros.length}</p>
                  </div>
                </div>

                {csvPreview.sucesso.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-gray-700 text-sm">Cooperados a importar:</h4>
                    <div className="bg-green-50 rounded-lg overflow-x-auto max-h-40 border border-green-200">
                      <table className="w-full text-xs text-gray-600">
                        <thead className="bg-green-100 text-green-800 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left">Nome</th>
                            <th className="px-3 py-2 text-left">CPF</th>
                            <th className="px-3 py-2 text-left">Matrícula</th>
                            <th className="px-3 py-2 text-left">Categoria</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-green-100">
                          {csvPreview.sucesso.slice(0, 10).map((c: any, i: number) => (
                            <tr key={i}>
                              <td className="px-3 py-2">{normalizeNome(c.nome)}</td>
                              <td className="px-3 py-2">{c.cpf}</td>
                              <td className="px-3 py-2">{c.matricula}</td>
                              <td className="px-3 py-2">{c.categoriaProfissional}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {csvPreview.sucesso.length > 10 && (
                        <div className="px-3 py-2 bg-green-50 text-xs text-gray-600 text-center">
                          ... e mais {csvPreview.sucesso.length - 10} registro(s)
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {csvPreview.erros.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-gray-700 text-sm">Erros encontrados:</h4>
                    <div className="bg-orange-50 rounded-lg overflow-x-auto max-h-40 border border-orange-200">
                      <table className="w-full text-xs text-gray-600">
                        <thead className="bg-orange-100 text-orange-800 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left">Linha</th>
                            <th className="px-3 py-2 text-left">Campo</th>
                            <th className="px-3 py-2 text-left">Erro</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-orange-100">
                          {csvPreview.erros.slice(0, 10).map((e: any, i: number) => (
                            <tr key={i}>
                              <td className="px-3 py-2">{e.row}</td>
                              <td className="px-3 py-2">{e.campo}</td>
                              <td className="px-3 py-2">{e.erro}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {csvPreview.erros.length > 10 && (
                        <div className="px-3 py-2 bg-orange-50 text-xs text-gray-600 text-center">
                          ... e mais {csvPreview.erros.length - 10} erro(s)
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setCsvPreview(null);
                      document.getElementById('csvFileInput')?.click();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Selecionar outro arquivo
                  </button>
                  <button
                    onClick={handleImportCSV}
                    disabled={isImporting || csvPreview.sucesso.length === 0}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isImporting ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Importando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Importar {csvPreview.sucesso.length} cooperado(s)
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {isFormOpen ? (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 animate-fade-in">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-700">
              {formData.id ? 'Editar Cooperado' : 'Novo Cadastro'}
            </h3>
            <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Nome Completo</label>
              <input 
                required
                type="text" 
                className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                value={formData.nome}
                onChange={e => setFormData({...formData, nome: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">CPF</label>
              <input 
                required
                type="text" 
                placeholder="000.000.000-00"
                className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                value={formData.cpf}
                onChange={e => setFormData({...formData, cpf: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Matrícula</label>
              <input 
                type="text" 
                className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                value={formData.matricula}
                onChange={e => setFormData({...formData, matricula: e.target.value})}
              />
            </div>
            
            {/* Categoria Profissional */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Categoria Profissional</label>
              <div className="flex gap-2">
                <select 
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                  value={formData.categoriaProfissional}
                  onChange={e => setFormData({...formData, categoriaProfissional: e.target.value})}
                >
                  <option value="">Selecione...</option>
                  {categorias.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(true)}
                  className="px-3 bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-lg transition-colors flex items-center justify-center border border-primary-200"
                  title="Nova Categoria"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <input 
                type="email" 
                className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Telefone</label>
              <input 
                type="tel" 
                className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                value={formData.telefone}
                onChange={e => setFormData({...formData, telefone: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Status</label>
              <select 
                className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as StatusCooperado})}
              >
                {Object.values(StatusCooperado).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 flex justify-end space-x-3 mt-4">
              <button 
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors bg-white"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Save className="h-4 w-4" />
                <span>Salvar Cooperado</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center bg-gray-50">
            <Search className="h-5 w-5 text-gray-400 mr-2" />
            <input 
              type="text"
              placeholder="Buscar por nome ou matrícula..."
              className="bg-transparent border-none outline-none text-sm w-full text-gray-900"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-medium">
                <tr>
                  <th className="px-6 py-3 cursor-pointer select-none" onClick={() => handleSort('nome')}>Nome {sortConfig.key === 'nome' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                  <th className="px-6 py-3 cursor-pointer select-none" onClick={() => handleSort('matricula')}>Matrícula {sortConfig.key === 'matricula' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                  <th className="px-6 py-3 cursor-pointer select-none" onClick={() => handleSort('categoriaProfissional')}>Categoria {sortConfig.key === 'categoriaProfissional' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                  <th className="px-6 py-3 cursor-pointer select-none" onClick={() => handleSort('status')}>Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                  <th className="px-6 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedCooperados.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{c.nome}</td>
                    <td className="px-6 py-4">{c.matricula}</td>
                    <td className="px-6 py-4">{c.categoriaProfissional}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        c.status === StatusCooperado.ATIVO ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => handleEdit(c)} 
                          className="p-1 hover:bg-gray-200 rounded text-gray-600"
                          type="button"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(c.id);
                          }} 
                          className="p-1 hover:bg-red-50 rounded text-red-500"
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedCooperados.length === 0 && (
                   <tr>
                     <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                       Nenhum cooperado encontrado.
                     </td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Nova Categoria */}
      {isCatModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm animate-fade-in mx-4">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary-600" />
                Nova Categoria
              </h3>
              <button 
                onClick={() => setIsCatModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Nome da Categoria</label>
                <input 
                  autoFocus
                  type="text" 
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="Ex: Fisioterapeuta"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => { if(e.key === 'Enter') handleAddCategory(); }}
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <button 
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 bg-white"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleAddCategory}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};