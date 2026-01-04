
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { StorageService } from './services/storage';
import { syncInitialData } from './services/syncInitial';
import { CooperadoRegister } from './views/CooperadoRegister';
import { BiometriaManager } from './views/BiometriaManager';
import { PontoMachine } from './views/PontoMachine';
import { Dashboard } from './views/Dashboard';
import { AuditLogViewer } from './views/AuditLogViewer';
import { HospitalRegister } from './views/HospitalRegister';
import { RelatorioProducao } from './views/RelatorioProducao';
import { Relatorios } from './views/Relatorios';
import { Management } from './views/Management';
import { Login } from './views/Login';
import { EspelhoBiometria } from './views/EspelhoBiometria'; 
import { AutorizacaoPonto } from './views/AutorizacaoPonto';
import { UserProfile } from './views/UserProfile';

import { SetoresView } from './views/Setores';
import { HospitalPermissions } from './types';


export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userPermissions, setUserPermissions] = useState<HospitalPermissions | null>(null);

  useEffect(() => {
    const checkSdk = setInterval(() => {
      // @ts-ignore
      if (window.Fingerprint) {
        console.log('✅ SDK Biometria detectado (Global).');
        clearInterval(checkSdk);
      }
    }, 1000);
    setTimeout(() => clearInterval(checkSdk), 5000);
    return () => clearInterval(checkSdk);
  }, []);

  useEffect(() => {
    // Sempre sincroniza managers do backend remoto ao iniciar
    (async () => {
      await StorageService.refreshManagersFromRemote();
      await StorageService.refreshCooperadosFromRemote();
      await StorageService.refreshHospitaisFromRemote();

      StorageService.init(); // ainda inicializa seed para outros dados

      const session = StorageService.getSession();
      if (session) {
        setIsAuthenticated(true);
        setUserPermissions(session.permissions);
        if (!session.permissions[currentView as keyof HospitalPermissions]) {
          const firstAllowed = Object.keys(session.permissions).find(k => session.permissions[k as keyof HospitalPermissions]);
          if (firstAllowed) setCurrentView(firstAllowed);
        }

        // Auto-refresh silencioso em sessões ativas
        const interval = setInterval(async () => {
          try {
            await StorageService.refreshHospitaisFromRemote();
            await StorageService.refreshCooperadosFromRemote();
          } catch (err) {
            console.warn('[AUTO-REFRESH] Falha ao atualizar dados:', err);
          }
        }, 120000); // 2 minutos

        return () => clearInterval(interval);
      }
    })();

    // Escuta mudanças na sessão (permissões) via storage events
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'session') {
        const newSession = StorageService.getSession();
        if (newSession) {
          setUserPermissions(newSession.permissions);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleLoginSuccess = (permissions: HospitalPermissions) => {
    setIsAuthenticated(true);
    setUserPermissions(permissions);
    const firstAllowed = Object.keys(permissions).find(k => permissions[k as keyof HospitalPermissions]);
    if (firstAllowed) setCurrentView(firstAllowed);
    else setCurrentView('dashboard');
  };

  const handleLogout = () => {
    StorageService.clearSession();
    setUserPermissions(null);
    setIsAuthenticated(false);
    setCurrentView('dashboard'); 
  };

  const handleChangeView = (view: string) => {
    // Permite acesso à view Setores para todos gestores autenticados
    if (view === 'setores') {
      setCurrentView(view);
      return;
    }
    // Ignora cliques no agrupador "cadastros" (não é uma view real)
    if (view === 'cadastros') {
      return;
    }
    if (userPermissions && userPermissions[view as keyof HospitalPermissions]) {
      setCurrentView(view);
    } else {
      alert("Acesso negado a este módulo.");
    }
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const renderView = () => {
    // Permite acesso à view Setores para todos gestores autenticados
    if (currentView === 'setores') {
      return <SetoresView />;
    }
    if (userPermissions && !userPermissions[currentView as keyof HospitalPermissions]) {
        return <div className="p-10 text-center text-gray-500">Acesso não autorizado.</div>;
    }
    switch(currentView) {
      case 'dashboard': return <Dashboard />;
      case 'ponto': return <PontoMachine />;
      case 'relatorio': return <RelatorioProducao />;
      case 'relatorios': return <Relatorios />;
      case 'espelho': return <EspelhoBiometria />; 
      case 'autorizacao': return <AutorizacaoPonto />;
      case 'cadastro': return <CooperadoRegister />;
      case 'hospitais': return <HospitalRegister />;
      case 'biometria': return <BiometriaManager />;
      case 'auditoria': return <AuditLogViewer />;
      case 'gestao': return <Management />;
      case 'perfil': return <UserProfile />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout 
      currentView={currentView} 
      onChangeView={handleChangeView} 
      onLogout={handleLogout}
      permissions={userPermissions || undefined}
      isKiosk={false} 
    >
      {renderView()}
    </Layout>
  );
}
