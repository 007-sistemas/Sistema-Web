import Workbook from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface RelatorioRow {
  cooperadoNome: string;
  especialidade: string;
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

/**
 * Exportar dados de relatório para Excel (.xlsx)
 */
export const exportToExcel = async (
  data: RelatorioRow[],
  filters: ExportFilters,
  stats: ExportStats
) => {
  try {
    const workbook = new Workbook.Workbook();
    const worksheet = workbook.addWorksheet('Relatório de Produção');

    // Definir largura das colunas
    worksheet.columns = [
      { header: 'Cooperado', key: 'cooperadoNome', width: 20 },
      { header: 'Categoria', key: 'especialidade', width: 18 },
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

    // === CABEÇALHO ===
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(106, 27, 154); // Roxo
    pdf.text('RELATÓRIO DE PRODUÇÃO', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 10;

    // Filtros aplicados
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100); // Cinza
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
      { header: 'Categoria', dataKey: 'especialidade' },
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
        { header: 'Categoria', key: 'especialidade', width: 18 },
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
      const infoRow = worksheet.insertRow(1, [`Cooperado: ${cooperadoNome} | Especialidade: ${cooperadoData[0]?.especialidade}`]);
      infoRow.font = { bold: true, color: { argb: 'FF333333' } };
      infoRow.alignment = { horizontal: 'left' };

      // Adicionar dados
      cooperadoData.forEach((row) => {
        const newRow = worksheet.addRow({
          especialidade: row.especialidade,
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
        especialidade: 'RESUMO DO COOPERADO',
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

      // === CABEÇALHO ===
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(106, 27, 154); // Roxo
      pdf.text(`Relatório: ${cooperadoNome}`, pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 8;

      // Especialidade e info
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Especialidade: ${cooperadoData[0]?.especialidade || 'N/A'}`, 10, yPosition);

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
          const pageWidth = pageSize.getWidth();

          pdf.setFontSize(8);
          pdf.setTextColor(150, 150, 150);
          pdf.text(
            `Gerado em ${new Date().toLocaleString('pt-BR')}`,
            pageWidth / 2,
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
        didDrawCell: (data) => {
          if (data.column.dataKey === 'status') {
            const cellValue = data.cell.text.toString();
            if (cellValue === 'Fechado') {
              data.cell.styles.textColor = [46, 125, 50];
              data.cell.styles.fontStyle = 'bold';
            } else if (cellValue === 'Em Aberto') {
              data.cell.styles.textColor = [255, 152, 0];
              data.cell.styles.fontStyle = 'bold';
            }
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
