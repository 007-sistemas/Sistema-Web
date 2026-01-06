import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Save, Sun, Moon, Eye, EyeOff, GripVertical, X } from 'lucide-react';

const THEME_OPTIONS = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'auto', label: 'Automático', icon: '🔄' }
];

const AVAILABLE_COLORS = [
  { name: 'Azul', value: '#2563eb' },
  { name: 'Verde', value: '#16a34a' },
  { name: 'Vermelho', value: '#dc2626' },
  { name: 'Roxo', value: '#7c3aed' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Laranja', value: '#ea580c' },
  { name: 'Cyan', value: '#0891b2' },
  { name: 'Índigo', value: '#4f46e5' },
];

const ALL_TABS = [
  { key: 'auditoria', label: 'Auditoria & Logs' },
  { key: 'autorizacao', label: 'Justificativa de Plantão' },
  { key: 'biometria', label: 'Biometria' },
  { key: 'cadastro', label: 'Cooperados' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'espelho', label: 'Espelho da Biometria' },
  { key: 'gestao', label: 'Gestão de Usuários' },
  { key: 'hospitais', label: 'Hospitais & Setores' },
  { key: 'perfil', label: 'Meu Perfil' },
  { key: 'ponto', label: 'Registro de Ponto' },
  { key: 'relatorio', label: 'Relatórios' },
].sort((a, b) => a.label.localeCompare(b.label));

export const UserProfile: React.FC = () => {
  const [preferences, setPreferences] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const sess = StorageService.getSession();
    setSession(sess);

    const prefs = StorageService.getUserPreferences();
    if (prefs) {
      setPreferences(prefs);
    }
  }, []);

  if (!session || !preferences) {
    return <div className="text-center py-8 text-gray-500">Carregando perfil...</div>;
  }

  const handleThemeChange = (theme: 'light' | 'dark' | 'auto') => {
    const updated = { ...preferences, theme };
    setPreferences(updated);
    setIsSaving(true);
    StorageService.saveUserPreferences(updated);
    setIsSaving(false);
    
    // Apply theme immediately
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // Auto: verificar horário (6h-18h = claro, 18h-6h = escuro)
      const hour = new Date().getHours();
      if (hour >= 6 && hour < 18) {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
    }
  };

  const handleColorChange = (color: string) => {
    const updated = { ...preferences, primaryColor: color };
    setPreferences(updated);
    setIsSaving(true);
    StorageService.saveUserPreferences(updated);
    setIsSaving(false);
    
    // Apply color to CSS variable
    document.documentElement.style.setProperty('--primary-color', color);
  };


  const handleSavePreferences = () => {
    setIsSaving(true);
    StorageService.saveUserPreferences(preferences);
    
    setTimeout(() => {
      setIsSaving(false);
      alert('Preferências salvas com sucesso!');
    }, 500);
  };



  return (
    <div className="space-y-6 max-w-4xl">
      {/* Cabeçalho */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Meu Perfil</h2>
        <p className="text-gray-500">Gerencie suas preferências de tema, cores e abas</p>
      </div>

      {/* Informações do Usuário */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Informações Pessoais</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome de Usuário</label>
            <input
              type="text"
              value={session.user?.username || ''}
              disabled
              className="w-full bg-gray-100 text-gray-900 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={session.user?.email || ''}
              disabled
              className="w-full bg-gray-100 text-gray-900 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
            <input
              type="text"
              value={session.user?.cpf || ''}
              disabled
              className="w-full bg-gray-100 text-gray-900 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Tema */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Tema da Interface</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {THEME_OPTIONS.map((option) => {
            const isActive = preferences.theme === option.value;
            const Icon = typeof option.icon === 'string' ? null : option.icon;
            
            return (
              <button
                key={option.value}
                onClick={() => handleThemeChange(option.value as any)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  isActive
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-center mb-2">
                  {Icon ? (
                    <Icon className={`h-6 w-6 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                  ) : (
                    <span className="text-2xl">{option.icon}</span>
                  )}
                </div>
                <p className={`text-sm font-medium ${isActive ? 'text-primary-600' : 'text-gray-700'}`}>
                  {option.label}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cores */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Cor Primária</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {AVAILABLE_COLORS.map((color) => {
            const isActive = preferences.primaryColor === color.value;
            
            return (
              <button
                key={color.value}
                onClick={() => handleColorChange(color.value)}
                className={`p-4 rounded-lg border-2 transition-all flex items-center gap-2 ${
                  isActive
                    ? 'border-gray-800 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-full border-2 border-gray-300"
                  style={{ backgroundColor: color.value }}
                />
                <span className={`text-sm font-medium ${isActive ? 'text-gray-800' : 'text-gray-600'}`}>
                  {color.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Botão Salvar Preferências */}
      <div className="flex justify-end">
        <button
          className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-2 rounded-lg shadow transition-all disabled:opacity-60"
          onClick={handleSavePreferences}
          disabled={isSaving}
        >
          {isSaving ? 'Salvando...' : 'Salvar Preferências'}
        </button>
      </div>
    </div>
  );
};
