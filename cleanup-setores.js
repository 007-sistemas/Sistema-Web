// Script para limpar duplicatas de setores
import { neon } from '@neondatabase/serverless';

const connectionString = "postgresql://neondb_owner:npg_lOhyE4z1QBtc@ep-dry-dawn-ahl0dlm6-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function cleanupSetores() {
  console.log('[CLEANUP] Limpando duplicatas de setores...');
  const sql = neon(connectionString);

  try {
    // 1. Encontrar duplicatas
    const duplicates = await sql`
      SELECT LOWER(nome) as nome_lower, COUNT(*) as count, array_agg(id) as ids
      FROM setores
      GROUP BY LOWER(nome)
      HAVING COUNT(*) > 1
    `;

    console.log(`✅ Encontradas ${duplicates.length} duplicatas`);

    // 2. Para cada duplicata, manter o primeiro e redirecionar relacionamentos
    for (const dup of duplicates) {
      const ids = dup.ids;
      const keepId = ids[0];
      const removeIds = ids.slice(1);

      console.log(`\n  Duplicata: ${dup.nome_lower} (${dup.count}x)`);
      console.log(`    Mantendo: ${keepId}`);
      console.log(`    Removendo: ${removeIds.join(', ')}`);

      // Redirecionar relacionamentos para o setor que será mantido
      for (const removeId of removeIds) {
        // Copiar relacionamentos
        await sql`
          INSERT INTO hospital_setores (hospital_id, setor_id)
          SELECT hospital_id, ${keepId} FROM hospital_setores 
          WHERE setor_id = ${removeId}
          ON CONFLICT (hospital_id, setor_id) DO NOTHING
        `;

        // Remover setor duplicado
        await sql`DELETE FROM hospital_setores WHERE setor_id = ${removeId}`;
        await sql`DELETE FROM setores WHERE id = ${removeId}`;
      }
    }

    console.log('\n✅ Limpeza concluída!');

    // 3. Verificar resultado
    const finalSetores = await sql`SELECT id, nome FROM setores ORDER BY nome`;
    console.log(`\n📚 Setores únicos agora (${finalSetores.length}):`);
    finalSetores.forEach(s => console.log(`   - ${s.nome}`));

    const finalCount = await sql`SELECT COUNT(*) as total FROM hospital_setores`;
    console.log(`\n📊 Total de relacionamentos: ${finalCount[0].total}`);

  } catch (err) {
    console.error('❌ ERRO:', err.message);
    console.error(err);
    process.exit(1);
  }
}

cleanupSetores();
