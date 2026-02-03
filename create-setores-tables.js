// Script para criar tabelas de setores no Neon
import { neon } from '@neondatabase/serverless';

const connectionString = "postgresql://neondb_owner:npg_lOhyE4z1QBtc@ep-dry-dawn-ahl0dlm6-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function createSetoresTables() {
  console.log('[SETUP] Conectando ao Neon...');
  const sql = neon(connectionString);

  try {
    // Criar tabela setores
    console.log('[SETUP] Criando tabela setores...');
    await sql`
      CREATE TABLE IF NOT EXISTS setores (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL
      );
    `;
    console.log('✅ Tabela setores criada com sucesso');

    // Criar tabela hospital_setores (muitos para muitos)
    console.log('[SETUP] Criando tabela hospital_setores...');
    await sql`
      CREATE TABLE IF NOT EXISTS hospital_setores (
        hospital_id TEXT REFERENCES hospitals(id) ON DELETE CASCADE,
        setor_id TEXT REFERENCES setores(id) ON DELETE CASCADE,
        PRIMARY KEY (hospital_id, setor_id)
      );
    `;
    console.log('✅ Tabela hospital_setores criada com sucesso');

    // Verificar criação
    const setoresTest = await sql`SELECT * FROM setores LIMIT 1;`;
    const hospitalSetoresTest = await sql`SELECT * FROM hospital_setores LIMIT 1;`;
    
    console.log('\n✅ SUCESSO! Tabelas criadas no Neon:');
    console.log('   - setores');
    console.log('   - hospital_setores');
    
  } catch (err) {
    console.error('❌ ERRO:', err.message);
    console.error(err);
    process.exit(1);
  }
}

createSetoresTables();
