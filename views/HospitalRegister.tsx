
import React, { useState, useEffect } from 'react';
import { Hospital, HospitalPermissions } from '../types';
import { StorageService } from '../services/storage';
import { Plus, Save, Trash2, Building2, Layers, X, Edit2, Lock, Shield, User } from 'lucide-react';

export const HospitalRegister: React.FC = () => {
  const [hospitais, setHospitais] = useState<Hospital[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  const initialFormState: Hospital = {
    id: '',
    nome: '',
    slug: '',
    usuarioAcesso: '',
    senha: '',
    // Endereço removido conforme solicitação
    permissoes: {
      dashboard: true,
      ponto: true,
      relatorio: true,
      cadastro: false,
      hospitais: false,
      biometria: true,
      auditoria: false,
      gestao: false,
      espelho: false,
      autorizacao: false
    },
    setores: []
  };
  
  const [formData, setFormData] = useState<Hospital>(initialFormState);
  const [tempSetorName, setTempSetorName] = useState('');

  useEffect(() => {
    loadHospitais();
  }, []);

  const loadHospitais = () => {
    setHospitais(StorageService.getHospitais());
  };

  const handleNewHospital = () => {
    // Usuário agora é manual, não geramos mais o código automaticamente
    setFormData(initialFormState);
    setIsFormOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome) return alert('Nome do hospital é obrigatório');
    if (!formData.usuarioAcesso) return alert('Usuário de acesso é obrigatório');
    if (!formData.senha) return alert('Senha de acesso é obrigatória');
    
    // Check if username exists (if new or changing username)
    const existing = hospitais.find(h => h.usuarioAcesso === formData.usuarioAcesso && h.id !== formData.id);
    if (existing) {
        return alert('Este usuário de acesso já está em uso.');
    }

    const slug = formData.slug || formData.nome.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);

    const newHospital: Hospital = {
      ...formData,
      slug: slug,
      id: formData.id || crypto.randomUUID(),
    };

    StorageService.saveHospital(newHospital);
    loadHospitais();
    setIsFormOpen(false);
    setFormData(initialFormState);
  };

  const handleEdit = (h: Hospital) => {
    // Merge with default structure
    setFormData({
      ...initialFormState,
      ...h,
      permissoes: { ...initialFormState.permissoes, ...h.permissoes }
    });
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja remover este hospital?')) {
      StorageService.deleteHospital(id);
      loadHospitais();
    }
  };

  const addSetor = () => {
    if (!tempSetorName.trim()) return;
    setFormData(prev => ({
      ...prev,
      setores: [...prev.setores, { id: crypto.randomUUID(), nome: tempSetorName }]
    }));
    setTempSetorName('');
  };

  const removeSetor = (setorId: string) => {
    setFormData(prev => ({
      ...prev,
      setores: prev.setores.filter(s => s.id !== setorId)
    }));
  };

  // Permission Labels Map
  const permissionLabels: { key: keyof HospitalPermissions; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'ponto', label: 'Registrar Produção' },
    { key: 'relatorio', label: 'Relatório Detalhado' },
    { key: 'espelho', label: 'Espelho de Ponto' },
    { key: 'autorizacao', label: 'Justificativa de Plantão' },
    { key: 'cadastro', label: 'Cooperados' },
    { key: 'hospitais', label: 'Hospitais & Setores' },
    { key: 'biometria', label: 'Biometria' },
    { key: 'auditoria', label: 'Auditoria & Logs' },
    { key: 'gestao', label: 'Gestão de Usuários' },
  ];

  const togglePermission = (key: keyof HospitalPermissions) => {
    setFormData(prev => ({
      ...prev,
      permissoes: {
        ...prev.permissoes,
        [key]: !prev.permissoes[key]
      }
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Cadastro de Hospitais</h2>
          <p className="text-gray-500">Gerencie unidades e setores</p>
        </div>
        <button 
          onClick={handleNewHospital}
          className="flex items-center justify-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Hospital</span>
        </button>
      </div>

      {isFormOpen ? (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 animate-fade-in max-w-3xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-700">
              {formData.id ? 'Editar Hospital' : 'Novo Hospital'}
            </h3>
            <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Identification Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Nome da Unidade Hospitalar</label>
                <input 
                  required
                  type="text" 
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                  value={formData.nome}
                  onChange={e => setFormData({...formData, nome: e.target.value})}
                  placeholder="Ex: Hospital Regional Norte"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <User className="h-3 w-3" /> Usuário de Acesso
                </label>
                <input 
                  required
                  type="text" 
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                  value={formData.usuarioAcesso}
                  onChange={e => setFormData({...formData, usuarioAcesso: e.target.value})}
                  placeholder="Crie um usuário para login"
                />
              </div>
            </div>

            {/* Setores Section */}
            <div className="space-y-3 p-4 bg-white rounded-lg border border-gray-200">
              <label className="text-sm font-medium text-gray-700 block flex items-center gap-2">
                <Layers className="h-4 w-4" /> Setores / Alas
              </label>
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  className="flex-1 bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  value={tempSetorName}
                  onChange={e => setTempSetorName(e.target.value)}
                  placeholder="Ex: UTI, Emergência..."
                  onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); addSetor(); }}}
                />
                <button 
                  type="button"
                  onClick={addSetor}
                  className="bg-primary-100 text-primary-700 px-3 py-2 rounded-lg hover:bg-primary-200"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mt-2">
                {formData.setores.map(setor => (
                  <div key={setor.id} className="flex items-center bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                    <span className="text-sm text-gray-700 mr-2">{setor.nome}</span>
                    <button 
                      type="button"
                      onClick={() => removeSetor(setor.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {formData.setores.length === 0 && (
                  <p className="text-xs text-gray-400 w-full">Nenhum setor adicionado.</p>
                )}
              </div>
            </div>

            {/* Permissions Section */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-3 text-gray-700 font-semibold border-b border-gray-200 pb-2">
                <Shield className="h-4 w-4" /> Permissões de Acesso
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6">
                {permissionLabels.map((perm) => (
                  <div key={perm.key} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{perm.label}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={formData.permissoes[perm.key]}
                        onChange={() => togglePermission(perm.key)}
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Password Section */}
            <div className="pt-4 border-t border-gray-100">
               <label className="text-sm font-medium text-gray-700 block mb-1 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Definir Senha de Acesso
               </label>
               <input 
                  required
                  type="text" 
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                  value={formData.senha}
                  onChange={e => setFormData({...formData,senha: e.target.value})}
                  placeholder="Digite a senha..."
               />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button 
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="flex items-center space-x-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
              >
                <Save className="h-4 w-4" />
                <span>Salvar Configurações</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hospitais.map(h => (
            <div key={h.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow group relative">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-primary-50 p-2 rounded-lg">
                    <Building2 className="h-6 w-6 text-primary-600" />
                  </div>
                  <div className="overflow-hidden">
                     <h3 className="font-bold text-gray-800 truncate" title={h.nome}>{h.nome}</h3>
                     <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600 border border-gray-200">
                          {h.usuarioAcesso}
                        </span>
                     </div>
                  </div>
                </div>
                <div className="flex space-x-1 flex-shrink-0">
                  <button onClick={() => handleEdit(h)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(h.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="mt-4 mb-4">
                <div className="flex items-center text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  <Layers className="h-3 w-3 mr-1" />
                  Setores ({h.setores.length})
                </div>
                <div className="flex flex-wrap gap-2 max-h-16 overflow-hidden">
                  {h.setores.map(s => (
                    <span key={s.id} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {s.nome}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
          
          {hospitais.length === 0 && (
             <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
               <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
               <p>Nenhum hospital cadastrado.</p>
             </div>
          )}
        </div>
      )}
    </div>
  );
};
