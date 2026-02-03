// Script de migração: transferir setores do JSONB para hospital_setores
import { neon } from '@neondatabase/serverless';

const connectionString = "postgresql://neondb_owner:npg_lOhyE4z1QBtc@ep-dry-dawn-ahl0dlm6-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function migrateSetores() {
  console.log('[MIGRATE] Iniciando migração de setores...');
  const sql = neon(connectionString);

  try {
    // 1. Buscar todos os hospitais com setores em JSONB
    console.log('[MIGRATE] Buscando hospitais com setores em JSONB...');
    const hospitals = await sql`
      SELECT id, nome, setores FROM hospitals 
      WHERE setores IS NOT NULL AND jsonb_array_length(setores) > 0
    `;
    console.log(`✅ Encontrados ${hospitals.length} hospitais com setores`);

    // 2. Para cada hospital, inserir seus setores em hospital_setores
    let count = 0;
    for (const hospital of hospitals) {
      if (!hospital.setores || !Array.isArray(hospital.setores)) continue;
      
      for (const setor of hospital.setores) {
        try {
          // Primeiro garantir que o setor existe em setores
          await sql`
            INSERT INTO setores (id, nome) 
            VALUES (${setor.id}, ${setor.nome})
            ON CONFLICT (id) DO NOTHING
          `;
          
          // Então vincular hospital ao setor
          await sql`
            INSERT INTO hospital_setores (hospital_id, setor_id)
            VALUES (${hospital.id}, ${setor.id})
            ON CONFLICT (hospital_id, setor_id) DO NOTHING
          `;
          count++;
          console.log(`  ✓ ${hospital.nome} → ${setor.nome}`);
        } catch (err) {
          console.error(`  ✗ Erro ao inserir ${hospital.nome} → ${setor.nome}:`, err.message);
        }
      }
    }

    console.log(`\n✅ Migração concluída! ${count} relacionamentos inseridos.`);

    // 3. Verificar resultado
    const result = await sql`SELECT COUNT(*) as total FROM hospital_setores`;
    console.log(`\n📊 Total de relacionamentos em hospital_setores: ${result[0].total}`);

    // 4. Listar todos os setores agora globais
    const allSetores = await sql`SELECT id, nome FROM setores ORDER BY nome`;
    console.log(`\n📚 Setores globais (${allSetores.length}):`);
    allSetores.forEach(s => console.log(`   - ${s.nome}`));

  } catch (err) {
    console.error('❌ ERRO na migração:', err.message);
    console.error(err);
    process.exit(1);
  }
}

migrateSetores();
