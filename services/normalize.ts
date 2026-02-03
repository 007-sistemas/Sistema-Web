// Função utilitária para normalizar nomes: caixa alta e sem acento
export function normalizeNome(nome: string): string {
  if (!nome) return '';
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // remove acentos
    .toUpperCase();
}