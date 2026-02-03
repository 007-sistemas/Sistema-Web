// Script para remover tabela password_resets não utilizada
import { neon } from '@neondatabase/serverless';

const connectionString = "postgresql://neondb_owner:npg_lOhyE4z1QBtc@ep-dry-dawn-ahl0dlm6-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function removePasswordResets() {
  console.log('[CLEANUP] Removendo tabela password_resets não utilizada...');
  const sql = neon(connectionString);

  try {
    await sql`DROP TABLE IF EXISTS password_resets CASCADE`;
    console.log('✅ Tabela password_resets removida');

    console.log('\n📊 Tabelas finais no banco:');
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    tables.forEach(t => console.log(`   - ${t.table_name}`));

    console.log('\n✅ Limpeza final concluída!');
    console.log('\nBanco de dados otimizado com apenas as tabelas necessárias.');

  } catch (err) {
    console.error('❌ ERRO:', err.message);
    process.exit(1);
  }
}

removePasswordResets();
