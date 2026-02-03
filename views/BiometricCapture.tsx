
import React, { useState, useEffect } from 'react';
import { AlertCircle, Wifi, WifiOff, Loader, Fingerprint, ExternalLink, RefreshCw } from 'lucide-react';
import { biometryService } from '../services/biometry';
import { SampleFormat } from '../types';

export const BiometricCapture: React.FC = () => {
  const [devices, setDevices] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string>('');
  const [rawHash, setRawHash] = useState<string>('');
  const [quality, setQuality] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [sdkConnected, setSdkConnected] = useState(false);
  const [currentFormat, setCurrentFormat] = useState<SampleFormat>(SampleFormat.PngImage);

  useEffect(() => {
    // Check for SDK load
    let attempts = 0;
    const checkTimer = setInterval(() => {
        attempts++;
        if (biometryService.isSdkLoaded()) {
            setSdkConnected(true);
            loadDevices();
            clearInterval(checkTimer);
            setIsLoading(false);
        } else if (attempts > 20) { // 10 segundos
            clearInterval(checkTimer);
            setError("Scripts do SDK não foram carregados pelo navegador.");
            setIsLoading(false);
        }
    }, 500);

    return () => clearInterval(checkTimer);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
      return () => {
          biometryService.stopAcquisition().catch(() => {});
      }
  }, []);

  const loadDevices = async () => {
      setIsLoading(true);
      setError('');
      try {
          const devs = await biometryService.enumerateDevices();
          setDevices(devs);
          if (devs.length > 0) {
              setSelectedDevice(devs[0]);
              setMessage(`Leitor detectado: ${devs[0]}`);
          } else {
              setMessage("Nenhum leitor encontrado. Verifique a conexão USB e o Driver.");
          }
      } catch (e: any) {
          console.error(e);
          setError("Erro ao comunicar com o serviço local.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleStartCapture = async () => {
      setError('');
      setCapturedImage('');
      setRawHash('');
      setMessage("Inicializando...");
      
      try {
          // Configura listeners antes de iniciar
          biometryService.setListener({
              onDeviceConnected: () => setMessage("Leitor conectado"),
              onDeviceDisconnected: () => { setMessage("Leitor desconectado"); setIsCapturing(false); },
              onQualityReported: (e: any) => setQuality(`Qualidade: ${e.quality}`),
              onSamplesAcquired: (s: any) => {
                  setMessage("Leitura realizada com sucesso!");
                  if (s.samples) {
                      if (currentFormat === SampleFormat.PngImage) {
                          setCapturedImage(s.samples);
                      } else {
                          setRawHash(s.samples.substring(0, 50) + "...");
                      }
                  }
              },
              onErrorOccurred: (e: any) => {
                  setError(e.message || "Ocorreu um erro no leitor.");
                  setIsCapturing(false);
              }
          });

          await biometryService.startAcquisition(currentFormat, selectedDevice);
          setIsCapturing(true);
          setMessage("Coloque o dedo no sensor...");
      } catch (e: any) {
          setError(e.message || "Falha ao iniciar captura. Verifique se o serviço está rodando.");
          setIsCapturing(false);
      }
  };

  const handleStopCapture = async () => {
      await biometryService.stopAcquisition();
      setIsCapturing(false);
      setMessage("Captura parada.");
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800">Diagnóstico de Biometria</h2>
            <p className="text-gray-500 text-sm">Teste de conexão e qualidade do leitor</p>
        </div>
        <div className="flex items-center gap-2">
          {sdkConnected ? (
            <span className="flex items-center text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                <Wifi className="h-4 w-4 mr-2" /> SDK Scripts OK
            </span>
          ) : (
            <span className="flex items-center text-sm text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-200">
                <WifiOff className="h-4 w-4 mr-2" /> SDK Scripts Off
            </span>
          )}
        </div>
      </div>

      {/* Warning Box for Connection Issues */}
      {(error || devices.length === 0) && sdkConnected && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-bold text-amber-800 flex items-center mb-2">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  Problemas de Conexão?
              </h3>
              <p className="text-sm text-amber-700 mb-3">
                  Se o leitor estiver conectado via USB mas não aparecer na lista, o navegador pode estar bloqueando a conexão segura com o serviço local (WebSDK).
              </p>
              <div className="flex flex-wrap gap-3">
                  <a 
                    href="https://127.0.0.1:52181/get_connection" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center bg-white border border-amber-300 text-amber-800 px-3 py-2 rounded text-sm font-semibold hover:bg-amber-100 transition-colors"
                  >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      1. Liberar Certificado Local
                  </a>
                  <button 
                    onClick={loadDevices}
                    className="flex items-center bg-amber-600 text-white px-3 py-2 rounded text-sm font-semibold hover:bg-amber-700 transition-colors"
                  >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      2. Tentar Novamente
                  </button>
              </div>
              <p className="text-xs text-amber-600 mt-2">
                  *Ao clicar em "Liberar Certificado", se aparecer "Sua conexão não é segura", clique em <strong>Avançado</strong> e depois em <strong>Ir para 127.0.0.1 (inseguro)</strong>. Depois feche a aba e tente novamente aqui.
              </p>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Controls */}
          <div className="space-y-6">
              <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Dispositivo Selecionado</label>
                  <div className="flex gap-2">
                      <select 
                        className="w-full border border-gray-300 rounded p-2 bg-white"
                        value={selectedDevice}
                        onChange={(e) => setSelectedDevice(e.target.value)}
                        disabled={isCapturing}
                      >
                          {devices.length === 0 && <option value="">Nenhum dispositivo</option>}
                          {devices.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <button 
                        onClick={loadDevices}
                        disabled={isCapturing}
                        className="p-2 border border-gray-300 rounded bg-gray-50 hover:bg-gray-100 text-gray-600"
                        title="Atualizar Lista"
                      >
                          <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                      </button>
                  </div>
              </div>

              <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Formato da Amostra</label>
                  <select 
                    className="w-full border border-gray-300 rounded p-2 bg-white"
                    value={currentFormat}
                    onChange={(e) => setCurrentFormat(Number(e.target.value))}
                    disabled={isCapturing}
                  >
                      <option value={SampleFormat.PngImage}>Imagem PNG (Visual)</option>
                      <option value={SampleFormat.Intermediate}>Template (Hash)</option>
                      <option value={SampleFormat.Raw}>Raw Data</option>
                  </select>
              </div>

              <div className="flex gap-4 pt-2">
                  <button 
                    onClick={handleStartCapture} 
                    disabled={!sdkConnected || isCapturing || devices.length === 0}
                    className="flex-1 bg-primary-600 text-white font-bold py-3 rounded hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                      {isCapturing && <Loader className="h-4 w-4 animate-spin" />}
                      {isCapturing ? 'Lendo...' : 'Iniciar Leitura'}
                  </button>
                  <button 
                    onClick={handleStopCapture} 
                    disabled={!isCapturing}
                    className="flex-1 border border-red-300 text-red-600 font-bold py-3 rounded hover:bg-red-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 transition-colors"
                  >
                      Parar
                  </button>
              </div>

              {message && (
                  <div className={`p-3 rounded text-sm border ${message.includes('Erro') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                      {message}
                  </div>
              )}
              
              {error && (
                  <div className="p-3 bg-red-50 rounded text-sm text-red-600 border border-red-200 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0"/>
                      {error}
                  </div>
              )}
          </div>

          {/* Visualization */}
          <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 min-h-[300px]">
              {capturedImage ? (
                  <div className="relative">
                      <img src={capturedImage} alt="Fingerprint" className="max-w-full max-h-64 object-contain shadow-md border bg-white rounded" />
                      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                          PNG Image
                      </div>
                  </div>
              ) : rawHash ? (
                  <div className="w-full h-64 flex flex-col">
                      <div className="bg-gray-200 px-4 py-2 text-xs font-bold text-gray-600 rounded-t border border-gray-300">
                          DADOS RAW / HASH
                      </div>
                      <div className="flex-1 text-xs font-mono break-all bg-white p-4 rounded-b border border-t-0 border-gray-300 overflow-auto shadow-inner text-gray-500">
                          {rawHash}
                      </div>
                  </div>
              ) : (
                  <div className="text-center text-gray-400">
                      <Fingerprint className={`h-24 w-24 mx-auto mb-4 ${isCapturing ? 'animate-pulse text-primary-300' : 'text-gray-300'}`} />
                      <p className="text-sm font-medium">A imagem da digital aparecerá aqui</p>
                      {isCapturing && <p className="text-xs mt-2 text-primary-500">Aguardando sensor...</p>}
                  </div>
              )}
              
              {quality && (
                  <div className="mt-4 text-xs font-bold text-gray-600 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                      {quality}
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};
