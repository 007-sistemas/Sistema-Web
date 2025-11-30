
import React, { useEffect, useRef, useState } from 'react';
import { Fingerprint, Play, Square, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

export const BiometricCapture: React.FC = () => {
  // Estados
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [status, setStatus] = useState<string>('Inicializando...');
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [fingerprintImage, setFingerprintImage] = useState<string | null>(null);
  const [quality, setQuality] = useState<string>('');
  const [format, setFormat] = useState<number>(5); // PngImage = 5

  // Referência para a instância do leitor (para não recriar a cada render)
  const readerRef = useRef<any>(null);

  useEffect(() => {
    // 1. Verifica se os scripts globais foram carregados (injetados pelo index.html)
    const checkSdk = setInterval(() => {
      if (typeof window.Fingerprint !== 'undefined') {
        clearInterval(checkSdk);
        setSdkLoaded(true);
        initializeReader();
      }
    }, 500);

    // Timeout de segurança
    setTimeout(() => clearInterval(checkSdk), 10000);

    return () => {
      clearInterval(checkSdk);
      stopCapture(); // Garante parada ao desmontar
    };
  }, []);

  const initializeReader = () => {
    try {
      setStatus('Carregando WebApi...');
      // Instancia a classe WebApi do SDK Global
      readerRef.current = new window.Fingerprint.WebApi();
      const reader = readerRef.current;

      if (!reader) {
        setStatus('Erro: Falha ao instanciar WebApi.');
        return;
      }

      // Configuração dos Event Listeners do SDK
      reader.onDeviceConnected = (e: any) => {
        setDeviceConnected(true);
        setStatus('Leitor Conectado (Pronto)');
        console.log("Device Connected:", e);
      };

      reader.onDeviceDisconnected = (e: any) => {
        setDeviceConnected(false);
        setIsCapturing(false);
        setStatus('Leitor Desconectado');
        console.log("Device Disconnected:", e);
      };

      reader.onSamplesAcquired = (e: any) => {
        console.log("Samples Acquired:", e);
        setStatus('Amostra Capturada');
        
        if (e.samples && e.samples.length > 0) {
          // O SDK retorna Base64Url (seguro para URL), precisamos converter para Base64 padrão para exibir na tag <img>
          const rawData = e.samples[0].Data;
          // Usa a função utilitária do próprio SDK se disponível, ou fallback
          const base64Data = window.Fingerprint.b64UrlTo64 ? window.Fingerprint.b64UrlTo64(rawData) : rawData;
          
          setFingerprintImage(`data:image/png;base64,${base64Data}`);
        }
      };

      reader.onQualityReported = (e: any) => {
        setQuality(window.Fingerprint.QualityCode[e.quality] || `Q:${e.quality}`);
      };

      reader.onErrorOccurred = (e: any) => {
        console.error("SDK Error:", e);
        setIsCapturing(false);
        setStatus(`Erro no Leitor: ${e.error}`);
      };

      setStatus('SDK Carregado. Aguardando conexão...');
      
      // Tenta listar dispositivos para forçar checagem
      reader.enumerateDevices().then((devices: any) => {
          if (devices.length > 0) {
              setDeviceConnected(true);
              setStatus(`Leitor Encontrado (${devices.length})`);
          } else {
              setStatus('Nenhum leitor detectado. Verifique o USB.');
          }
      }).catch((err: any) => {
          setStatus('Erro ao listar dispositivos. O serviço está rodando?');
      });

    } catch (err) {
      console.error(err);
      setStatus('Erro Crítico ao iniciar SDK.');
    }
  };

  const startCapture = async () => {
    if (!readerRef.current) return;

    try {
      // Formato 5 = PngImage (Ideal para visualização)
      // Formato 2 = Intermediate (Ideal para salvar no banco/comparação)
      await readerRef.current.startAcquisition(format as any);
      setIsCapturing(true);
      setFingerprintImage(null); // Limpa imagem anterior
      setStatus('Aguardando digital... (Coloque o dedo)');
    } catch (err: any) {
      setStatus(`Erro ao iniciar: ${err.message}`);
      setIsCapturing(false);
    }
  };

  const stopCapture = async () => {
    if (!readerRef.current) return;

    try {
      await readerRef.current.stopAcquisition();
      setIsCapturing(false);
      setStatus('Leitura parada.');
    } catch (err: any) {
      console.warn('Erro ao parar (pode já estar parado):', err);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="bg-primary-100 p-2 rounded-full">
            <Fingerprint className="h-8 w-8 text-primary-600" />
        </div>
        <div>
            <h2 className="text-2xl font-bold text-gray-800">Teste de Biometria (SDK Nativo)</h2>
            <p className="text-gray-500">Interface direta com DigitalPersona WebAPI</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Painel de Controle */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
            
            {/* Status Indicator */}
            <div className={`p-4 rounded-lg border flex items-center justify-between ${
                sdkLoaded ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'
            }`}>
                <div className="flex items-center gap-3">
                    {sdkLoaded ? <CheckCircle className="text-blue-600 h-5 w-5"/> : <AlertCircle className="text-red-600 h-5 w-5"/>}
                    <div className="flex flex-col">
                        <span className="font-bold text-sm text-gray-700">Status do SDK</span>
                        <span className="text-xs text-gray-500">{sdkLoaded ? 'Carregado (Global Window)' : 'Não encontrado'}</span>
                    </div>
                </div>
                <div className={`h-3 w-3 rounded-full ${deviceConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} title="Conexão USB"></div>
            </div>

            {/* Status Text */}
            <div className="font-mono text-xs bg-gray-900 text-green-400 p-3 rounded-lg">
                {'>'} {status}
            </div>

            {/* Settings */}
            <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Formato de Captura</label>
                <select 
                    className="w-full border rounded p-2 text-sm"
                    value={format}
                    onChange={(e) => setFormat(Number(e.target.value))}
                    disabled={isCapturing}
                >
                    <option value="5">Imagem PNG (Visualização)</option>
                    <option value="2">Template Intermediário (Hash)</option>
                    <option value="1">RAW (Bruto)</option>
                </select>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
                <button 
                    onClick={startCapture}
                    disabled={!sdkLoaded || isCapturing}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-white transition-all ${
                        !sdkLoaded || isCapturing ? 'bg-gray-300 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 shadow-lg'
                    }`}
                >
                    <Play className="h-4 w-4" /> Iniciar Leitura
                </button>
                <button 
                    onClick={stopCapture}
                    disabled={!isCapturing}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold border transition-all ${
                        !isCapturing ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                    }`}
                >
                    <Square className="h-4 w-4 fill-current" /> Parar
                </button>
            </div>
        </div>

        {/* Área de Visualização */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center min-h-[300px]">
            <h3 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Visualização da Digital</h3>
            
            <div className={`
                relative w-48 h-64 border-2 border-dashed rounded-xl flex items-center justify-center bg-gray-50 overflow-hidden
                ${isCapturing ? 'border-primary-400' : 'border-gray-300'}
            `}>
                {fingerprintImage ? (
                    <img src={fingerprintImage} alt="Fingerprint" className="w-full h-full object-contain p-2" />
                ) : (
                    <div className="text-center text-gray-400 p-4">
                        <Fingerprint className={`h-16 w-16 mx-auto mb-2 ${isCapturing ? 'animate-pulse text-primary-400' : ''}`} />
                        <span className="text-xs">{isCapturing ? 'Aguardando toque...' : 'Nenhuma imagem'}</span>
                    </div>
                )}
                
                {/* Scan Line Animation */}
                {isCapturing && !fingerprintImage && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-primary-500 shadow-[0_0_15px_rgba(168,85,247,0.5)] animate-[scan_2s_linear_infinite]"></div>
                )}
            </div>

            {quality && (
                <div className="mt-4 px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                    Qualidade: {quality}
                </div>
            )}
        </div>
      </div>
      
      {/* Help Footer */}
      <div className="text-center text-xs text-gray-400 mt-8">
        Nota: Certifique-se que o serviço <strong>Digital Persona Lite Client</strong> esteja rodando em <code>https://127.0.0.1:52181</code>
      </div>
    </div>
  );
};
