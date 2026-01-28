import { Cooperado, StatusCooperado } from '../types';
import { StorageService } from './storage';
import { normalizeNome } from './normalize';
import * as XLSX from 'xlsx';

export interface CsvRow {
  id?: string;
  nome: string;
  cpf: string;
  matricula: string;
  categoriaProfissional: string;
  telefone?: string;
  email?: string;
  status?: string;
}

export interface ImportError {
  row: number;
  campo: string;
  erro: string;
}

export interface ImportResult {
  sucesso: Cooperado[];
  erros: ImportError[];
  resumo: {
    totalLinhas: number;
    sucessos: number;
    erros: number;
  };
}

/**
 * Parse CSV string into array of rows
 * Aceita: nome, cpf, matricula, categoriaProfissional, telefone, email, status
 */
export const parseCSV = (csvText: string): CsvRow[] => {
  const linhas = csvText.trim().split('\n');
  if (linhas.length < 2) return [];

  const header = linhas[0].split(',').map(h => h.trim().toLowerCase());
  const dados: CsvRow[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const valores = linhas[i].split(',').map(v => v.trim());
    if (valores.every(v => !v)) continue; // Pula linhas vazias

    const row: CsvRow = {
      nome: '',
      cpf: '',
      matricula: '',
      categoriaProfissional: '',
    };

    header.forEach((col, idx) => {
      const valor = valores[idx] || '';
      if (col === 'nome') row.nome = normalizeNome(valor);
      if (col === 'cpf') row.cpf = valor;
      if (col === 'matricula') row.matricula = valor;
      if (col === 'categoriaProfissional') row.categoriaProfissional = valor;
      if (col === 'telefone') row.telefone = valor;
      if (col === 'email') row.email = valor;
      if (col === 'status') row.status = valor;
    });

    dados.push(row);
  }

  return dados;
};

/**
 * Validar e preparar cooperados para importação
 */
export const validateAndPrepareImport = (csvRows: CsvRow[]): ImportResult => {
  const sucesso: Cooperado[] = [];
  const erros: ImportError[] = [];
  const nomesCpfUsados = new Set<string>();
  const nomesMtrUsados = new Set<string>();

  csvRows.forEach((row, idx) => {
    const errosRow: string[] = [];
    const rowNum = idx + 2; // +1 para header, +1 pois é 1-based

    // Validar obrigatórios
    if (!row.nome || !row.nome.trim()) {
      errosRow.push('Nome é obrigatório');
    }
    if (!row.cpf || !row.cpf.trim()) {
      errosRow.push('CPF é obrigatório');
    }

    // Validar formato CPF (remover caracteres especiais)
    const cpfLimpo = (row.cpf || '').replace(/\D/g, '');
    if (cpfLimpo && cpfLimpo.length !== 11) {
      errosRow.push('CPF deve ter 11 dígitos');
    }

    // Validar duplicatas dentro do CSV
    if (cpfLimpo && nomesCpfUsados.has(cpfLimpo)) {
      errosRow.push('CPF duplicado neste arquivo');
    }
    if (row.matricula && nomesMtrUsados.has(row.matricula)) {
      errosRow.push('Matrícula duplicada neste arquivo');
    }

    // Validar duplicatas no BD
    const cooperados = StorageService.getCooperados();
    const clean = (s: string) => (s || '').replace(/\D/g, '');
    if (cpfLimpo && cooperados.some(c => clean(c.cpf) === cpfLimpo)) {
      errosRow.push('CPF já existe no banco de dados');
    }
    if (row.matricula && cooperados.some(c => c.matricula === row.matricula)) {
      errosRow.push('Matrícula já existe no banco de dados');
    }

    if (errosRow.length > 0) {
      errosRow.forEach(erro => {
        erros.push({ row: rowNum, campo: row.nome || 'Desconhecido', erro });
      });
      return;
    }

    // Registrar como usado
    if (cpfLimpo) nomesCpfUsados.add(cpfLimpo);
    if (row.matricula) nomesMtrUsados.add(row.matricula);

    // Preparar cooperado
    const cooperado: Cooperado = {
      id: crypto.randomUUID(),
      nome: normalizeNome(row.nome),
      cpf: row.cpf,
      matricula: row.matricula,
      categoriaProfissional: row.categoriaProfissional,
      telefone: row.telefone || '',
      email: row.email || '',
      status: (row.status || 'ATIVO') as StatusCooperado,
      biometrias: [],
      updatedAt: new Date().toISOString(),
    };

    sucesso.push(cooperado);
  });

  return {
    sucesso,
    erros,
    resumo: {
      totalLinhas: csvRows.length,
      sucessos: sucesso.length,
      erros: erros.length,
    },
  };
};

/**
 * Importar cooperados em lote (salvando um a um)
 */
export const importCooperados = (cooperados: Cooperado[]): void => {
  cooperados.forEach(c => {
    StorageService.saveCooperado(c);
  });
};

/**
 * Parse Excel file (xlsx, xls, xlsm) into array of rows
 */
export const parseExcelFile = async (file: File): Promise<CsvRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON (headers as keys)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        
        // Convert to CsvRow format
        const rows: CsvRow[] = jsonData.map((row: any) => ({
          nome: normalizeNome(String(row.nome || '').trim()),
          cpf: String(row.cpf || '').trim(),
          matricula: String(row.matricula || '').trim(),
          categoriaProfissional: String(row.categoriaProfissional || '').trim(),
          telefone: String(row.telefone || '').trim(),
          email: String(row.email || '').trim(),
          status: String(row.status || '').trim(),
        }));
        
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };
    
    reader.readAsArrayBuffer(file);
  });
};
