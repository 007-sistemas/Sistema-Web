
import { SampleFormat, SdkEventListener } from '../types';

export class DigitalPersonaService {
  private reader: any;
  private isConnected: boolean = false;
  private acquisitionStarted: boolean = false;
  private currentFormat: SampleFormat = SampleFormat.PngImage;

  constructor() {
    // Lazy initialization handled in getReader
  }

  public isSdkLoaded(): boolean {
    return typeof window.Fingerprint !== 'undefined';
  }

  private getReader() {
    if (this.reader) return this.reader;

    if (!this.isSdkLoaded()) {
      console.warn('[BiometryService] SDK não encontrado em window.Fingerprint');
      return null;
    }

    try {
      console.log('[BiometryService] Inicializando Fingerprint.WebApi...');
      this.reader = new window.Fingerprint.WebApi();
      return this.reader;
    } catch (e) {
      console.error('[BiometryService] Falha ao inicializar Fingerprint WebApi', e);
      return null;
    }
  }

  public async enumerateDevices(): Promise<string[]> {
    const reader = this.getReader();
    if (!reader) return [];
    try {
      console.log('[BiometryService] Enumerando dispositivos...');
      const devices = await reader.enumerateDevices();
      console.log('[BiometryService] Dispositivos encontrados (Raw):', devices);
      
      // O SDK pode retornar o array diretamente ou uma string JSON dependendo da versão do service local
      let deviceList = devices;
      if (typeof devices === 'string') {
          try {
              deviceList = JSON.parse(devices);
          } catch(e) {
              console.error('[BiometryService] Erro ao fazer parse da lista de devices:', e);
          }
      }
      return Array.isArray(deviceList) ? deviceList : [];
    } catch (e) {
      console.error('[BiometryService] Erro ao enumerar devices. Verifique se o serviço DP está rodando.', e);
      return [];
    }
  }

  public async startAcquisition(format: SampleFormat = SampleFormat.PngImage, deviceUid?: string): Promise<string> {
    const reader = this.getReader();
    if (!reader) throw new Error("SDK_NOT_LOADED");

    if (this.acquisitionStarted) {
        console.log('[BiometryService] Parando aquisição anterior antes de iniciar nova...');
        await this.stopAcquisition();
    }

    let targetUid = deviceUid;
    if (!targetUid) {
        const devices = await this.enumerateDevices();
        if (devices && devices.length > 0) {
            targetUid = devices[0];
        } else {
            console.error('[BiometryService] Nenhum dispositivo encontrado para iniciar aquisição.');
            throw new Error("NO_DEVICE_FOUND");
        }
    }

    this.currentFormat = format;

    try {
      console.log(`[BiometryService] Iniciando aquisição no device: ${targetUid} formato: ${format}`);
      await reader.startAcquisition(format, targetUid);
      this.acquisitionStarted = true;
      this.isConnected = true;
      return targetUid;
    } catch (error) {
      this.acquisitionStarted = false;
      this.isConnected = false;
      console.error('[BiometryService] Erro fatal ao iniciar aquisição:', error);
      throw error;
    }
  }

  public async stopAcquisition(): Promise<void> {
    const reader = this.getReader();
    if (!reader) return;

    try {
      await reader.stopAcquisition();
      this.acquisitionStarted = false;
      console.log('[BiometryService] Aquisição parada.');
    } catch (error) {
      console.warn('[BiometryService] Erro ao parar (pode já estar parado):', error);
    }
  }

  public setListener(listener: SdkEventListener) {
    const reader = this.getReader();
    if (!reader) return;

    // Remove listeners antigos se necessário (o SDK substitui ao atribuir, então ok)

    reader.onDeviceConnected = (e: any) => {
      console.log('[BiometryService] Evento: Device Connected', e);
      this.isConnected = true;
      if (listener.onDeviceConnected) listener.onDeviceConnected(e);
    };

    reader.onDeviceDisconnected = (e: any) => {
      console.log('[BiometryService] Evento: Device Disconnected');
      this.isConnected = false;
      this.acquisitionStarted = false;
      if (listener.onDeviceDisconnected) listener.onDeviceDisconnected(e);
    };

    reader.onQualityReported = (e: any) => {
      console.log('[BiometryService] Evento: Quality Reported', e);
      if (listener.onQualityReported) listener.onQualityReported(e);
    };

    reader.onErrorOccurred = (e: any) => {
      console.error('[BiometryService] Evento: Error Occurred', e);
      this.acquisitionStarted = false;
      if (listener.onErrorOccurred) listener.onErrorOccurred(e);
    };

    reader.onSamplesAcquired = (s: any) => {
      console.log('[BiometryService] Evento: Samples Acquired', s);
      try {
          const Fingerprint = window.Fingerprint;
          if (!Fingerprint) return;

          let samples: any;
          // Tenta parsear se for string
          try {
              samples = (typeof s.samples === 'string') ? JSON.parse(s.samples) : s.samples;
          } catch (e) {
              samples = s.samples;
          }

          let processedData: string = "";

          if (samples && samples.length > 0) {
              // Lógica de conversão específica do SDK Web
              if (this.currentFormat === SampleFormat.PngImage) {
                  // PNG geralmente vem como string Base64Url direta no array
                  const raw = samples[0]; 
                  // Usa helper do SDK para converter Base64Url -> Base64
                  const b64 = Fingerprint.b64UrlTo64(raw);
                  processedData = "data:image/png;base64," + b64;
              } 
              else {
                  // Outros formatos podem ser objetos ou precisar de conversão diferente
                  const sampleObj = samples[0];
                  // Se for objeto {Data: "..."}
                  const rawData = sampleObj.Data || sampleObj;
                  processedData = Fingerprint.b64UrlTo64(rawData);
              }
          }

          if (listener.onSamplesAcquired) {
              listener.onSamplesAcquired({
                  originalEvent: s,
                  samples: processedData, 
                  format: this.currentFormat
              });
          }

      } catch (e) {
          console.error("[BiometryService] Erro ao processar amostras:", e);
      }
    };
  }
}

export const biometryService = new DigitalPersonaService();
