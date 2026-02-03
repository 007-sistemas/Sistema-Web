
import React, { useState, useEffect } from 'react';
import { Cooperado, Biometria } from '../types';
import { StorageService } from '../services/storage';
import { apiGet, apiDelete, syncToNeon } from '../services/api';
import { ScannerMock } from '../components/ScannerMock';
import { BiometricCapture } from './BiometricCapture'; // Importando a view de diagnóstico como componente
import { Trash2, AlertTriangle, Fingerprint, Users, Activity } from 'lucide-react';

export const BiometriaManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'gestao' | 'diagnostico'>('gestao');
  const [cooperados, setCooperados] = useState<Cooperado[]>([]);
  const [selectedCooperadoId, setSelectedCooperadoId] = useState<string>('');
  const [biometriasNeon, setBiometriasNeon] = useState<Biometria[]>([]);
  const [loadingBio, setLoadingBio] = useState(false);
  
  useEffect(() => {
    setCooperados(StorageService.getCooperados());
  }, []);

  // Buscar biometrias do Neon ao selecionar cooperado
  useEffect(() => {
    if (!selectedCooperadoId) {
      setBiometriasNeon([]);
      return;
    }
    setLoadingBio(true);
    apiGet<any[]>('biometrics')
      .then((rows) => {
        const mapped = Array.isArray(rows)
          ? rows.filter((b) => String(b.cooperado_id).trim().toLowerCase() === String(selectedCooperadoId).trim().toLowerCase())
              .map((b) => ({
                id: b.id,
                fingerIndex: b.finger_index ?? 0,
                hash: b.hash ?? '',
                createdAt: b.created_at ?? '',
              }))
          : [];
        setBiometriasNeon(mapped);
      })
      .finally(() => setLoadingBio(false));
  }, [selectedCooperadoId]);

  const selectedCooperado = cooperados.find(c => c.id === selectedCooperadoId);

  const handleScanSuccess = (hash: string) => {
    if (!selectedCooperado) return;
    // ...código existente para cadastro local...
    // Após cadastrar localmente, forçar refresh das biometrias do Neon
    setTimeout(() => {
      apiGet<any[]>('biometrics')
        .then((rows) => {
          const mapped = rows
            .filter((b) => String(b.cooperado_id).trim().toLowerCase() === String(selectedCooperadoId).trim().toLowerCase())
            .map((b) => ({
              id: b.id,
              fingerIndex: b.finger_index ?? 0,
              hash: b.hash ?? '',
              createdAt: b.created_at ?? '',
            }));
          setBiometriasNeon(mapped);
        });
    }, 1000);
  };

  const deleteBiometria = async (bioId: string) => {
    if (!selectedCooperado) return;
    if (!confirm('Remover esta digital? Esta ação é irreversível.')) return;
    try {
      await apiDelete('biometrics', { id: bioId });
      setBiometriasNeon((prev) => prev.filter((b) => b.id !== bioId));
    } catch (err) {
      alert('Erro ao remover biometria do banco Neon.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Fingerprint className="h-8 w-8 text-primary-600" />
          <div>
             <h2 className="text-2xl font-bold text-gray-800">Biometria & Hardware</h2>
             <p className="text-gray-500">Cadastros e diagnósticos dos leitores</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white p-1 rounded-lg border border-gray-200 flex shadow-sm">
            <button
                onClick={() => setActiveTab('gestao')}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'gestao' 
                    ? 'bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-200' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
            >
                <Users className="h-4 w-4 mr-2" />
                Gestão de Cadastro
            </button>
            <button
                onClick={() => setActiveTab('diagnostico')}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'diagnostico' 
                    ? 'bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-200' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
            >
                <Activity className="h-4 w-4 mr-2" />
                Diagnóstico Técnico
            </button>
        </div>
      </div>


      {activeTab === 'diagnostico' ? (
          <div className="animate-fade-in">
              <BiometricCapture />
          </div>
      ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
            {/* Selection Column */}
            <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
              <label className="block text-sm font-medium text-gray-700 mb-2">Selecione o Cooperado</label>
              <select 
                className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
                value={selectedCooperadoId}
                onChange={(e) => setSelectedCooperadoId(e.target.value)}
              >
                <option value="">-- Selecione --</option>
                {cooperados.map(c => (
                  <option key={c.id} value={c.id}>{c.nome} ({c.matricula})</option>
                ))}
              </select>
              
              {selectedCooperado && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <h4 className="font-semibold text-gray-800">{selectedCooperado.nome}</h4>
                  <p className="text-sm text-gray-500">{selectedCooperado.categoriaProfissional}</p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-gray-600">Digitais cadastradas:</span>
                    <span className="font-bold bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                      {selectedCooperado.biometrias.length}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Column */}
            <div className="lg:col-span-2 space-y-6">
              {!selectedCooperado ? (
                <div className="h-64 flex flex-col items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 text-gray-400">
                  <Fingerprint className="h-12 w-12 mb-2 opacity-50" />
                  <p>Selecione um cooperado para gerenciar digitais</p>
                </div>
              ) : (
                <>
                  {/* Enrollment Area */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Nova Leitura</h3>
                    <div className="flex flex-col md:flex-row items-center gap-8">
                      <ScannerMock 
                        onScanSuccess={handleScanSuccess} 
                        label="Clique no sensor para capturar"
                        allowSimulation={true} // Habilitado para gestores testarem/simularem
                      />
                      <div className="text-sm text-gray-600 space-y-2 max-w-xs">
                        <p className="flex items-start">
                          <AlertTriangle className="h-4 w-4 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
                          Certifique-se que o sensor esteja limpo.
                        </p>
                        <p>O sistema armazena apenas um hash criptografado, não a imagem da digital.</p>
                      </div>
                    </div>
                  </div>

                  {/* List of Registered Fingerprints */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                     <h3 className="text-lg font-semibold text-gray-800 mb-4">Digitais Ativas</h3>
                     {loadingBio ? (
                       <p className="text-gray-500 italic">Carregando digitais...</p>
                     ) : biometriasNeon.length === 0 ? (
                       <p className="text-gray-500 italic">Nenhuma biometria cadastrada.</p>
                     ) : (
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         {biometriasNeon.map((bio, index) => (
                           <div key={bio.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                             <div className="flex items-center space-x-3">
                               <div className="bg-white p-2 rounded-full border border-gray-100 shadow-sm">
                                 <Fingerprint className="h-5 w-5 text-primary-600" />
                               </div>
                               <div>
                                 <p className="text-sm font-medium text-gray-900">Digital #{index + 1}</p>
                                 <p className="text-xs text-gray-500 text-ellipsis overflow-hidden w-24">Hash: {bio.hash.substring(0, 8)}...</p>
                               </div>
                             </div>
                             <button 
                               onClick={() => deleteBiometria(bio.id)}
                               className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded transition-colors"
                               title="Remover digital"
                             >
                               <Trash2 className="h-4 w-4" />
                             </button>
                           </div>
                         ))}
                       </div>
                     )}
                  </div>
                </>
              )}
            </div>
          </div>
      )}
    </div>
  );
};
