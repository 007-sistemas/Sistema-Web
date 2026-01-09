import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

// Carregar .env.local manualmente
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const connectionString = process.env.DATABASE_URL;

console.log('DATABASE_URL:', connectionString ? '✅ Configurada' : '❌ Não configurada');

if (!connectionString) {
  console.error('DATABASE_URL não configurada');
  process.exit(1);
}

const sql = neon(connectionString);

async function checkJustificativas() {
  try {
    console.log('Buscando justificativas pendentes...\n');

    const justificativas = await sql`
      SELECT 
        id,
        cooperado_id,
        cooperado_nome,
        ponto_id,
        status,
        validado_por,
        rejeitado_por,
        data_solicitacao,
        updated_at
      FROM justificativas
      WHERE status = 'Pendente'
      ORDER BY data_solicitacao DESC
    `;

    console.log(`Total de justificativas Pendentes: ${justificativas.length}\n`);
    
    if (justificativas.length === 0) {
      console.log('✅ Nenhuma justificativa pendente encontrada!');
      return;
    }

    justificativas.forEach((j) => {
      console.log(`ID: ${j.id}`);
      console.log(`Cooperado: ${j.cooperado_nome}`);
      console.log(`Status: ${j.status}`);
      console.log(`Validado por: ${j.validado_por || '-'}`);
      console.log(`Rejeitado por: ${j.rejeitado_por || '-'}`);
      console.log(`Atualizado em: ${j.updated_at}`);
      console.log('---');
    });

    console.log('\n\n=== VERIFICANDO PONTOS RELACIONADOS ===\n');
    
    // Verificar pontos relacionados às justificativas pendentes
    const pontoIds = justificativas.map(j => j.ponto_id).filter(Boolean);
    
    if (pontoIds.length > 0) {
      const pontos = await sql`
        SELECT 
          id,
          cooperado_nome,
          tipo,
          entrada,
          saida,
          status,
          validado_por,
          rejeitado_por,
          timestamp
        FROM pontos
        WHERE id = ANY(${pontoIds})
        ORDER BY timestamp DESC
      `;

      console.log(`Pontos relacionados: ${pontos.length}\n`);
      pontos.forEach((p) => {
        console.log(`Ponto ID: ${p.id}`);
        console.log(`Tipo: ${p.tipo}`);
        console.log(`Status: ${p.status}`);
        console.log(`Validado por: ${p.validado_por || '-'}`);
        console.log(`Rejeitado por: ${p.rejeitado_por || '-'}`);
        console.log('---');
      });
    }

  } catch (error) {
    console.error('Erro ao consultar banco:', error);
    process.exit(1);
  }
}

checkJustificativas();
