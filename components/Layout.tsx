
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
  FileClock,
  CheckSquare,
  Wrench
} from 'lucide-react';
import { Hospital, HospitalPermissions } from '../types';
import { StorageService } from '../services/storage';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onChangeView: (view: string) => void;
  onLogout: () => void;
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
  const [isCadastrosOpen, setIsCadastrosOpen] = React.useState(true);
  const [preferences, setPreferences] = React.useState<any>(null);
  const [pendentesCount, setPendentesCount] = React.useState(0);

  const applyPreferences = (prefs: any) => {
    if (!prefs) return;
    // Aplicar tema
    if (prefs.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (prefs.theme === 'light') {
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
    // Aplicar cor primária
    if (prefs.primaryColor) {
      document.documentElement.style.setProperty('--primary-color', prefs.primaryColor);
    }
  };

  React.useEffect(() => {
    // Sempre aplica preferências ao montar e ao mudar de sessão
    const applyUserPrefs = () => {
      const prefs = StorageService.getUserPreferences();
      if (prefs) {
        setPreferences(prefs);
        applyPreferences(prefs);
      }
    };
    applyUserPrefs();
    // Também escuta mudanças de sessão/localStorage
    window.addEventListener('storage', applyUserPrefs);
    return () => window.removeEventListener('storage', applyUserPrefs);
  }, []);

  // Contar justificativas pendentes (Neon com fallback local)
  React.useEffect(() => {
    const countPendentes = async () => {
      try {
        const remoteRaw = await (await import('../services/api')).apiGet<any[]>('sync?action=list_justificativas');
        const remote = remoteRaw.map(j => j.status === 'Aguardando autorização' ? { ...j, status: 'Pendente' } : j);
        const pending = remote.filter(j => j.status === 'Pendente');
        setPendentesCount(pending.length);
      } catch (err) {
        const all = StorageService.getJustificativas();
        const pending = all.filter(j => j.status === 'Pendente');
        setPendentesCount(pending.length);
      }
    };
    
    countPendentes();
    // Recarregar a cada 5 segundos para atualizar badge em tempo real
    const interval = setInterval(countPendentes, 5000);
    return () => clearInterval(interval);
  }, []);

  // Itens de Cadastros
  const cadastroNavItems = [
    { id: 'cadastro', label: 'Cooperados', icon: Users, permissionKey: 'cadastro' },
    { id: 'gestao', label: 'Gestão de Usuários', icon: Briefcase, permissionKey: 'gestao' },
    { id: 'hospitais', label: 'Hospitais', icon: Building2, permissionKey: 'hospitais' },
    { id: 'setores', label: 'Setores', icon: ShieldCheck, permissionKey: 'setores' },
  ].sort((a, b) => a.label.localeCompare(b.label));

  // Menu principal (exceto perfil e cadastros)
  const mainNavItems = [
    { id: 'autorizacao', label: 'Justificativa de Plantão', icon: CheckSquare, permissionKey: 'autorizacao' },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permissionKey: 'dashboard' },
    { id: 'espelho', label: 'Espelho da Biometria', icon: FileClock, permissionKey: 'espelho' },
    { id: 'relatorio', label: 'Controle de Produção', icon: FileText, permissionKey: 'relatorio' },
    { id: 'relatorios', label: 'Relatórios', icon: FileText, permissionKey: 'relatorios' },
  ];

  // Agrupador Cadastros como item de menu
  const cadastrosGroup = {
    id: 'cadastros',
    label: 'Cadastros',
    icon: (props: any) => (
      <span className="inline-flex items-center"><svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-folder"><path d="M3 7a2 2 0 0 1 2-2h3.17a2 2 0 0 1 1.41.59l1.83 1.83A2 2 0 0 0 13.83 8H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg></span>)
  };

  // Perfil sempre por último
  const perfilNavItem = { id: 'perfil', label: 'Meu Perfil', icon: Wrench, permissionKey: 'perfil' };

  // Recalcula items quando permissions mudam
  const [navItems, setNavItems] = React.useState<any[]>([]);
  const [cadastrosItems, setCadastrosItems] = React.useState<any[]>([]);
  const [showPerfil, setShowPerfil] = React.useState(true);

  React.useEffect(() => {
    const filtered = mainNavItems.filter(item => {
      // Sem permissões definidas, não mostrar nada (mais seguro)
      if (!permissions) return false;
      return permissions[item.permissionKey as keyof HospitalPermissions] === true;
    });

    const cadastroFiltered = cadastroNavItems.filter(item => {
      // Sem permissões definidas, não mostrar nada (mais seguro)
      if (!permissions) return false;
      return permissions[item.permissionKey as keyof HospitalPermissions] === true;
    });

    // Só adiciona o agrupador Cadastros se houver pelo menos um subitem visível
    if (cadastroFiltered.length > 0) {
      setNavItems([...filtered, cadastrosGroup].sort((a, b) => a.label.localeCompare(b.label)));
    } else {
      setNavItems(filtered.sort((a, b) => a.label.localeCompare(b.label)));
    }

    setCadastrosItems(cadastroFiltered);
    setShowPerfil(!permissions || permissions[perfilNavItem.permissionKey as keyof HospitalPermissions]);
  }, [permissions]);

  // Não aplicar preferências de abas para o agrupador Cadastros nem seus subitens

  const exitKioskMode = () => {
    window.location.search = '';
  };

  const handleLogoutClick = () => {
    onLogout();
  };

  if (isKiosk) {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
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

        <main className="flex-1 overflow-hidden p-6 flex flex-col items-center justify-center">
          <div className="w-full max-w-4xl h-full flex flex-col justify-center">
            {children}
          </div>
        </main>
        
        <footer className="p-4 text-center text-gray-400 text-xs">
          Sistema de Controle de Produção &bull; Idev &bull; Modo Quiosque
        </footer>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className={`bg-primary-900 text-white w-64 flex-shrink-0 hidden md:flex flex-col transition-all duration-300`}>
        <div className="p-1 flex items-center justify-center border-b border-primary-700">
          <img src="/iDev Logo Branco.png" alt="Idev" className="h-32 w-auto" />
        </div>

        {/* Menu Cadastros agrupado, mas alinhado com os demais */}
        <nav className="flex-1 px-4 py-0.5 space-y-1 overflow-y-auto">
          {navItems.map((item) =>
            item.id !== 'cadastros' ? (
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
                <span className="flex-1 text-left">{item.label}</span>
                {item.id === 'autorizacao' && pendentesCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {pendentesCount}
                  </span>
                )}
              </button>
            ) : (
              <div key="cadastros">
                <button
                  className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold text-lg transition-colors focus:outline-none text-primary-100 hover:bg-primary-800 hover:text-white"
                  onClick={() => setIsCadastrosOpen((v) => !v)}
                  aria-expanded={isCadastrosOpen}
                  aria-controls="cadastros-submenu"
                  style={{marginLeft: 0}}
                >
                  <cadastrosGroup.icon />
                  <span className="flex-1 text-left">Cadastros</span>
                  <svg className={`h-4 w-4 transform transition-transform ${isCadastrosOpen ? '' : '-rotate-90'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
                </button>
                {isCadastrosOpen && (
                  <div className="space-y-1" id="cadastros-submenu">
                    {cadastrosItems.map((subitem) => (
                      <button
                        key={subitem.id}
                        onClick={() => onChangeView(subitem.id)}
                        className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${
                          currentView === subitem.id 
                            ? 'bg-primary-700 text-white shadow-lg' 
                            : 'text-primary-100 hover:bg-primary-800 hover:text-white'
                        }`}
                      >
                        <subitem.icon className="h-5 w-5" />
                        <span>{subitem.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
          {/* Meu Perfil sempre por último */}
          {showPerfil && (
            <button
              key={perfilNavItem.id}
              onClick={() => onChangeView(perfilNavItem.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors mt-6 ${
                currentView === perfilNavItem.id 
                  ? 'bg-primary-700 text-white shadow-lg' 
                  : 'text-primary-100 hover:bg-primary-800 hover:text-white'
              }`}
            >
              <perfilNavItem.icon className="h-5 w-5" />
              <span>{perfilNavItem.label}</span>
            </button>
          )}
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

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm md:hidden flex items-center justify-between p-4">
          <div className="flex items-center space-x-2">
            <ClipboardCheck className="h-6 w-6 text-primary-700" />
            <span className="font-bold text-gray-800">Idev</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-gray-600">
            <Menu className="h-6 w-6" />
          </button>
        </header>

        {isMobileMenuOpen && (
          <div className="md:hidden bg-primary-900 text-white p-4 space-y-2 absolute w-full z-50">
            {navItems.map((item) => 
              item.id !== 'cadastros' ? (
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
              ) : (
                <div key="cadastros">
                  <button
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold transition-colors focus:outline-none text-primary-100 hover:bg-primary-800 hover:text-white"
                    onClick={() => setIsCadastrosOpen((v) => !v)}
                    aria-expanded={isCadastrosOpen}
                    aria-controls="cadastros-submenu-mobile"
                  >
                    <cadastrosGroup.icon />
                    <span className="flex-1 text-left">Cadastros</span>
                    <svg className={`h-4 w-4 transform transition-transform ${isCadastrosOpen ? '' : '-rotate-90'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
                  </button>
                  {isCadastrosOpen && (
                    <div className="space-y-1 pl-4" id="cadastros-submenu-mobile">
                      {cadastrosItems.map((subitem) => (
                        <button
                          key={subitem.id}
                          onClick={() => {
                            onChangeView(subitem.id);
                            setIsMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${
                            currentView === subitem.id 
                              ? 'bg-primary-700 text-white shadow-lg' 
                              : 'text-primary-100 hover:bg-primary-800 hover:text-white'
                          }`}
                        >
                          <subitem.icon className="h-5 w-5" />
                          <span>{subitem.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
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

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
