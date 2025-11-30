
export enum TipoPonto {
  ENTRADA = 'ENTRADA',
  INTERVALO_IDA = 'INTERVALO_IDA',
  INTERVALO_VOLTA = 'INTERVALO_VOLTA',
  SAIDA = 'SAIDA',
}

export enum StatusCooperado {
  ATIVO = 'ATIVO',
  INATIVO = 'INATIVO',
  SUSPENSO = 'SUSPENSO',
}

export interface Biometria {
  id: string;
  fingerIndex: number; // 0-9 representing fingers
  hash: string; // FMD (Fingerprint Minutiae Data) or Simulated Hash
  createdAt: string;
}

export interface Cooperado {
  id: string;
  nome: string;
  cpf: string;
  matricula: string;
  especialidade: string;
  telefone: string;
  email: string;
  status: StatusCooperado;
  biometrias: Biometria[];
  updatedAt: string;
}

export interface Setor {
  id: string;
  nome: string;
}

export interface HospitalAddress {
  cep: string;
  logradouro: string;
  numero: string;
  latitude?: number;
  longitude?: number;
  raio?: number;
}

export interface HospitalPermissions {
  dashboard: boolean;
  ponto: boolean;
  relatorio: boolean;
  cadastro: boolean;
  hospitais: boolean;
  biometria: boolean;
  auditoria: boolean;
  gestao: boolean; // New permission for Manager management
  testes?: boolean; // Permissão opcional para área de testes
  espelho: boolean; // New permission for Cooperado View
}

export interface Hospital {
  id: string;
  nome: string;
  slug: string; // URL identifier (e.g., 'hrn', 'hrc')
  usuarioAcesso: string; // Auto-generated login code
  senha?: string; // Access password
  endereco?: HospitalAddress;
  permissoes: HospitalPermissions;
  setores: Setor[];
}

export interface Manager {
  id: string;
  username: string;
  password: string;
  permissoes: HospitalPermissions;
}

export interface RegistroPonto {
  id: string;
  codigo: string; // Legacy numeric code (e.g. 248834)
  cooperadoId: string;
  cooperadoNome: string;
  timestamp: string; // Full ISO Date
  tipo: TipoPonto;
  local: string;
  hospitalId?: string; // Helper for filtering
  setorId?: string; // Helper for filtering
  observacao?: string;
  validadoPor?: string; // If manual override
  isManual: boolean;
  status: 'Aberto' | 'Fechado';
  relatedId?: string; // ID of the paired record (Exit points to Entry)
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
  user: string;
}

// --- DIGITAL PERSONA SDK GLOBAL TYPES ---

export enum SampleFormat {
  Raw = 1,
  Intermediate = 2,
  Compressed = 3,
  PngImage = 5,
}

export enum QualityCode {
  Good = 0,
  NoImage = 1,
  TooLight = 2,
  TooDark = 3,
  TooNoisy = 4,
  LowContrast = 5,
  NotEnoughFeatures = 6,
  NotCentered = 7,
  NotAFinger = 8,
  TooHigh = 9,
  TooLow = 10,
  TooLeft = 11,
  TooRight = 12,
  TooStrange = 13,
  TooFast = 14,
  TooSkewed = 15,
  TooShort = 16,
  TooSlow = 17,
  ReverseMotion = 18,
  PressureTooHard = 19,
  PressureTooLight = 20,
  WetFinger = 21,
  FakeFinger = 22,
  TooSmall = 23,
  RotatedTooMuch = 24,
}

export interface SdkEventListener {
  onDeviceConnected?: (event: any) => void;
  onDeviceDisconnected?: (event: any) => void;
  onSamplesAcquired?: (event: any) => void;
  onQualityReported?: (event: any) => void;
  onErrorOccurred?: (event: any) => void;
}

declare global {
  interface Window {
    Fingerprint: any;
    WebSdk: any;
  }
}
