// Usar bundle browser do ExcelJS para evitar dependências de Node
import ExcelJS from 'exceljs/dist/exceljs.min.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface RelatorioRow {
  cooperadoNome: string;
  categoriaProfissional: string;
  hospital: string;
  setor: string;
  data: string;
  entrada: string;
  saida: string;
  totalHoras: string;
  status: string;
}

export interface ExportFilters {
  hospital?: string;
  setor?: string;
  cooperado?: string;
  categoria?: string;
  dataIni?: string;
  dataFim?: string;
}

export interface ExportStats {
  totalRegistros: number;
  plantoesFechados: number;
  plantoesAbertos: number;
  totalHoras: string;
}

// Estatísticas para justificativas
export interface JustificativaStats {
  total: number;
  aprovadas: number;
  recusadas: number;
  pendentes: number;
}

/**
 * Exportar dados de relatório para Excel (.xlsx)
 */
export const exportToExcel = async (
  data: RelatorioRow[],
  filters: ExportFilters,
  stats: ExportStats
) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatório de Produção');

    // Definir largura das colunas
    worksheet.columns = [
      { header: 'Cooperado', key: 'cooperadoNome', width: 20 },
      { header: 'Categoria Profissional', key: 'categoriaProfissional', width: 18 },
      { header: 'Hospital', key: 'hospital', width: 18 },
      { header: 'Setor', key: 'setor', width: 18 },
      { header: 'Data', key: 'data', width: 12 },
      { header: 'Entrada', key: 'entrada', width: 10 },
      { header: 'Saída', key: 'saida', width: 10 },
      { header: 'Total', key: 'totalHoras', width: 12 },
      { header: 'Status', key: 'status', width: 14 }
    ];

    // Estilizar cabeçalho
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6A1B9A' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 20;

    // Adicionar dados
    data.forEach((row) => {
      const newRow = worksheet.addRow(row);
      
      // Alternância de cores (cinza claro)
      if (worksheet.lastRow && worksheet.lastRow.number % 2 === 0) {
        newRow.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
        });
      }

      // Alinhar células
      newRow.eachCell((cell) => {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      });

      // Formatar status
      if (newRow.getCell('status').value === 'Fechado') {
        newRow.getCell('status').font = { color: { argb: 'FF2E7D32' } };
      } else {
        newRow.getCell('status').font = { color: { argb: 'FFF57C00' } };
      }
    });

    // Adicionar linha em branco
    worksheet.addRow({});

    // Adicionar linha de resumo
    const resumoRow = worksheet.addRow({
      cooperadoNome: 'RESUMO DO PERÍODO',
      totalHoras: stats.totalHoras
    });

    resumoRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    resumoRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6A1B9A' } };
    resumoRow.eachCell((cell) => {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    });

    // Adicionar filtros aplicados como informação no topo (em células vazias antes dos dados)
    const filterText = buildFilterText(filters);
    const filterRow = worksheet.insertRow(1, [filterText]);
    filterRow.font = { italic: true, color: { argb: 'FF666666' } };
    filterRow.alignment = { horizontal: 'left' };

    // Gerar arquivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_producao_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);

    console.log('[reportExport] Excel exportado com sucesso');
  } catch (error) {
    console.error('[reportExport] Erro ao exportar Excel:', error);
    alert('Erro ao exportar Excel. Verifique o console.');
  }
};

/**
 * Exportar dados de relatório para PDF
 */
export const exportToPDF = async (
  data: RelatorioRow[],
  filters: ExportFilters,
  stats: ExportStats
) => {
  try {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 15;


    // === CABEÇALHO MODERNO ===
    // LOGO
    const logoPath = '/logo-coptem.png'; // Ajuste para o logo correto
    try {
      pdf.addImage(logoPath, 'PNG', 10, 7, 22, 14);
    } catch (err) {
      // fallback: nada
    }

    // Informações institucionais
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(30, 30, 30);
    pdf.text('Nome:', 38, 13);
    pdf.text('CNPJ:', 38, 18);
    pdf.text('Período:', 38, 23);
    pdf.text('Gerado em:', 38, 28);

    pdf.setFont('helvetica', 'bold');
    pdf.text('Cooperativa de Trabalho dos Profissionais de Enfermagem do Ceará e das Demais Áreas da Saúde', 60, 13, { maxWidth: pageWidth - 62 });
    pdf.setFont('helvetica', 'normal');
    pdf.text('03031687000110', 60, 18);
    const periodo = (filters.dataIni && filters.dataFim) ? `Período: ${filters.dataIni} a ${filters.dataFim}` : 'Período não informado';
    pdf.text(periodo, 60, 23);
    const dataGeracao = new Date().toLocaleString('pt-BR');
    pdf.text(dataGeracao, 60, 28);

    // Página
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(`Página 1 de {n}`, pageWidth - 32, 13); // {n} será substituído pelo jsPDF

    // Título do relatório
    yPosition = 35;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(30, 30, 30);
    pdf.text('Relatório Geral', pageWidth / 2, yPosition, { align: 'center', maxWidth: pageWidth - 20 });
    yPosition += 8;

    // Filtros aplicados
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    const filterText = buildFilterText(filters);
    const splitFilterText = pdf.splitTextToSize(filterText, pageWidth - 20);
    pdf.text(splitFilterText, 10, yPosition);
    yPosition += splitFilterText.length * 5 + 5;

    // === DASHBOARD COM CARDS ===
    const cardWidth = (pageWidth - 20) / 4 - 3;
    const cardHeight = 25;
    const cardYPos = yPosition;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);

    // Card 1: Total de Registros
    drawCard(pdf, 10, cardYPos, cardWidth, cardHeight, 'Total de Registros', stats.totalRegistros.toString(), '#6A1B9A');

    // Card 2: Plantões Fechados
    drawCard(pdf, 10 + cardWidth + 3, cardYPos, cardWidth, cardHeight, 'Plantões Fechados', stats.plantoesFechados.toString(), '#4CAF50');

    // Card 3: Plantões em Aberto
    drawCard(pdf, 10 + (cardWidth + 3) * 2, cardYPos, cardWidth, cardHeight, 'Plantões em Aberto', stats.plantoesAbertos.toString(), '#FF9800');

    // Card 4: Total de Horas
    drawCard(pdf, 10 + (cardWidth + 3) * 3, cardYPos, cardWidth, cardHeight, 'Total de Horas', stats.totalHoras, '#2196F3');

    yPosition = cardYPos + cardHeight + 10;

    // === TABELA ===
    const tableColumns = [
      { header: 'Cooperado', dataKey: 'cooperadoNome' },
      { header: 'Categoria Profissional', dataKey: 'categoriaProfissional' },
      { header: 'Hospital', dataKey: 'hospital' },
      { header: 'Setor', dataKey: 'setor' },
      { header: 'Data', dataKey: 'data' },
      { header: 'Entrada', dataKey: 'entrada' },
      { header: 'Saída', dataKey: 'saida' },
      { header: 'Total', dataKey: 'totalHoras' },
      { header: 'Status', dataKey: 'status' }
    ];

    autoTable(pdf, {
      columns: tableColumns,
      body: data,
      startY: yPosition,
      didDrawPage: (data) => {
        // Adicionar rodapé em cada página
        const pageSize = pdf.internal.pageSize;
        const pageHeight = pageSize.getHeight();
        const pageWidth = pageSize.getWidth();

        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          `Gerado em ${new Date().toLocaleString('pt-BR')} | Página ${data.pageNumber}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      },
      theme: 'grid',
      headStyles: {
        fillColor: [106, 27, 154], // Roxo
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 10
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245] // Cinza claro
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [0, 0, 0],
        halign: 'left'
      },
      margin: 10,
      didDrawCell: (data) => {
        // Colorir células de Status
        if (data.column.dataKey === 'status') {
          const cellValue = data.cell.text.toString();
          if (cellValue === 'Fechado') {
            data.cell.styles.textColor = [46, 125, 50]; // Verde
            data.cell.styles.fontStyle = 'bold';
          } else if (cellValue === 'Em Aberto') {
            data.cell.styles.textColor = [255, 152, 0]; // Laranja
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    // Salvar PDF
    pdf.save(`relatorio_producao_${new Date().toISOString().split('T')[0]}.pdf`);

    console.log('[reportExport] PDF exportado com sucesso');
  } catch (error) {
    console.error('[reportExport] Erro ao exportar PDF:', error);
    alert('Erro ao exportar PDF. Verifique o console.');
  }
};

/**
 * Função auxiliar para desenhar cards no PDF
 */
const drawCard = (
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  value: string,
  color: string
) => {
  // Extrair componentes RGB da cor hex
  const rgb = hexToRgb(color);
  pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
  pdf.setFillColor(rgb.r, rgb.g, rgb.b);

  // Desenhar caixa
  pdf.rect(x, y, width, height, 'FD');

  // Título (branco)
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);
  const titleLines = pdf.splitTextToSize(title, width - 2);
  pdf.text(titleLines, x + width / 2, y + 5, { align: 'center' });

  // Valor (branco, maior)
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text(value, x + width / 2, y + height / 1.5, { align: 'center' });
};

/**
 * Converter cor HEX para RGB
 */
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : { r: 106, g: 27, b: 154 }; // Roxo padrão
};

/**
 * Construir texto descritivo dos filtros aplicados
 */
const buildFilterText = (filters: ExportFilters): string => {
  const parts: string[] = [];

  if (filters.dataIni || filters.dataFim) {
    const dataIni = filters.dataIni ? filters.dataIni : '--';
    const dataFim = filters.dataFim ? filters.dataFim : '--';
    parts.push(`Período: ${dataIni} a ${dataFim}`);
  }

  if (filters.hospital && filters.hospital !== '') {
    parts.push(`Hospital: ${filters.hospital}`);
  }

  if (filters.setor && filters.setor !== '') {
    parts.push(`Setor: ${filters.setor}`);
  }

  if (filters.categoria && filters.categoria !== '') {
    parts.push(`Categoria: ${filters.categoria}`);
  }

  if (filters.cooperado && filters.cooperado !== '') {
    parts.push(`Cooperado: ${filters.cooperado}`);
  }

  return parts.length > 0 ? `Filtros: ${parts.join(' | ')}` : 'Sem filtros aplicados';
};

/**
 * Exportar dados de relatório para Excel por Cooperado (uma aba para cada cooperado)
 */
export const exportToExcelByCooperado = async (
  data: RelatorioRow[],
  filters: ExportFilters,
  stats: ExportStats
) => {
  try {
    const workbook = new Workbook.Workbook();
    
    // Agrupar dados por cooperado
    const cooperadosMap = new Map<string, RelatorioRow[]>();
    data.forEach((row) => {
      if (!cooperadosMap.has(row.cooperadoNome)) {
        cooperadosMap.set(row.cooperadoNome, []);
      }
      cooperadosMap.get(row.cooperadoNome)!.push(row);
    });

    // Criar uma aba para cada cooperado
    cooperadosMap.forEach((cooperadoData, cooperadoNome) => {
      const worksheet = workbook.addWorksheet(cooperadoNome.substring(0, 31)); // Excel limita nome a 31 caracteres

      // Definir largura das colunas
      worksheet.columns = [
        { header: 'Categoria Profissional', key: 'categoriaProfissional', width: 18 },
        { header: 'Hospital', key: 'hospital', width: 18 },
        { header: 'Setor', key: 'setor', width: 18 },
        { header: 'Data', key: 'data', width: 12 },
        { header: 'Entrada', key: 'entrada', width: 10 },
        { header: 'Saída', key: 'saida', width: 10 },
        { header: 'Total', key: 'totalHoras', width: 12 },
        { header: 'Status', key: 'status', width: 14 }
      ];

      // Estilizar cabeçalho
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6A1B9A' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      headerRow.height = 20;

      // Adicionar informações do cooperado no topo
      const infoRow = worksheet.insertRow(1, [`Cooperado: ${cooperadoNome} | Categoria Profissional: ${cooperadoData[0]?.categoriaProfissional}`]);
      infoRow.font = { bold: true, color: { argb: 'FF333333' } };
      infoRow.alignment = { horizontal: 'left' };

      // Adicionar dados
      cooperadoData.forEach((row) => {
        const newRow = worksheet.addRow({
          categoriaProfissional: row.categoriaProfissional,
          hospital: row.hospital,
          setor: row.setor,
          data: row.data,
          entrada: row.entrada,
          saida: row.saida,
          totalHoras: row.totalHoras,
          status: row.status
        });

        // Alternância de cores
        if (worksheet.lastRow && worksheet.lastRow.number % 2 === 0) {
          newRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
          });
        }

        // Alinhar células
        newRow.eachCell((cell) => {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        });

        // Formatar status
        if (newRow.getCell('status').value === 'Fechado') {
          newRow.getCell('status').font = { color: { argb: 'FF2E7D32' } };
        } else {
          newRow.getCell('status').font = { color: { argb: 'FFF57C00' } };
        }
      });

      // Adicionar linha em branco e resumo
      worksheet.addRow({});

      // Calcular total de horas para este cooperado
      const totalHoras = cooperadoData.reduce((acc, r) => {
        if (r.totalHoras === '--') return acc;
        const [hours, minutes] = r.totalHoras.replace('h', '').replace('m', '').split(' ').map(Number);
        return acc + hours + (minutes / 60);
      }, 0);

      const resumoRow = worksheet.addRow({
        categoriaProfissional: 'RESUMO DO COOPERADO',
        totalHoras: `${totalHoras.toFixed(1)}h`
      });

      resumoRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      resumoRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6A1B9A' } };
      resumoRow.eachCell((cell) => {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      });
    });

    // Gerar arquivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_producao_por_cooperado_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);

    console.log('[reportExport] Excel por Cooperado exportado com sucesso');
  } catch (error) {
    console.error('[reportExport] Erro ao exportar Excel por Cooperado:', error);
    alert('Erro ao exportar Excel. Verifique o console.');
  }
};

/**
 * Exportar dados de relatório para PDF por Cooperado (uma página para cada cooperado)
 */
export const exportToPDFByCooperado = async (
  data: RelatorioRow[],
  filters: ExportFilters,
  stats: ExportStats
) => {
  try {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Agrupar dados por cooperado
    const cooperadosMap = new Map<string, RelatorioRow[]>();
    data.forEach((row) => {
      if (!cooperadosMap.has(row.cooperadoNome)) {
        cooperadosMap.set(row.cooperadoNome, []);
      }
      cooperadosMap.get(row.cooperadoNome)!.push(row);
    });

    const cooperadosList = Array.from(cooperadosMap.entries());
    let isFirstPage = true;

    cooperadosList.forEach((entry, index) => {
      const [cooperadoNome, cooperadoData] = entry;

      if (!isFirstPage) {
        pdf.addPage();
      }
      isFirstPage = false;

      const pageWidth = pdf.internal.pageSize.getWidth();
      let yPosition = 15;

      // === CABEÇALHO MODERNO ===
      // LOGO
      const logoPath = '/logo-coptem.png';
      try {
        pdf.addImage(logoPath, 'PNG', 10, 7, 22, 14);
      } catch (err) {}

      // Informações institucionais
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(30, 30, 30);
      pdf.text('Nome:', 38, 13);
      pdf.text('CNPJ:', 38, 18);
      pdf.text('Período:', 38, 23);
      pdf.text('Gerado em:', 38, 28);

      pdf.setFont('helvetica', 'bold');
      pdf.text('Cooperativa de Trabalho dos Profissionais de Enfermagem do Ceará e das Demais Áreas da Saúde', 60, 13, { maxWidth: pageWidth - 62 });
      pdf.setFont('helvetica', 'normal');
      pdf.text('03031687000110', 60, 18);
      const periodo = (filters.dataIni && filters.dataFim) ? `Período: ${filters.dataIni} a ${filters.dataFim}` : 'Período não informado';
      pdf.text(periodo, 60, 23);
      const dataGeracao = new Date().toLocaleString('pt-BR');
      pdf.text(dataGeracao, 60, 28);

      // Página
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(`Página ${index + 1} de {n}`, pageWidth - 32, 13); // {n} será substituído pelo jsPDF

      // Título do relatório
      yPosition = 35;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(30, 30, 30);
      pdf.text(cooperadoNome, pageWidth / 2, yPosition, { align: 'center', maxWidth: pageWidth - 20 });
      yPosition += 8;

      // Categoria Profissional e info
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Categoria Profissional: ${cooperadoData[0]?.categoriaProfissional || 'N/A'}`, 10, yPosition);
      yPosition += 8;

      // Filtros aplicados (apenas na primeira página)
      if (index === 0) {
        const filterText = buildFilterText(filters);
        const splitFilterText = pdf.splitTextToSize(filterText, pageWidth - 20);
        pdf.setFontSize(9);
        pdf.text(splitFilterText, 10, yPosition);
        yPosition += splitFilterText.length * 4 + 3;
      }
      yPosition += 5;

      // === TABELA ===
      const tableColumns = [
        { header: 'Hospital', dataKey: 'hospital' },
        { header: 'Setor', dataKey: 'setor' },
        { header: 'Data', dataKey: 'data' },
        { header: 'Entrada', dataKey: 'entrada' },
        { header: 'Saída', dataKey: 'saida' },
        { header: 'Total', dataKey: 'totalHoras' },
        { header: 'Status', dataKey: 'status' }
      ];

      autoTable(pdf, {
        columns: tableColumns,
        body: cooperadoData,
        startY: yPosition,
        didDrawPage: (data) => {
          const pageSize = pdf.internal.pageSize;
          const pageHeight = pageSize.getHeight();
          const pageWidthLocal = pageSize.getWidth();
          pdf.setFontSize(8);
          pdf.setTextColor(150, 150, 150);
          pdf.text(
            `Gerado em ${new Date().toLocaleString('pt-BR')}`,
            pageWidthLocal / 2,
            pageHeight - 10,
            { align: 'center' }
          );
        },
        theme: 'grid',
        headStyles: {
          fillColor: [106, 27, 154],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 10
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [0, 0, 0],
          halign: 'left'
        },
        margin: 10,
        didDrawCell: (dataCell) => {
          if (dataCell.column.dataKey === 'status') {
            const cellValue = dataCell.cell.text.toString().toLowerCase();
            if (cellValue.includes('aprov')) { dataCell.cell.styles.textColor = [46, 125, 50]; dataCell.cell.styles.fontStyle = 'bold'; }
            else if (cellValue.includes('recus')) { dataCell.cell.styles.textColor = [198, 40, 40]; dataCell.cell.styles.fontStyle = 'bold'; }
            else if (cellValue.includes('pend')) { dataCell.cell.styles.textColor = [255, 152, 0]; dataCell.cell.styles.fontStyle = 'bold'; }
          }
        }
      });
    });

    // Salvar PDF
    pdf.save(`relatorio_producao_por_cooperado_${new Date().toISOString().split('T')[0]}.pdf`);

    console.log('[reportExport] PDF por Cooperado exportado com sucesso');
  } catch (error) {
    console.error('[reportExport] Erro ao exportar PDF por Cooperado:', error);
    alert('Erro ao exportar PDF. Verifique o console.');
  }
};

/**
 * Exportar histórico de justificativas para Excel
 */
export const exportJustificativasToExcel = async (
  data: Array<{
    dataSolicitacao: string;
    cooperado: string;
    hospital: string;
    setor: string;
    dataPlantao: string;
    entrada: string;
    saida: string;
    motivo: string;
    status: string;
    autorizadoPor: string;
    dataDecisao: string;
  }>,
  filters: ExportFilters,
  stats: JustificativaStats
) => {
  try {
    const workbook = new Workbook.Workbook();
    const worksheet = workbook.addWorksheet('Histórico de Justificativas');

    worksheet.columns = [
      { header: 'Data Solicitação', key: 'dataSolicitacao', width: 16 },
      { header: 'Cooperado', key: 'cooperado', width: 24 },
      { header: 'Hospital', key: 'hospital', width: 18 },
      { header: 'Setor', key: 'setor', width: 18 },
      { header: 'Data do Plantão', key: 'dataPlantao', width: 16 },
      { header: 'Entrada', key: 'entrada', width: 10 },
      { header: 'Saída', key: 'saida', width: 10 },
      { header: 'Motivo', key: 'motivo', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Autorizado Por', key: 'autorizadoPor', width: 16 },
      { header: 'Data Decisão', key: 'dataDecisao', width: 14 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6A1B9A' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 20;

    data.forEach((row) => {
      const newRow = worksheet.addRow(row);
      if (worksheet.lastRow && worksheet.lastRow.number % 2 === 0) {
        newRow.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
        });
      }
      newRow.eachCell((cell) => {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      });
      const statusCell = newRow.getCell('status');
      const val = String(statusCell.value || '').toLowerCase();
      if (val.includes('apro')) statusCell.font = { color: { argb: 'FF2E7D32' } };
      if (val.includes('recus')) statusCell.font = { color: { argb: 'FFC62828' } };
      if (val.includes('pend')) statusCell.font = { color: { argb: 'FFF57C00' } };
    });

    worksheet.addRow({});
    const resumoRow = worksheet.addRow({
      cooperado: 'RESUMO',
      hospital: `Total: ${stats.total} | Aprovadas: ${stats.aprovadas} | Recusadas: ${stats.recusadas} | Pendentes: ${stats.pendentes}`
    });
    resumoRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    resumoRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6A1B9A' } };

    const filterText = buildFilterText(filters);
    const filterRow = worksheet.insertRow(1, [filterText]);
    filterRow.font = { italic: true, color: { argb: 'FF666666' } };
    filterRow.alignment = { horizontal: 'left' };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historico_justificativas_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);

    console.log('[reportExport] Excel histórico de justificativas exportado');
  } catch (error) {
    console.error('[reportExport] Erro ao exportar Excel (justificativas):', error);
    alert('Erro ao exportar Excel. Verifique o console.');
  }
};

/**
 * Exportar histórico de justificativas para PDF
 */
export const exportJustificativasToPDF = async (
  data: Array<{
    dataSolicitacao: string;
    cooperado: string;
    hospital: string;
    setor: string;
    dataPlantao: string;
    entrada: string;
    saida: string;
    motivo: string;
    status: string;
    autorizadoPor: string;
    dataDecisao: string;
  }>,
  filters: ExportFilters,
  stats: JustificativaStats
) => {
  try {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    let yPosition = 15;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(106, 27, 154);
    pdf.text('HISTÓRICO DE JUSTIFICATIVAS DE PLANTÃO', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    const filterText = buildFilterText(filters);
    const splitFilterText = pdf.splitTextToSize(filterText, pageWidth - 20);
    pdf.text(splitFilterText, 10, yPosition);
    yPosition += splitFilterText.length * 5 + 5;

    const cardWidth = (pageWidth - 20) / 4 - 3;
    const cardHeight = 25;
    const cardYPos = yPosition;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    drawCard(pdf, 10, cardYPos, cardWidth, cardHeight, 'Total', String(stats.total), '#6A1B9A');
    drawCard(pdf, 10 + cardWidth + 3, cardYPos, cardWidth, cardHeight, 'Aprovadas', String(stats.aprovadas), '#4CAF50');
    drawCard(pdf, 10 + (cardWidth + 3) * 2, cardYPos, cardWidth, cardHeight, 'Recusadas', String(stats.recusadas), '#F44336');
    drawCard(pdf, 10 + (cardWidth + 3) * 3, cardYPos, cardWidth, cardHeight, 'Pendentes', String(stats.pendentes), '#FF9800');

    yPosition = cardYPos + cardHeight + 10;

    const tableColumns = [
      { header: 'Data Solicitação', dataKey: 'dataSolicitacao' },
      { header: 'Cooperado', dataKey: 'cooperado' },
      { header: 'Hospital', dataKey: 'hospital' },
      { header: 'Setor', dataKey: 'setor' },
      { header: 'Data do Plantão', dataKey: 'dataPlantao' },
      { header: 'Entrada', dataKey: 'entrada' },
      { header: 'Saída', dataKey: 'saida' },
      { header: 'Motivo', dataKey: 'motivo' },
      { header: 'Status', dataKey: 'status' },
      { header: 'Autorizado Por', dataKey: 'autorizadoPor' },
      { header: 'Data Decisão', dataKey: 'dataDecisao' }
    ];

    autoTable(pdf, {
      columns: tableColumns,
      body: data,
      startY: yPosition,
      didDrawPage: (dataCtx) => {
        const pageSize = pdf.internal.pageSize;
        const pageHeight = pageSize.getHeight();
        const pageWidthLocal = pageSize.getWidth();
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          `Gerado em ${new Date().toLocaleString('pt-BR')} | Página ${dataCtx.pageNumber}`,
          pageWidthLocal / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      },
      theme: 'grid',
      headStyles: { fillColor: [106, 27, 154], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 10 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      bodyStyles: { fontSize: 9, textColor: [0, 0, 0], halign: 'left' },
      margin: 10,
      didDrawCell: (dataCell) => {
        if (dataCell.column.dataKey === 'status') {
          const cellValue = dataCell.cell.text.toString().toLowerCase();
          if (cellValue.includes('aprov')) { dataCell.cell.styles.textColor = [46, 125, 50]; dataCell.cell.styles.fontStyle = 'bold'; }
          else if (cellValue.includes('recus')) { dataCell.cell.styles.textColor = [198, 40, 40]; dataCell.cell.styles.fontStyle = 'bold'; }
          else if (cellValue.includes('pend')) { dataCell.cell.styles.textColor = [255, 152, 0]; dataCell.cell.styles.fontStyle = 'bold'; }
        }
      }
    });

    pdf.save(`historico_justificativas_${new Date().toISOString().split('T')[0]}.pdf`);
    console.log('[reportExport] PDF histórico de justificativas exportado');
  } catch (error) {
    console.error('[reportExport] Erro ao exportar PDF (justificativas):', error);
    alert('Erro ao exportar PDF. Verifique o console.');
  }
};
