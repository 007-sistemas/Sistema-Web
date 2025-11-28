import React, { useState, useEffect } from 'react';
import { Cooperado, StatusCooperado } from '../types';
import { StorageService } from '../services/storage';
import { Plus, Save, Search, Edit2, Trash2, X, Fingerprint, Briefcase } from 'lucide-react';

export const CooperadoRegister: React.FC = () => {
  const [cooperados, setCooperados] = useState<Cooperado[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Category Modal State
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Form State
  const initialFormState: Partial<Cooperado> = {
    nome: '',
    cpf: '',
    matricula: '',
    especialidade: '', // This will map to "Categoria Profissional"
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

    const newCooperado: Cooperado = {
      ...formData as Cooperado,
      id: formData.id || crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
      biometrias: formData.biometrias || []
    };

    StorageService.saveCooperado(newCooperado);
    loadCooperados();
    setIsFormOpen(false);
    setFormData(initialFormState);
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

  const filteredCooperados = cooperados.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.matricula.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Cadastro de Cooperados</h2>
          <p className="text-gray-500">Gerencie os profissionais da cooperativa</p>
        </div>
        <button 
          onClick={() => { setFormData(initialFormState); setIsFormOpen(true); }}
          className="flex items-center justify-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Cooperado</span>
        </button>
      </div>

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
            
            {/* Categoria Profissional (antiga Especialidade) */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Categoria Profissional</label>
              <div className="flex gap-2">
                <select 
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                  value={formData.especialidade}
                  onChange={e => setFormData({...formData, especialidade: e.target.value})}
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
                  <th className="px-6 py-3">Nome</th>
                  <th className="px-6 py-3">Matrícula</th>
                  <th className="px-6 py-3">Categoria</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Biometrias</th>
                  <th className="px-6 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCooperados.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{c.nome}</td>
                    <td className="px-6 py-4">{c.matricula}</td>
                    <td className="px-6 py-4">{c.especialidade}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        c.status === StatusCooperado.ATIVO ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1">
                         <Fingerprint className="h-4 w-4 text-primary-500" />
                         <span>{c.biometrias.length}</span>
                      </div>
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
                {filteredCooperados.length === 0 && (
                   <tr>
                     <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
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