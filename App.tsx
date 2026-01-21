import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { StorageService } from './services/storage';
import { syncInitialData } from './services/syncInitial';
import { CooperadoRegister } from './views/CooperadoRegister';
import { Dashboard } from './views/Dashboard';
import { AuditLogViewer } from './views/AuditLogViewer';
import { HospitalRegister } from './views/HospitalRegister';
import { ControleDeProducao } from './views/ControleDeProducao';
import { Relatorios } from './views/Relatorios';
import { Management } from './views/Management';
import { Login } from './views/Login';
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

    // Escuta evento customizado de atualização de permissões (apenas ao salvar)
    const handlePermissionsUpdate = () => {
      const newSession = StorageService.getSession();
      if (newSession) {
        setUserPermissions(newSession.permissions);
      }
    };

    window.addEventListener('permissionsUpdated', handlePermissionsUpdate);
    return () => window.removeEventListener('permissionsUpdated', handlePermissionsUpdate);
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

  // Função de inatividade: desloga após 1 hora sem interação
  useEffect(() => {
    let lastActivity = Date.now();
    const resetTimer = () => { lastActivity = Date.now(); };
    const checkInactivity = setInterval(() => {
      if (isAuthenticated && Date.now() - lastActivity > 3600000) { // 1 hora
        handleLogout();
        alert('Sessão expirada por inatividade. Faça login novamente.');
      }
    }, 60000); // verifica a cada minuto
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);
    return () => {
      clearInterval(checkInactivity);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
    };
  }, [isAuthenticated]);

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
      case 'relatorio': return <ControleDeProducao mode="manager" />;
      case 'relatorios': return <Relatorios />;
      case 'espelho': return <ControleDeProducao mode="cooperado" />;
      case 'autorizacao': return <AutorizacaoPonto />;
      case 'cadastro': return <CooperadoRegister />;
      case 'hospitais': return <HospitalRegister />;
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
