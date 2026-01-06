
import React, { useState, useEffect, useRef } from 'react';
import { Fingerprint, CheckCircle, AlertCircle, Loader2, ExternalLink, Usb, MousePointer2 } from 'lucide-react';
import { biometryService } from '../services/biometry';
import { SampleFormat } from '../types';

interface ScannerMockProps {
  onScanSuccess: (hash: string) => void;
  onScanError?: (msg: string) => void;
  label?: string;
  isVerifying?: boolean;
  allowSimulation?: boolean; // Nova prop para controlar visibilidade do simulador
}

export const ScannerMock: React.FC<ScannerMockProps> = ({ 
  onScanSuccess, 
  onScanError, 
  label = "Posicione o dedo no leitor",
  isVerifying = false,
  allowSimulation = false
}) => {
  // Forçamos modo simulação por padrão e removemos opção de USB
  const [mode, setMode] = useState<'DEVICE' | 'SIMULATION'>('SIMULATION');
  
  const [status, setStatus] = useState<'IDLE' | 'SCANNING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [deviceMessage, setDeviceMessage] = useState<string>('Inicializando...');
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [fingerImage, setFingerImage] = useState<string | null>(null);
  
  const isMounted = useRef(true);
  
  // Refs para callbacks
  const onScanSuccessRef = useRef(onScanSuccess);
  const onScanErrorRef = useRef(onScanError);

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  useEffect(() => {
    onScanErrorRef.current = onScanError;
  }, [onScanError]);


  // 1. Detectar SDK Globalmente
  useEffect(() => {
    const checkSdk = setInterval(() => {
      if (biometryService.isSdkLoaded()) {
        clearInterval(checkSdk);
        if (isMounted.current) {
          setSdkLoaded(true);
        }
      }
    }, 1000);
    return () => { isMounted.current = false; clearInterval(checkSdk); };
  }, []);

  // 2. Inicialização do Leitor Físico (Apenas no modo DEVICE)
  useEffect(() => {
    if (mode === 'DEVICE') {
      if (sdkLoaded) {
        initializeRealDevice();
      } else {
        setDeviceMessage('Aguardando Drivers...');
      }
    } else {
        // Se mudou para simulação, parar qualquer aquisição em andamento
        biometryService.stopAcquisition().catch(() => {});
        setDeviceMessage('Modo Simulação Ativo');
        setStatus('IDLE');
    }
    
    return () => {
      if (mode === 'DEVICE') biometryService.stopAcquisition().catch(() => {});
    };
  }, [mode, sdkLoaded]);

  const initializeRealDevice = async () => {
    try {
      setDeviceMessage('Buscando leitor...');
      setStatus('IDLE');
      
      biometryService.setListener({
        onDeviceConnected: () => setDeviceMessage('Leitor Conectado.'),
        onDeviceDisconnected: () => {
            setDeviceMessage('Leitor Desconectado.');
            setStatus('ERROR');
        },
        onSamplesAcquired: (s: any) => {
          setStatus('SUCCESS');
          setDeviceMessage('Leitura OK!');
          
          if (s.samples) {
            if (typeof s.samples === 'string' && s.samples.startsWith('data:image')) {
                setFingerImage(s.samples);
            }
            
            const simulatedHash = `BIO_HASH_${s.samples.length}_${Date.now()}`;
            
            setTimeout(() => {
              if (isMounted.current) {
                onScanSuccessRef.current(simulatedHash);
                setStatus('IDLE');
                setFingerImage(null); 
                setDeviceMessage('Pronto. Posicione o dedo.');
              }
            }, 800);
          }
        },
        onErrorOccurred: (e: any) => {
          setStatus('ERROR');
          const msg = e.message || "Erro desconhecido no leitor";
          setDeviceMessage(msg);
          if (onScanErrorRef.current) onScanErrorRef.current(msg);
        }
      });

      await biometryService.startAcquisition(SampleFormat.PngImage);
      setDeviceMessage('Aguardando dedo...');

    } catch (err: any) {
      console.error(err);
      setStatus('ERROR');
      if (err.message === "NO_DEVICE_FOUND") {
          setDeviceMessage("Nenhum leitor encontrado.");
      } else if (err.message === "SDK_NOT_LOADED") {
          setDeviceMessage("Driver não carregado.");
      } else {
          setDeviceMessage("Erro ao iniciar.");
      }
    }
  };

  // Lógica do Simulador
  const handleSimulatedScan = () => {
    if (mode !== 'SIMULATION' || status === 'SUCCESS') return;
    
    setStatus('SCANNING');
    setDeviceMessage('Simulando leitura...');
    
    setTimeout(() => {
      setStatus('SUCCESS');
      setDeviceMessage('Leitura OK (Simulada)');
      // Hash fixo para facilitar testes de managers
      const mockHash = "simulated_hash_xyz"; 
      
      setTimeout(() => {
          if (isMounted.current) {
            onScanSuccessRef.current(mockHash);
            setStatus('IDLE');
            setDeviceMessage('Modo Simulação Ativo');
          }
      }, 1000);
    }, 1500);
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-lg border border-gray-200 max-w-sm mx-auto transition-all">
      
      {/* Toggle de Modo removido: apenas simulador visível */}
      {allowSimulation && (
        <div className="flex bg-gray-100 p-1 rounded-lg mb-4 w-full max-w-[200px]">
          <button 
            onClick={() => setMode('SIMULATION')}
            className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${mode === 'SIMULATION' ? 'bg-white shadow text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Simulador
          </button>
        </div>
      )}

      {/* Header Visual Compacto */}
      <div className={`flex items-center space-x-2 text-gray-500 mb-4 bg-gray-50 px-3 py-1 rounded-full border border-gray-100 ${allowSimulation ? '' : 'mt-2'}`}>
        <MousePointer2 className="h-4 w-4 text-blue-500" />
        <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
          Clique para Simular
        </span>
      </div>

      {/* Interface Visual do Sensor */}
      <div 
        onClick={mode === 'SIMULATION' ? handleSimulatedScan : undefined}
        className={`relative w-40 h-40 rounded-xl flex items-center justify-center border-2 transition-all duration-300 overflow-hidden ${
          mode === 'SIMULATION' ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'
        } ${
          status === 'IDLE' ? (mode === 'SIMULATION' ? 'border-blue-300 border-dashed bg-white' : 'border-gray-200 bg-gray-50') :
          status === 'SCANNING' ? 'border-blue-400 bg-blue-50' :
          status === 'SUCCESS' ? 'border-green-500 bg-green-50' :
          'border-red-500 bg-red-50'
        }`}
      >
        {fingerImage ? (
            <img src={fingerImage} alt="Fingerprint" className="w-full h-full object-contain p-2 opacity-90" />
        ) : (
            <>
                {status === 'IDLE' && (
                     <Fingerprint className={`w-16 h-16 ${mode === 'SIMULATION' ? 'text-blue-300' : 'text-primary-400 animate-pulse'}`} />
                )}
                {status === 'SCANNING' && <Fingerprint className="w-16 h-16 text-blue-500 animate-pulse" />}
                {status === 'SUCCESS' && <CheckCircle className="w-16 h-16 text-green-600" />}
                {status === 'ERROR' && <AlertCircle className="w-16 h-16 text-red-600" />}
            </>
        )}
        
        {mode === 'SIMULATION' && status === 'IDLE' && (
            <span className="absolute bottom-2 text-[10px] text-blue-400 font-bold uppercase tracking-wider">Clique Aqui</span>
        )}
      </div>

      {/* Mensagens de Status */}
      <div className="mt-4 text-center w-full">
        <h3 className={`font-semibold break-words px-2 text-sm min-h-[1.25rem] ${status === 'ERROR' ? 'text-red-600' : 'text-gray-800'}`}>
          {status === 'SCANNING' ? 'Lendo digital...' : 
           status === 'SUCCESS' ? 'Leitura OK!' : 
           deviceMessage}
        </h3>
        
        {mode === 'DEVICE' && (status === 'ERROR' || !sdkLoaded) && (
          <div className="mt-3 w-full space-y-2 animate-fade-in">
            {!sdkLoaded && (
               <p className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded border border-amber-100 flex items-center justify-center gap-1">
                 <Loader2 className="h-3 w-3 animate-spin" /> Verificando drivers...
               </p>
            )}
            <a 
              href="https://127.0.0.1:52181/get_connection" 
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full px-3 py-2 bg-gray-50 text-gray-700 text-xs font-bold rounded border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              <ExternalLink className="w-3 h-3 mr-2" />
              Verificar Conexão USB
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
