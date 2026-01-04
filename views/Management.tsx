
import React, { useState, useEffect } from 'react';
import { Manager, HospitalPermissions } from '../types';
import { StorageService } from '../services/storage';
import { Plus, Save, Trash2, Edit2, Shield, Lock, X, Briefcase, RefreshCw, Wrench, AlertCircle } from 'lucide-react';
import { apiGet, apiPost } from '../services/api';

export const Management: React.FC = () => {
  const [managers, setManagers] = useState<Manager[]>([]);

  // Garante que todos os gestores tenham acesso a setores
  useEffect(() => {
    const all = StorageService.getManagers();
    let changed = false;
    all.forEach(m => {
      if (!m.permissoes) m.permissoes = {} as any;
      if (!m.permissoes.setores) {
        m.permissoes.setores = true;
        changed = true;
      }
    });
    if (changed) {
      all.forEach(StorageService.saveManager);
    }
    setManagers(StorageService.getManagers());
  }, []);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSummary, setAuditSummary] = useState<any | null>(null);
  const [auditDetails, setAuditDetails] = useState<any | null>(null);
  const [consolidateLoading, setConsolidateLoading] = useState(false);
  const [consolidateResult, setConsolidateResult] = useState<any | null>(null);
  const [duplicateManager, setDuplicateManager] = useState<Manager | null>(null);
  
  const initialFormState: Manager = {
    id: '',
    username: '',
    password: '',
    cpf: '',
    email: '',
    permissoes: {
      dashboard: true,
      ponto: true,
      relatorio: true,
      relatorios: true,
      cadastro: true,
      hospitais: true,
      biometria: true,
      auditoria: true,
      gestao: true,
      espelho: true,
      autorizacao: true,
      perfil: true,
      setores: true
    }
  };
  
  const [formData, setFormData] = useState<Manager>(initialFormState);

  useEffect(() => {
    loadManagers();
  }, []);

  // Reseta o formulário quando fechar o modal
  useEffect(() => {
    if (!isFormOpen) {
      setFormData(initialFormState);
    }
  }, [isFormOpen]);

  const loadManagers = () => {
    setManagers(StorageService.getManagers());
  };

  const runAudit = async () => {
    try {
      setAuditLoading(true);
      setConsolidateResult(null);
      const result = await apiGet<any>('health');
      setAuditSummary(result.summary);
      setAuditDetails(result.details);
    } catch (err) {
      alert('Falha ao auditar dados.');
      console.warn(err);
    } finally {
      setAuditLoading(false);
    }
  };

  const runConsolidate = async () => {
    try {
      setConsolidateLoading(true);
      const result = await apiPost<any>('consolidate', {});
      setConsolidateResult(result.changes);
      // Reexecutar auditoria para refletir estado atual
      await runAudit();
    } catch (err) {
      alert('Falha ao consolidar dados.');
      console.warn(err);
    } finally {
      setConsolidateLoading(false);
    }
  };

  const handleNewManager = () => {
    setFormData(initialFormState);
    setIsFormOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username) return alert('Nome de usuário é obrigatório');
    if (!formData.password) return alert('Senha é obrigatória');
    if (!formData.cpf) return alert('CPF é obrigatório');
    if (!formData.email) return alert('Email é obrigatório');
    
    // Verificar se existe CPF duplicado
    const duplicate = StorageService.checkDuplicateCpf(formData.cpf, formData.id);
    if (duplicate) {
      setDuplicateManager(duplicate);
      return;
    }

    const newManager: Manager = {
      ...formData,
      id: formData.id || crypto.randomUUID(),
    };

    StorageService.saveManager(newManager);
    
    // Se estiver editando o usuário atual, atualiza a sessão com as novas permissões
    const currentSession = StorageService.getSession();
    if (currentSession && currentSession.user.id === newManager.id) {
      StorageService.setSession({
        ...currentSession,
        permissions: newManager.permissoes
      });
      // Dispara evento para que App.tsx reaja à mudança
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'session',
        newValue: JSON.stringify({ ...currentSession, permissions: newManager.permissoes }),
        oldValue: JSON.stringify(currentSession)
      }));
    }

    loadManagers();
    setIsFormOpen(false);
    setFormData(initialFormState);
  };

  const handleAccessDuplicate = () => {
    if (duplicateManager) {
      setFormData(duplicateManager);
      setDuplicateManager(null);
    }
  };

  const handleCloseDuplicateModal = () => {
    setDuplicateManager(null);
  };

  const handleEdit = (m: Manager) => {
    // Recarrega do localStorage para garantir que tem os dados mais recentes
    const fresh = StorageService.getManagers().find(manager => manager.id === m.id);
    if (fresh) {
      setFormData(fresh);
    } else {
      setFormData(m);
    }
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
    { key: 'relatorio', label: 'Controle de Produção' },
    { key: 'relatorios', label: 'Relatórios' },
    { key: 'espelho', label: 'Espelho de Ponto' },
    { key: 'autorizacao', label: 'Aprovação de Ponto' },
    { key: 'cadastro', label: 'Cooperados' },
    { key: 'hospitais', label: 'Hospitais & Setores' },
    { key: 'setores', label: 'Setores' },
    { key: 'biometria', label: 'Biometria' },
    { key: 'auditoria', label: 'Auditoria & Logs' },
    { key: 'gestao', label: 'Gestão de Usuários' },
    { key: 'perfil', label: 'Meu Perfil' },
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
        <div className="flex items-center gap-2">
          <button 
            onClick={handleNewManager}
            className="flex items-center justify-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Gestor</span>
          </button>
          <button
            onClick={runAudit}
            className="flex items-center justify-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors"
            title="Auditar dados no banco"
          >
            <RefreshCw className={`h-4 w-4 ${auditLoading ? 'animate-spin' : ''}`} />
            <span>{auditLoading ? 'Auditando...' : 'Auditar Dados'}</span>
          </button>
          <button
            onClick={runConsolidate}
            disabled={consolidateLoading}
            className="flex items-center justify-center space-x-2 bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
            title="Aplicar correções automáticas"
          >
            <Wrench className={`h-4 w-4 ${consolidateLoading ? 'animate-spin' : ''}`} />
            <span>{consolidateLoading ? 'Consolidando...' : 'Consolidar'}</span>
          </button>
        </div>
      </div>

      {/* Duplicate Manager Modal - Renderizado Fora */}
      {duplicateManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm animate-fade-in mx-4">
            <div className="flex items-center gap-2 mb-4 text-orange-600">
              <AlertCircle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-gray-800">CPF Já Cadastrado</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Já existe um gestor registrado com este CPF:
            </p>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <div className="space-y-2 text-sm">
                <div><span className="font-semibold text-gray-700">Usuário:</span> {duplicateManager.username}</div>
                <div><span className="font-semibold text-gray-700">Email:</span> {duplicateManager.email}</div>
                <div><span className="font-semibold text-gray-700">CPF:</span> {duplicateManager.cpf}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCloseDuplicateModal}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAccessDuplicate}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                Acessar Cadastro
              </button>
            </div>
          </div>
        </div>
      )}

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

            {/* Identity Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">CPF</label>
                <input
                  required
                  type="text"
                  placeholder="000.000.000-00"
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                  value={formData.cpf}
                  onChange={e => setFormData({...formData, cpf: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Email</label>
                <input
                  required
                  type="email"
                  placeholder="email@exemplo.com"
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
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
        <div className="space-y-6">
          {/* Audit Panel */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-3 text-gray-700 font-semibold border-b border-gray-100 pb-2">
              <RefreshCw className="h-5 w-5" />
              <span>Auditoria de Dados</span>
            </div>
            {auditSummary ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="flex justify-between"><span>Hospitais duplicados (slug):</span><span className="font-mono">{auditSummary.duplicateHospitals}</span></div>
                  <div className="flex justify-between"><span>Pontos órfãos (cooperado):</span><span className="font-mono">{auditSummary.orphanPontos}</span></div>
                  <div className="flex justify-between"><span>Managers duplicados (username):</span><span className="font-mono">{auditSummary.duplicateManagers}</span></div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between"><span>Biometrias órfãs:</span><span className="font-mono">{auditSummary.orphanBiometrias}</span></div>
                  <div className="flex justify-between"><span>Justificativas órfãs (cooperado):</span><span className="font-mono">{auditSummary.orphanJustificativasCoop}</span></div>
                  <div className="flex justify-between"><span>Justificativas com ponto inexistente:</span><span className="font-mono">{auditSummary.orphanJustificativasPonto}</span></div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Clique em "Auditar Dados" para gerar o relatório.</p>
            )}

            {consolidateResult && (
              <div className="mt-4 text-sm">
                <div className="font-semibold text-gray-700 mb-2">Correções aplicadas:</div>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <li>Hospitais deduplicados: {consolidateResult.hospitalsDedup}</li>
                  <li>Cooperados criados a partir de pontos: {consolidateResult.cooperadosFromPontos}</li>
                  <li>Managers deduplicados: {consolidateResult.managersDedup}</li>
                  <li>Cooperados criados a partir de biometrias: {consolidateResult.cooperadosFromBiometrias}</li>
                  <li>Justificativas com ponto nulo ajustadas: {consolidateResult.justificativasNullPonto}</li>
                  <li>Cooperados criados a partir de justificativas: {consolidateResult.cooperadosFromJustificativas}</li>
                </ul>
              </div>
            )}
          </div>

          {/* Managers Grid */}
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
                          Gestor
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
        </div>
      )}
    </div>
  );
};
