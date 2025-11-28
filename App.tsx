import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { StorageService } from './services/storage';
import { CooperadoRegister } from './views/CooperadoRegister';
import { BiometriaManager } from './views/BiometriaManager';
import { PontoMachine } from './views/PontoMachine';
import { Dashboard } from './views/Dashboard';
import { AuditLogViewer } from './views/AuditLogViewer';
import { HospitalRegister } from './views/HospitalRegister';
import { RelatorioProducao } from './views/RelatorioProducao';
import { Management } from './views/Management';
import { Login } from './views/Login';
import { HospitalPermissions } from './types';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userPermissions, setUserPermissions] = useState<HospitalPermissions | null>(null);
  
  useEffect(() => {
    // Initialize mock DB
    StorageService.init();

    // Check Session
    const session = StorageService.getSession();
    if (session) {
      setIsAuthenticated(true);
      setUserPermissions(session.permissions);
      
      // If current view is not allowed, redirect to first allowed view
      if (!session.permissions[currentView as keyof HospitalPermissions]) {
        // Find first true permission
        const firstAllowed = Object.keys(session.permissions).find(k => session.permissions[k as keyof HospitalPermissions]);
        if (firstAllowed) {
            setCurrentView(firstAllowed);
        }
      }
    }
  }, []);

  const handleLoginSuccess = (permissions: HospitalPermissions) => {
    setIsAuthenticated(true);
    setUserPermissions(permissions);
    
    // Redirect to first allowed view
    const firstAllowed = Object.keys(permissions).find(k => permissions[k as keyof HospitalPermissions]);
    if (firstAllowed) {
        setCurrentView(firstAllowed);
    } else {
        setCurrentView('dashboard'); // Fallback
    }
  };

  const handleChangeView = (view: string) => {
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
    // Route Guard
    if (userPermissions && !userPermissions[currentView as keyof HospitalPermissions]) {
        return <div className="p-10 text-center text-gray-500">Acesso não autorizado.</div>;
    }

    switch(currentView) {
      case 'dashboard': return <Dashboard />;
      case 'ponto': return <PontoMachine />;
      case 'relatorio': return <RelatorioProducao />;
      case 'cadastro': return <CooperadoRegister />;
      case 'hospitais': return <HospitalRegister />;
      case 'biometria': return <BiometriaManager />;
      case 'auditoria': return <AuditLogViewer />;
      case 'gestao': return <Management />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout 
      currentView={currentView} 
      onChangeView={handleChangeView} 
      permissions={userPermissions || undefined}
      isKiosk={false} 
    >
      {renderView()}
    </Layout>
  );
}