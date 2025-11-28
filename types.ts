
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

// DIGITAL PERSONA SDK TYPES
export enum SampleFormat {
  Raw = 1,
  Intermediate = 2,
  Compressed = 3,
  PngImage = 5
}

export interface FingerprintSample {
  data: string; // Base64
}

export interface SdkEventListener {
  onDeviceConnected?: (device: any) => void;
  onDeviceDisconnected?: (device: any) => void;
  onSamplesAcquired?: (s: { samples: FingerprintSample[] }) => void;
  onQualityReported?: (e: { quality: number }) => void;
  onErrorOccurred?: (e: { error: number }) => void;
}
