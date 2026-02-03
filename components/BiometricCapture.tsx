import React, { useState, useEffect } from 'react';
import { AlertCircle, Wifi, WifiOff, Loader } from 'lucide-react';
import { biometryService } from '../services/biometry';
import { SampleFormat } from '../types';

interface BiometricCaptureProps {
  onCapture?: (imageData: string) => void;
  sampleFormat?: SampleFormat;
}

export const BiometricCapture: React.FC<BiometricCaptureProps> = ({
  onCapture,
  sampleFormat = SampleFormat.PngImage
}) => {
  const [devices, setDevices] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string>('');
  const [quality, setQuality] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);

  // Inicializar SDK e listar devices
  useEffect(() => {
    const initBiometry = async () => {
      try {
        setIsLoading(true);
        console.log('[BiometricCapture] Iniciando componente...');
        
        if (!biometryService.isSdkLoaded()) {
          console.error('[BiometricCapture] SDK não está carregado');
          throw new Error('SDK do DigitalPersona não foi carregado. Verifique o console do navegador e os arquivos em public/js/');
        }

        console.log('[BiometricCapture] SDK disponível.');
        setIsConnected(true);

        // Configurar event listeners
        biometryService.setListener({
          onSamplesAcquired: (event: any) => {
            console.log('[BiometricCapture] Evento samplesAcquired recebido');
            handleSampleAcquired(event);
          },
          onQualityReported: (event: any) => {
            console.log('[BiometricCapture] Qualidade reportada:', event.quality);
            setQuality(String(event.quality || 'Desconhecido'));
          },
          onDeviceConnected: (event: any) => {
            console.log('[BiometricCapture] Device conectado:', event);
            setMessage('Dispositivo conectado');
            loadDevices();
          },
          onDeviceDisconnected: (event: any) => {
            console.log('[BiometricCapture] Device desconectado');
            setMessage('Dispositivo desconectado');
            setIsCapturing(false);
            loadDevices();
          },
          onErrorOccurred: (event: any) => {
            console.error('[BiometricCapture] Erro do SDK:', event);
            const msg = event.message || (typeof event === 'string' ? event : 'Erro desconhecido');
            
            // Tratamento específico para falha de comunicação
            if (msg.includes && msg.includes('COMMUNICATION_FAILED')) {
               setError('Falha na comunicação com o leitor biométrico');
               setIsConnected(false);
            } else {
               setError(msg);
            }
          }
        });

        console.log('[BiometricCapture] Carregando dispositivos...');
        await loadDevices();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[BiometricCapture] Erro na inicialização:', errorMsg);
        
        if (biometryService.isSdkLoaded()) {
          // Se o SDK foi carregado mas há erro (ex: comunicação), mostra erro mas mantém flag
          setError(`Erro ao inicializar: ${errorMsg}`);
        } else {
          setError(`Erro ao inicializar SDK: ${errorMsg}`);
          setIsConnected(false);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initBiometry();

    return () => {
      // Cleanup: parar captura se estiver rodando
      if (isCapturing) {
        biometryService.stopAcquisition().catch(console.error);
      }
    };
  }, []);

  const loadDevices = async () => {
    try {
      const deviceList = await biometryService.enumerateDevices();
      setDevices(deviceList);
      setError('');

      if (deviceList.length === 0) {
        setMessage('Nenhum leitor biométrico encontrado. Por favor, conecte um leitor DigitalPersona 4500.');
      } else if (deviceList.length === 1) {
        setSelectedDevice(deviceList[0]);
        setMessage('Leitor biométrico detectado e selecionado automaticamente.');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`Erro ao listar leitores: ${errorMsg}`);
    }
  };

  const handleSampleAcquired = (event: any) => {
    try {
      // O evento já contém a amostra processada em 'samples' (string base64 ou similar)
      const imageData = event.samples;

      setCapturedImage(imageData);
      setMessage('Impressão capturada com sucesso!');

      if (onCapture) {
        onCapture(imageData);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`Erro ao processar amostra: ${errorMsg}`);
    }
  };

  const handleStartCapture = async () => {
    if (!selectedDevice) {
      setError('Por favor, selecione um leitor biométrico');
      return;
    }

    try {
      setError('');
      setMessage('Inicializando captura... posicione seu dedo no leitor');
      await biometryService.startAcquisition(sampleFormat, selectedDevice);
      setIsCapturing(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`Erro ao iniciar captura: ${errorMsg}`);
      setIsCapturing(false);
    }
  };

  const handleStopCapture = async () => {
    try {
      await biometryService.stopAcquisition();
      setIsCapturing(false);
      setMessage('Captura parada');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`Erro ao parar captura: ${errorMsg}`);
    }
  };

  const handleClear = () => {
    setCapturedImage('');
    setQuality('');
    setMessage('');
    setError('');
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Captura Biométrica</h2>
        <div className="flex items-center gap-2">
          {isConnected || devices.length > 0 ? (
            <>
              <Wifi className="h-5 w-5 text-green-600" />
              <span className="text-sm text-green-600">Conectado ao SDK</span>
            </>
          ) : (
            <>
              <WifiOff className="h-5 w-5 text-red-600" />
              <span className="text-sm text-red-600">Desconectado</span>
            </>
          )}
        </div>
      </div>

      {/* Mensagens de erro */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-800">Erro</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Seleção de dispositivo */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Leitor Biométrico
        </label>
        <select
          value={selectedDevice}
          onChange={(e) => {
            setSelectedDevice(e.target.value);
            setError('');
          }}
          disabled={isLoading || devices.length === 0}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
        >
          <option value="">
            {isLoading
              ? 'Carregando leitores...'
              : devices.length === 0
              ? 'Nenhum leitor encontrado'
              : 'Selecione um leitor'}
          </option>
          {devices.map((device) => (
            <option key={device} value={device}>
              {device}
            </option>
          ))}
        </select>
      </div>

      {/* Botões de controle */}
      <div className="mb-6 flex gap-3">
        <button
          onClick={handleStartCapture}
          disabled={!selectedDevice || isCapturing || isLoading}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isCapturing && <Loader className="h-4 w-4 animate-spin" />}
          {isCapturing ? 'Capturando...' : 'Iniciar Captura'}
        </button>

        <button
          onClick={handleStopCapture}
          disabled={!isCapturing}
          className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
        >
          Parar
        </button>

        <button
          onClick={handleClear}
          className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
        >
          Limpar
        </button>
      </div>

      {/* Informações de qualidade */}
      {quality && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Qualidade da imagem:</strong> {quality}
          </p>
        </div>
      )}

      {/* Mensagens informativas */}
      {message && !error && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">{message}</p>
        </div>
      )}

      {/* Imagem capturada */}
      {capturedImage && (
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Impressão Digital Capturada:</p>
          <div className="flex justify-center">
            {sampleFormat === SampleFormat.PngImage && capturedImage.startsWith('data:image') ? (
              <img
                src={capturedImage}
                alt="Impressão digital capturada"
                className="max-w-xs max-h-64 border border-gray-300 rounded-lg shadow-md"
              />
            ) : (
              <div className="p-4 bg-gray-100 border border-gray-300 rounded text-xs font-mono break-all max-h-64 overflow-y-auto">
                {capturedImage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Informações adicionais */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs text-gray-600">
          <strong>Formato:</strong> {SampleFormat[sampleFormat]} • <strong>Status:</strong>{' '}
          {isCapturing ? 'Capturando' : selectedDevice ? 'Pronto' : 'Aguardando seleção'}
        </p>
      </div>
    </div>
  );
};
