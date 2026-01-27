
import React, { useState, useEffect, useRef } from 'react';
import { Cooperado, TipoPonto, RegistroPonto, Hospital, Setor } from '../types';
import { StorageService } from '../services/storage';
import { apiGet } from '../services/api';
import { ScannerMock } from '../components/ScannerMock';
import { MapPin, LogIn, LogOut, Building2, Layers, AlertCircle } from 'lucide-react';

export const PontoMachine: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [identifiedCooperado, setIdentifiedCooperado] = useState<Cooperado | null>(null);
  const [step, setStep] = useState<'SCAN' | 'SUCCESS'>('SCAN');
  
  // Automatic Action State
  const [determinedAction, setDeterminedAction] = useState<TipoPonto>(TipoPonto.ENTRADA);
  
  // Location Config
  const [hospitais, setHospitais] = useState<Hospital[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('');
  const [selectedSetorId, setSelectedSetorId] = useState<string>('');
  const [availableSetores, setAvailableSetores] = useState<Setor[]>([]);
  const [loadingSetores, setLoadingSetores] = useState(false);

  // Refs para garantir acesso ao estado mais recente dentro do callback de biometria
  const hospitalIdRef = useRef(selectedHospitalId);
  const setorIdRef = useRef(selectedSetorId);

  // User Context
  const [isHospitalUser, setIsHospitalUser] = useState(false);

  // Update Refs on state change
  useEffect(() => {
    hospitalIdRef.current = selectedHospitalId;
  }, [selectedHospitalId]);

  useEffect(() => {
    setorIdRef.current = selectedSetorId;
  }, [selectedSetorId]);

  // Clock Ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load setores when hospital is selected
  useEffect(() => {
    if (!selectedHospitalId) {
      setAvailableSetores([]);
      return;
    }

    const loadSetores = async () => {
      setLoadingSetores(true);
      try {
        const setores = await apiGet<Setor[]>(`hospital-setores?hospitalId=${selectedHospitalId}`);
        
        // Se não houver setores vinculados, usa os 5 padrão para teste
        if (!setores || setores.length === 0) {
          const setoresPadrao: Setor[] = [
            { id: 1, nome: 'UTI' },
            { id: 2, nome: 'Pronto Atendimento' },
            { id: 3, nome: 'Centro Cirúrgico' },
            { id: 4, nome: 'Ambulatório' },
            { id: 5, nome: 'Maternidade' }
          ];
          setAvailableSetores(setoresPadrao);
        } else {
          setAvailableSetores(setores);
        }
      } catch (error) {
        console.error('❌ Erro ao carregar setores:', error);
        // Em caso de erro, usa os setores padrão
        const setoresPadrao: Setor[] = [
          { id: 1, nome: 'UTI' },
          { id: 2, nome: 'Pronto Atendimento' },
          { id: 3, nome: 'Centro Cirúrgico' },
          { id: 4, nome: 'Ambulatório' },
          { id: 5, nome: 'Maternidade' }
        ];
        setAvailableSetores(setoresPadrao);
      } finally {
        setLoadingSetores(false);
      }
    };

    loadSetores();
  }, [selectedHospitalId]);

  useEffect(() => {
    const session = StorageService.getSession();
    const loadedHospitais = StorageService.getHospitais();
    setHospitais(loadedHospitais);

    if (session && session.type === 'HOSPITAL') {
      // Scenario A: User is a Hospital
      setIsHospitalUser(true);
      // The session.user object for HOSPITAL type is the Hospital object itself
      const userHospitalId = session.user.id;
      
      // Verify if the hospital still exists in the loaded list
      const hospitalExists = loadedHospitais.find(h => h.id === userHospitalId);
      
      if (hospitalExists) {
        setSelectedHospitalId(userHospitalId);
      }
    } else {
      // Scenario B: User is Manager/Admin
      setIsHospitalUser(false);
      // Auto-select if only one hospital exists in the system
      if (loadedHospitais.length === 1) {
        setSelectedHospitalId(loadedHospitais[0].id);
      }
    }
  }, []);

  const getSelectedHospital = () => hospitais.find(h => h.id === selectedHospitalId);
  
  // Logic to load sectors: If isHospitalUser, selectedHospitalId is set automatically.
  // If Manager, selectedHospitalId changes via dropdown.
  const currentHospital = getSelectedHospital();

  const getCurrentLocationString = () => {
    const h = getSelectedHospital();
    const s = availableSetores.find(s => s.id.toString() === selectedSetorId);
    if (!h) return "Local não selecionado";
    return `${h.nome} - ${s ? s.nome : 'Setor não selecionado'}`;
  };

  const handleIdentification = (hash: string) => {
    // Usar Refs para validação para evitar problemas de closure stale
    const currentHospitalId = hospitalIdRef.current;
    const currentSetorId = setorIdRef.current;

    console.log('🔍 HandleIdentification chamado:', { hash, currentHospitalId, currentSetorId });

    if (!currentHospitalId) {
        alert("Por favor, selecione a Unidade Hospitalar.");
        return;
    }
    if (!currentSetorId) {
        alert("Por favor, selecione o Setor de atuação.");
        return;
    }

    const allCooperados = StorageService.getCooperados();
    console.log('👥 Cooperados disponíveis:', allCooperados.length);
    
    // Simulate finding user with that hash
    // In a real app, hash matching would happen on backend or secure module
    const found = allCooperados.find(c => c.biometrias.length > 0) || allCooperados[0];
    
    if (found) {
      console.log('✅ Cooperado encontrado:', found.nome);
      setIdentifiedCooperado(found);
      
      // LOGIC: Determine Entry vs Exit automatically
      const last = StorageService.getLastPonto(found.id);
      let nextType = TipoPonto.ENTRADA; // Default to ENTRY
      
      if (last) {
        if (last.tipo === TipoPonto.ENTRADA) {
          nextType = TipoPonto.SAIDA;
        } else if (last.tipo === TipoPonto.SAIDA) {
          nextType = TipoPonto.ENTRADA;
        }
      }

      console.log('📝 Tipo de registro:', nextType);
      setDeterminedAction(nextType);
      
      // Registrar imediatamente
      console.log('🚀 Chamando registerPontoImmediate...');
      registerPontoImmediate(found, nextType, currentHospitalId, currentSetorId, last);

    } else {
      console.log('❌ Nenhum cooperado encontrado');
      alert("Nenhum cooperado identificado ou cadastrado com biometria.");
    }
  };

  const registerPontoImmediate = (
      cooperado: Cooperado, 
      tipo: TipoPonto, 
      hospId: string, 
      setId: string, 
      lastPonto?: RegistroPonto
  ) => {
    console.log('🎯 Iniciando registro:', { cooperado: cooperado.nome, tipo, hospId, setId });
    
    let codigo = Math.floor(100000 + Math.random() * 900000).toString();
    let status: 'Aberto' | 'Fechado' = 'Aberto';
    let relatedId: string | undefined;

    // Recalcular string de local com base nos IDs passados (garantia de consistência)
    const h = hospitais.find(h => h.id === hospId);
    const s = availableSetores.find(s => s.id.toString() === setId);
    const localString = `${h?.nome || ''} - ${s?.nome || ''}`;
    
    console.log('📍 Local identificado:', localString, { hospital: h?.nome, setor: s?.nome });

    // Handle Entry/Exit Pairing
    if (tipo === TipoPonto.SAIDA) {
      status = 'Fechado';
      // If we have a previous open entry, link to it and close it
      if (lastPonto && lastPonto.tipo === TipoPonto.ENTRADA && lastPonto.status === 'Aberto') {
        codigo = lastPonto.codigo;
        relatedId = lastPonto.id;
        
        // Update previous entry
        const updatedEntry = { ...lastPonto, status: 'Fechado' as const };
        StorageService.updatePonto(updatedEntry);
      }
    }

    const novoPonto: RegistroPonto = {
      id: crypto.randomUUID(),
      codigo,
      cooperadoId: cooperado.id,
      cooperadoNome: cooperado.nome,
      timestamp: new Date().toISOString(),
      tipo: tipo,
      local: localString,
      hospitalId: hospId,
      setorId: setId,
      isManual: false,
      status: status,
      relatedId: relatedId
    };

    console.log('💾 Salvando ponto:', novoPonto);
    StorageService.savePonto(novoPonto);
    console.log('✅ Ponto salvo! Mudando para step SUCCESS...');
    setStep('SUCCESS');

    // Reset after 3 seconds
    setTimeout(() => {
      console.log('⏰ Voltando para step SCAN');
      setStep('SCAN');
      setIdentifiedCooperado(null);
      // Keep location selected for convenience
    }, 4000);
  };
  
  // Helper for UI styling based on Action
  const isEntrada = determinedAction === TipoPonto.ENTRADA;

  return (
    <div className="flex items-center justify-center relative p-4 w-full">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
        
        {/* Header - Digital Clock */}
        <div className={`text-white p-6 text-center transition-colors duration-500 ${
          step === 'SUCCESS' 
            ? (isEntrada ? 'bg-green-600' : 'bg-red-600') 
            : 'bg-primary-900'
        }`}>
          <div className="text-5xl md:text-6xl font-mono font-bold tracking-wider">
            {currentTime.toLocaleTimeString('pt-BR')}
          </div>
          <div className="text-white/80 text-lg mt-2 font-light">
            {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 md:p-8">
          
          {step === 'SCAN' && (
            <div className="flex flex-col items-center animate-fade-in space-y-6">
              
              {/* Mandatory Location Selection */}
              <div className="w-full bg-primary-50 p-6 rounded-xl border border-primary-100 space-y-4">
                
                {/* HOSPITAL SELECTION LOGIC */}
                {isHospitalUser ? (
                   // Scenario A: Hospital User - Static Text
                   <div className="pb-2 border-b border-primary-200">
                      <div className="flex items-center space-x-2 text-primary-800 font-semibold mb-1">
                        <Building2 className="h-5 w-5" />
                        <h3 className="uppercase text-xs tracking-wider">Local de Produção</h3>
                      </div>
                      <div className="text-lg font-bold text-gray-900 ml-7">
                        {currentHospital ? currentHospital.nome : 'Hospital não encontrado'}
                      </div>
                   </div>
                ) : (
                  // Scenario B: Manager - Dropdown
                  <>
                    <div className="flex items-center space-x-2 text-primary-800 font-semibold border-b border-primary-200 pb-2">
                      <MapPin className="h-5 w-5" />
                      <h3>Local de Produção</h3>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> Unidade Hospitalar
                      </label>
                      <select 
                        className="w-full bg-white border border-gray-300 text-gray-800 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 outline-none"
                        value={selectedHospitalId}
                        onChange={(e) => {
                          setSelectedHospitalId(e.target.value);
                          setSelectedSetorId('');
                        }}
                      >
                        <option value="">Selecione o Hospital...</option>
                        {hospitais.map(h => (
                          <option key={h.id} value={h.id}>{h.nome}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                    <Layers className="h-3 w-3" /> Setor / Ala
                  </label>
                  <select 
                    className="w-full bg-white border border-gray-300 text-gray-800 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                    value={selectedSetorId}
                    onChange={(e) => setSelectedSetorId(e.target.value)}
                    disabled={!selectedHospitalId}
                  >
                    <option value="">
                      {!selectedHospitalId ? 'Selecione Hospital Primeiro' : loadingSetores ? 'Carregando setores...' : 'Selecione o Setor...'}
                    </option>
                    {availableSetores.map(s => (
                      <option key={s.id} value={s.id.toString()}>{s.nome}</option>
                    ))}
                  </select>
                </div>

                {hospitais.length === 0 && (
                   <div className="flex items-center text-xs text-amber-600 bg-amber-50 p-2 rounded">
                     <AlertCircle className="h-4 w-4 mr-1" />
                     <span>Nenhum hospital cadastrado no sistema.</span>
                   </div>
                )}
              </div>

              {/* Biometric Scanner */}
              <div className={(!selectedHospitalId || !selectedSetorId) ? 'opacity-50 pointer-events-none grayscale transition-all' : 'transition-all'}>
                <ScannerMock 
                  onScanSuccess={handleIdentification} 
                  isVerifying={true}
                  label={(!selectedHospitalId || !selectedSetorId) ? "Selecione o setor para liberar" : "Coloque o dedo para registrar"}
                  allowSimulation={!isHospitalUser} 
                />
              </div>
              
              {(!selectedHospitalId || !selectedSetorId) && (
                <p className="text-red-500 text-sm font-medium animate-pulse">
                  ⚠ Selecione o Setor acima para habilitar o leitor.
                </p>
              )}
            </div>
          )}

          {step === 'SUCCESS' && (
            <div className="flex flex-col items-center justify-center h-80 animate-bounce-in text-center">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-xl ${
                isEntrada ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {isEntrada ? (
                   <LogIn className="h-12 w-12 text-green-600" />
                ) : (
                   <LogOut className="h-12 w-12 text-red-600" />
                )}
              </div>
              
              <h3 className="text-3xl font-bold text-gray-800">
                {isEntrada ? 'ENTRADA REGISTRADA' : 'SAÍDA REGISTRADA'}
              </h3>
              
              {identifiedCooperado && (
                <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200 w-full max-w-sm shadow-sm animate-fade-in">
                   <p className="font-bold text-xl text-gray-800">{identifiedCooperado.nome}</p>
                   <p className="text-gray-500 text-sm">{identifiedCooperado.categoriaProfissional}</p>
                   <div className="mt-3 text-xs text-gray-400 border-t border-gray-200 pt-2 flex items-center justify-center">
                      <MapPin className="h-3 w-3 mr-1" />
                      {getCurrentLocationString()}
                   </div>
                </div>
              )}
              
              <p className="text-gray-400 text-xs mt-6">A tela retornará automaticamente em alguns segundos...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
