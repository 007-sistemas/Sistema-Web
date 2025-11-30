
import React, { useState, useEffect, useRef } from 'react';
import { Fingerprint, CheckCircle, AlertCircle, Scan, Usb, Monitor, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { biometryService } from '../services/biometry';
import { SampleFormat } from '../types';

interface ScannerMockProps {
  onScanSuccess: (hash: string) => void;
  onScanError?: (msg: string) => void;
  label?: string;
  isVerifying?: boolean;
}

export const ScannerMock: React.FC<ScannerMockProps> = ({ 
  onScanSuccess, 
  onScanError, 
  label = "Posicione o dedo no leitor",
  isVerifying = false
}) => {
  const [mode, setMode] = useState<'SIMULATOR' | 'DEVICE'>('SIMULATOR');
  const [status, setStatus] = useState<'IDLE' | 'SCANNING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [progress, setProgress] = useState(0);
  const [deviceMessage, setDeviceMessage] = useState<string>('');
  
  // Real Device State
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const isMounted = useRef(true);

  // 1. Verificação Simples e Robusta do SDK
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 50; // Tenta por 5 segundos (50 * 100ms)

    const checkGlobalSdk = setInterval(() => {
      attempts++;
      
      // Verifica se as globais existem no window
      if (window.Fingerprint && window.WebSdk) {
        clearInterval(checkGlobalSdk);
        if (isMounted.current) {
          console.log("SDK Digital Persona detectado via HTML estático.");
          setSdkLoaded(true);
          // Auto-mudar para modo DEVICE se detectar o SDK
          if (mode === 'SIMULATOR') setMode('DEVICE');
        }
      } else if (attempts >= maxAttempts) {
        clearInterval(checkGlobalSdk);
        console.warn("Timeout: SDK não encontrado no objeto window. (Modo Simulação Ativo)");
      }
    }, 100);

    return () => {
      isMounted.current = false;
      clearInterval(checkGlobalSdk);
    };
  }, []);

  // 2. Inicialização do Leitor Físico
  useEffect(() => {
    if (mode === 'DEVICE') {
      if (sdkLoaded) {
        initializeRealDevice();
      } else {
        setDeviceMessage('Aguardando carregamento do SDK...');
      }
    } else {
      // Para o leitor se voltar para o simulador
      biometryService.stopAcquisition().catch(() => {});
      setDeviceMessage('');
      setStatus('IDLE');
    }
  }, [mode, sdkLoaded]);

  const initializeRealDevice = async () => {
    try {
      setDeviceMessage('Conectando ao serviço local...');
      setStatus('IDLE');
      
      // Configura os ouvintes de eventos
      biometryService.setListener({
        onDeviceConnected: (d) => setDeviceMessage('Leitor Conectado! Coloque o dedo.'),
        onDeviceDisconnected: () => setDeviceMessage('Leitor Desconectado. Verifique o USB.'),
        onSamplesAcquired: (s) => {
          setStatus('SUCCESS');
          setDeviceMessage('Leitura realizada!');
          
          if (s.samples && s.samples.length > 0) {
            // Em produção, aqui você enviaria o s.samples[0].data (Base64)
            // Gera um hash visual para simulação
            const rawData = s.samples[0].data || "data";
            const pseudoHash = `bio_${rawData.substring(0, 10)}_${Date.now()}`; 
            
            setTimeout(() => {
              if (isMounted.current) {
                onScanSuccess(pseudoHash);
                setStatus('IDLE');
                setDeviceMessage('Pronto para próxima leitura.');
              }
            }, 500);
          }
        },
        onErrorOccurred: (e) => {
          setStatus('ERROR');
          setDeviceMessage(`Erro Driver: ${e.error}`);
        }
      });

      // Inicia a captura
      await biometryService.startAcquisition(SampleFormat.PngImage);
      setDeviceMessage('Leitor Ativo. Aguardando digital...');
      
    } catch (err: any) {
      setStatus('ERROR');
      console.error(err);
      if (err.message === "SDK_NOT_LOADED") {
         setDeviceMessage('Erro Crítico: SDK JS não carregou.');
      } else {
         setDeviceMessage('Falha de conexão com o Serviço Local.');
      }
    }
  };

  // Lógica do Simulador
  const startScanSimulator = () => {
    if (status === 'SCANNING') return;
    setStatus('SCANNING');
    setProgress(0);
  };

  useEffect(() => {
    let interval: any;
    if (mode === 'SIMULATOR' && status === 'SCANNING') {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setStatus('SUCCESS');
            setTimeout(() => {
              if (isMounted.current) {
                onScanSuccess(`sim_hash_${Math.random().toString(36).substring(7)}`);
                setStatus('IDLE');
                setProgress(0);
              }
            }, 500);
            return 100;
          }
          return prev + 5; 
        });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [status, mode, onScanSuccess]);

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-lg border border-gray-200 max-w-sm mx-auto transition-all">
      
      {/* Botões de Modo */}
      <div className="flex bg-gray-100 p-1 rounded-lg mb-6 w-full">
        <button
          onClick={() => setMode('SIMULATOR')}
          className={`flex-1 flex items-center justify-center py-1.5 text-xs font-medium rounded-md transition-all ${
            mode === 'SIMULATOR' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Monitor className="h-3 w-3 mr-1.5" />
          Simulador
        </button>
        <button
          onClick={() => setMode('DEVICE')}
          className={`flex-1 flex items-center justify-center py-1.5 text-xs font-medium rounded-md transition-all ${
            mode === 'DEVICE' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Usb className="h-3 w-3 mr-1.5" />
          Leitor USB
        </button>
      </div>

      {/* Interface Visual do Sensor */}
      <div 
        onClick={mode === 'SIMULATOR' ? startScanSimulator : undefined}
        className={`relative w-40 h-40 rounded-full flex items-center justify-center border-4 transition-all duration-300 ${
          status === 'IDLE' ? 'border-gray-200 bg-gray-50' :
          status === 'SCANNING' ? 'border-blue-400 bg-blue-50' :
          status === 'SUCCESS' ? 'border-green-500 bg-green-50' :
          'border-red-500 bg-red-50'
        } ${mode === 'SIMULATOR' ? 'cursor-pointer hover:border-primary-400' : ''}`}
      >
        {status === 'IDLE' && (
          mode === 'DEVICE' && !sdkLoaded ? (
            <Loader2 className="w-16 h-16 text-primary-300 animate-spin" />
          ) : (
            <Scan className={`w-16 h-16 ${mode === 'DEVICE' ? 'text-gray-300' : 'text-gray-400'}`} />
          )
        )}
        {status === 'SCANNING' && <Fingerprint className="w-16 h-16 text-blue-500 animate-pulse" />}
        {status === 'SUCCESS' && <CheckCircle className="w-16 h-16 text-green-600" />}
        {status === 'ERROR' && <AlertCircle className="w-16 h-16 text-red-600" />}

        {status === 'SCANNING' && (
          <div 
            className="absolute top-0 left-0 w-full h-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] opacity-80"
            style={{ 
              top: `${progress}%`,
              transition: 'top 0.05s linear' 
            }}
          />
        )}
      </div>

      {/* Mensagens de Status */}
      <div className="mt-4 text-center w-full">
        <h3 className="font-semibold text-gray-800">
          {status === 'SCANNING' ? 'Lendo digital...' : 
           status === 'SUCCESS' ? 'Leitura OK!' : 
           mode === 'DEVICE' ? (sdkLoaded ? deviceMessage : 'Carregando recursos...') : 
           (isVerifying ? 'Toque para identificar' : 'Toque para cadastrar')}
        </h3>
        
        {/* Ajuda para Erro no Dispositivo */}
        {mode === 'DEVICE' && !sdkLoaded && (
            <div className="mt-2 text-[10px] text-red-500 bg-red-50 p-2 rounded">
                Não foi possível carregar o driver (WebSdk).<br/>
                Verifique se os arquivos estão na pasta public/js.
            </div>
        )}

        {mode === 'DEVICE' && status === 'ERROR' && (
          <div className="mt-3 w-full">
            <a 
              href="https://127.0.0.1:9001/connected" 
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full px-3 py-2 bg-red-50 text-red-700 text-xs font-bold rounded border border-red-200 hover:bg-red-100 transition-colors"
            >
              <ExternalLink className="w-3 h-3 mr-2" />
              Testar Conexão Local
            </a>
            <p className="text-[10px] text-gray-400 mt-1">
              Se o link não abrir, o serviço do Windows não está rodando.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
