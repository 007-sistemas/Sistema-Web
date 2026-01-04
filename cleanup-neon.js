// Script para limpar colunas não utilizadas no Neon
import { neon } from '@neondatabase/serverless';

const connectionString = "postgresql://neondb_owner:npg_lOhyE4z1QBtc@ep-dry-dawn-ahl0dlm6-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function cleanupNeon() {
  console.log('[CLEANUP] Limpando banco de dados Neon...');
  const sql = neon(connectionString);

  try {
    // 1. Remover colunas não utilizadas de hospitals
    console.log('\n🗑️  Removendo colunas desnecessárias de hospitals...');
    
    try {
      await sql`ALTER TABLE hospitals DROP COLUMN IF EXISTS endereco`;
      console.log('  ✅ Removido: hospitals.endereco (JSONB)');
    } catch (e) {
      console.log('  ⚠️  endereco já foi removido ou não existe');
    }

    try {
      await sql`ALTER TABLE hospitals DROP COLUMN IF EXISTS setores`;
      console.log('  ✅ Removido: hospitals.setores (JSONB)');
    } catch (e) {
      console.log('  ⚠️  setores já foi removido ou não existe');
    }

    // 2. Verificar estrutura final de hospitals
    console.log('\n📋 Estrutura final de hospitals:');
    const hospitalsCols = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'hospitals'
      ORDER BY ordinal_position
    `;
    hospitalsCols.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable === 'YES'})`);
    });

    // 3. Verificar tabelas existentes
    console.log('\n📊 Tabelas no banco:');
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    tables.forEach(t => console.log(`   - ${t.table_name}`));

    // 4. Verificar índices
    console.log('\n🔍 Índices:');
    const indexes = await sql`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `;
    indexes.forEach(idx => console.log(`   ${idx.tablename}: ${idx.indexname}`));

    // 5. Verificar foreign keys
    console.log('\n🔗 Foreign Keys:');
    const fks = await sql`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_name
    `;
    if (fks.length === 0) {
      console.log('   (Nenhuma constraint encontrada)');
    } else {
      fks.forEach(fk => console.log(`   ${fk.table_name}.${fk.column_name} → ${fk.referenced_table}.${fk.referenced_column}`));
    }

    console.log('\n✅ Limpeza concluída!');
    console.log('\n📚 Banco pronto para produção com apenas as tabelas necessárias:');
    console.log('   - audit_logs');
    console.log('   - biometrias');
    console.log('   - cooperados');
    console.log('   - hospital_setores (relacionamento N:N)');
    console.log('   - hospitals');
    console.log('   - justificativas');
    console.log('   - managers');
    console.log('   - pontos');
    console.log('   - setores');

  } catch (err) {
    console.error('❌ ERRO:', err.message);
    console.error(err);
    process.exit(1);
  }
}

cleanupNeon();
