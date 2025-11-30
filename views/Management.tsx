
import React, { useState, useEffect } from 'react';
import { Manager, HospitalPermissions } from '../types';
import { StorageService } from '../services/storage';
import { Plus, Save, Trash2, Edit2, Shield, Lock, X, Briefcase } from 'lucide-react';

export const Management: React.FC = () => {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  const initialFormState: Manager = {
    id: '',
    username: '',
    password: '',
    permissoes: {
      dashboard: true,
      ponto: true,
      relatorio: true,
      cadastro: true,
      hospitais: true,
      biometria: true,
      auditoria: true,
      gestao: true,
      espelho: true // Admins generally have access
    }
  };
  
  const [formData, setFormData] = useState<Manager>(initialFormState);

  useEffect(() => {
    loadManagers();
  }, []);

  const loadManagers = () => {
    setManagers(StorageService.getManagers());
  };

  const handleNewManager = () => {
    setFormData(initialFormState);
    setIsFormOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username) return alert('Nome de usuário é obrigatório');
    if (!formData.password) return alert('Senha é obrigatória');
    
    const newManager: Manager = {
      ...formData,
      id: formData.id || crypto.randomUUID(),
    };

    StorageService.saveManager(newManager);
    loadManagers();
    setIsFormOpen(false);
    setFormData(initialFormState);
  };

  const handleEdit = (m: Manager) => {
    setFormData(m);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (id === 'master-001') {
        alert('O usuário master não pode ser excluído.');
        return;
    }
    if (confirm('Tem certeza que deseja remover este gestor?')) {
      StorageService.deleteManager(id);
      loadManagers();
    }
  };

  // Permission Labels Map
  const permissionLabels: { key: keyof HospitalPermissions; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'ponto', label: 'Registrar Produção' },
    { key: 'relatorio', label: 'Relatório Detalhado' },
    { key: 'espelho', label: 'Espelho de Ponto' },
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
          <h2 className="text-2xl font-bold text-gray-800">Gestão de Usuários</h2>
          <p className="text-gray-500">Administre os gestores do sistema e suas permissões</p>
        </div>
        <button 
          onClick={handleNewManager}
          className="flex items-center justify-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Gestor</span>
        </button>
      </div>

      {isFormOpen ? (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 animate-fade-in max-w-3xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-700">
              {formData.id ? 'Editar Gestor' : 'Novo Gestor'}
            </h3>
            <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Credentials Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Nome de Usuário</label>
                <input 
                  required
                  type="text" 
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  placeholder="ex: gabriel"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Senha
                </label>
                <input 
                  required
                  type="text" 
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  placeholder="Digite a senha..."
               />
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
                <span>Salvar Gestor</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {managers.map(m => (
            <div key={m.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow group relative">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-primary-50 p-2 rounded-lg">
                    <Briefcase className="h-6 w-6 text-primary-600" />
                  </div>
                  <div className="overflow-hidden">
                     <h3 className="font-bold text-gray-800 truncate" title={m.username}>{m.username}</h3>
                     <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600 border border-gray-200">
                          {m.id === 'master-001' ? 'MASTER ADMIN' : 'Gestor'}
                        </span>
                     </div>
                  </div>
                </div>
                <div className="flex space-x-1 flex-shrink-0">
                  <button onClick={() => handleEdit(m)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  {m.id !== 'master-001' && (
                    <button onClick={() => handleDelete(m.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                        <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="mt-4">
                <div className="flex items-center text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  <Shield className="h-3 w-3 mr-1" />
                  Acessos Liberados
                </div>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-hidden">
                  {permissionLabels.filter(p => m.permissoes[p.key]).map(p => (
                    <span key={p.key} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-100">
                      {p.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
