
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
  categoriaProfissional: string;
  telefone: string;
  email: string;
  status: StatusCooperado;
  biometrias: Biometria[];
  updatedAt: string;
}

export interface Setor {
  id: number;
  nome: string;
}

export interface HospitalPermissions {
  dashboard: boolean;
  ponto: boolean;
  relatorio: boolean;
  relatorios: boolean; // Nova permissão para Relatórios
  cadastro: boolean;
  hospitais: boolean;
  biometria: boolean;
  auditoria: boolean;
  gestao: boolean; // New permission for Manager management
  testes?: boolean; // Permissão opcional para área de testes
  espelho: boolean; // Permission for Espelho da Biometria (apenas Cooperados)
  autorizacao: boolean; // New permission for Justification Approval
  perfil: boolean; // New permission for User Profile
}

export interface Hospital {
  id: string;
  nome: string;
  slug: string; // URL identifier (e.g., 'hrn', 'hrc')
  usuarioAcesso: string; // Auto-generated login code
  senha?: string; // Access password
  permissoes: HospitalPermissions;
  // setores agora vêm da tabela hospital_setores (relacionamento N:N)
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  primaryColor: string; // Hex color (e.g., '#2563eb')
  visibleTabs: string[]; // Array of visible tab/view keys
  tabOrder: string[]; // Custom order of tabs
}

export interface Manager {
  id: string;
  username: string;
  password: string;
  cpf: string;
  email: string;
  permissoes: HospitalPermissions;
  preferences?: UserPreferences; // User theme/color preferences
}

export interface JustificativaData {
  motivo: string;
  descricao?: string;
  dataSolicitacao: string;
}

export interface Justificativa {
  id: string;
  cooperadoId: string;
  cooperadoNome: string;
  pontoId?: string; // Pode referenciar um ponto específico ou null
  hospitalId?: string; // Hospital selecionado na justificativa (para criar pontos na aprovação)
  motivo: string;
  descricao?: string;
  dataSolicitacao: string;
  status: 'Pendente' | 'Fechado' | 'Rejeitado' | 'Excluído';
  aprovadoPor?: string; // Deprecated - usar validadoPor
  validadoPor?: string; // Nome do gestor que aprovou
  dataAprovacao?: string;
  rejeitadoPor?: string;
  motivoRejeicao?: string;
  setorId?: string; // Setor selecionado pelo cooperado
  dataPlantao?: string; // Data informada pelo cooperado (dd/mm/aaaa ou ISO)
  entradaPlantao?: string; // Horário de entrada informado (HH:mm)
  saidaPlantao?: string; // Horário de saída informado (HH:mm)
  createdAt: string;
  updatedAt: string;
  // Dados opcionais do ponto (preenchidos quando vindos do Neon para evitar buscar localStorage)
  pontoTimestamp?: string;
  pontoEntrada?: string;
  pontoSaida?: string;
  pontoTipo?: string;
  pontoDate?: string;
  pontoRelatedId?: string;
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
  validadoPor?: string; // If manual override (Aprovado por)
  rejeitadoPor?: string; // Who rejected (Recusado por)
  motivoRejeicao?: string; // Reason for rejection
  isManual: boolean;
  status: 'Aberto' | 'Fechado' | 'Pendente' | 'Rejeitado';
  relatedId?: string; // ID of the paired record (Exit points to Entry)
  justificativa?: JustificativaData;
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
