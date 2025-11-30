
import React from 'react';
import { 
  Users, 
  Fingerprint, 
  ClipboardCheck, 
  LayoutDashboard, 
  ShieldCheck, 
  Menu,
  LogOut,
  Building2,
  XCircle,
  FileText,
  Briefcase,
  FileClock
} from 'lucide-react';
import { Hospital, HospitalPermissions } from '../types';
import { StorageService } from '../services/storage';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onChangeView: (view: string) => void;
  onLogout: () => void; // Added prop for state-driven logout
  isKiosk?: boolean;
  kioskHospital?: Hospital;
  permissions?: HospitalPermissions; 
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  currentView, 
  onChangeView, 
  onLogout,
  isKiosk = false,
  kioskHospital,
  permissions
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // All possible menu items
  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permissionKey: 'dashboard' },
    { id: 'ponto', label: 'Registrar Produção', icon: ClipboardCheck, permissionKey: 'ponto' },
    { id: 'relatorio', label: 'Relatório Detalhado', icon: FileText, permissionKey: 'relatorio' },
    { id: 'espelho', label: 'Espelho da Biometria', icon: FileClock, permissionKey: 'espelho' },
    { id: 'cadastro', label: 'Cooperados', icon: Users, permissionKey: 'cadastro' },
    { id: 'hospitais', label: 'Hospitais & Setores', icon: Building2, permissionKey: 'hospitais' },
    { id: 'biometria', label: 'Biometria', icon: Fingerprint, permissionKey: 'biometria' },
    { id: 'auditoria', label: 'Auditoria & Logs', icon: ShieldCheck, permissionKey: 'auditoria' },
    { id: 'gestao', label: 'Gestão de Usuários', icon: Briefcase, permissionKey: 'gestao' },
  ];

  // Filter items based on permissions
  const navItems = allNavItems.filter(item => {
    // If no permissions object provided, assume full access (for backward compatibility/master)
    // OR verify the specific key
    if (!permissions) return true;
    
    return permissions[item.permissionKey as keyof HospitalPermissions] === true;
  });

  const exitKioskMode = () => {
    // Remove query params to go back to admin mode
    window.location.search = '';
  };

  const handleLogoutClick = () => {
    // Trigger the state reset in App.tsx
    onLogout();
  };

  if (isKiosk) {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        {/* Kiosk Header */}
        <header className="bg-primary-900 text-white shadow-lg p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-white p-2 rounded-full">
               <ClipboardCheck className="h-8 w-8 text-primary-800" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-wide">DigitAll</h1>
              {kioskHospital && (
                <div className="flex items-center space-x-2 text-primary-200">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium text-sm bg-primary-800 px-2 py-0.5 rounded uppercase tracking-wider">
                    {kioskHospital.nome}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <button 
            onClick={exitKioskMode}
            className="flex items-center space-x-2 bg-primary-800 hover:bg-primary-700 text-white px-4 py-2 rounded border border-primary-700 text-sm transition-colors"
            title="Voltar para painel administrativo"
          >
            <XCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Sair (Modo Admin)</span>
          </button>
        </header>

        {/* Kiosk Content */}
        <main className="flex-1 overflow-hidden p-6 flex flex-col items-center justify-center">
          <div className="w-full max-w-4xl h-full flex flex-col justify-center">
            {children}
          </div>
        </main>
        
        {/* Footer for Kiosk */}
        <footer className="p-4 text-center text-gray-400 text-xs">
          Sistema de Controle de Produção &bull; DigitAll &bull; Modo Quiosque
        </footer>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar for Desktop */}
      <aside className={`bg-primary-900 text-white w-64 flex-shrink-0 hidden md:flex flex-col transition-all duration-300`}>
        <div className="p-6 flex items-center space-x-3 border-b border-primary-800">
          <div className="bg-white p-1 rounded-full">
            <ClipboardCheck className="h-6 w-6 text-primary-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold">DigitAll</h1>
            <p className="text-xs text-primary-300">Controle de Produção</p>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                currentView === item.id 
                  ? 'bg-primary-700 text-white shadow-lg' 
                  : 'text-primary-100 hover:bg-primary-800 hover:text-white'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-primary-800">
          <button 
            onClick={handleLogoutClick}
            className="flex items-center space-x-2 text-primary-200 hover:text-white transition-colors text-sm w-full"
          >
            <LogOut className="h-4 w-4" />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="bg-white shadow-sm md:hidden flex items-center justify-between p-4">
          <div className="flex items-center space-x-2">
            <ClipboardCheck className="h-6 w-6 text-primary-700" />
            <span className="font-bold text-gray-800">DigitAll</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-gray-600">
            <Menu className="h-6 w-6" />
          </button>
        </header>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-primary-900 text-white p-4 space-y-2 absolute w-full z-50">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onChangeView(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg ${
                  currentView === item.id ? 'bg-primary-700' : ''
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            ))}
            <div className="border-t border-primary-800 pt-2 mt-2">
                <button 
                    onClick={handleLogoutClick}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-primary-200 hover:text-white"
                >
                    <LogOut className="h-5 w-5" />
                    <span>Sair</span>
                </button>
            </div>
          </div>
        )}

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
