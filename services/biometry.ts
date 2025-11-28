
import { SampleFormat, SdkEventListener } from '../types';

// Declare global variable for the SDK usually injected by the script
declare global {
  interface Window {
    Fingerprint: any;
  }
}

export class DigitalPersonaService {
  private reader: any;
  private isConnected: boolean = false;

  constructor() {
    // Lazy init - do not initialize in constructor to avoid race conditions
  }

  private getReader() {
    if (this.reader) return this.reader;

    if (typeof window.Fingerprint === 'undefined') {
      return null;
    }

    try {
      this.reader = new window.Fingerprint.WebApi();
      return this.reader;
    } catch (e) {
      console.error('Failed to initialize Fingerprint WebApi', e);
      return null;
    }
  }

  public isSdkLoaded(): boolean {
    return typeof window.Fingerprint !== 'undefined';
  }

  public async startAcquisition(format: SampleFormat = SampleFormat.PngImage): Promise<void> {
    const reader = this.getReader();
    
    if (!reader) {
      console.warn('SDK not loaded yet.');
      throw new Error("SDK_NOT_LOADED");
    }

    try {
      await reader.startAcquisition(format);
      console.log('Fingerprint acquisition started');
      this.isConnected = true;
    } catch (error) {
      console.error('Error starting acquisition:', error);
      this.isConnected = false;
      // If error is "The system cannot find the file specified" (-2147024894), 
      // it usually means the HTTP handshake failed but WS might work if we retry or ignore
      // However, we usually propagate to let UI show help
      throw error;
    }
  }

  public async stopAcquisition(): Promise<void> {
    if (!this.reader) return;

    try {
      await this.reader.stopAcquisition();
      console.log('Fingerprint acquisition stopped');
      this.isConnected = false;
    } catch (error) {
      console.error('Error stopping acquisition:', error);
    }
  }

  public setListener(listener: SdkEventListener) {
    const reader = this.getReader();
    if (!reader) return;

    reader.onDeviceConnected = (e: any) => {
      console.log('Device Connected', e);
      if (listener.onDeviceConnected) listener.onDeviceConnected(e);
    };

    reader.onDeviceDisconnected = (e: any) => {
      console.log('Device Disconnected');
      if (listener.onDeviceDisconnected) listener.onDeviceDisconnected(e);
    };

    reader.onSamplesAcquired = (s: any) => {
      console.log('Samples Acquired', s);
      if (listener.onSamplesAcquired) listener.onSamplesAcquired(s);
    };

    reader.onQualityReported = (e: any) => {
      if (listener.onQualityReported) listener.onQualityReported(e);
    };

    reader.onErrorOccurred = (e: any) => {
      console.error('SDK Error', e);
      if (listener.onErrorOccurred) listener.onErrorOccurred(e);
    };
  }

  public async enumerateDevices(): Promise<string[]> {
    const reader = this.getReader();
    if (!reader) return [];
    try {
      const devices = await reader.enumerateDevices();
      return devices;
    } catch (e) {
      console.error(e);
      return [];
    }
  }
}

export const biometryService = new DigitalPersonaService();
