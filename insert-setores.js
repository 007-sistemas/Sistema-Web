// Script para inserir setores iniciais no Neon
import { neon } from '@neondatabase/serverless';

const connectionString = "postgresql://neondb_owner:npg_lOhyE4z1QBtc@ep-dry-dawn-ahl0dlm6-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function insertSetores() {
  console.log('[INSERT] Conectando ao Neon...');
  const sql = neon(connectionString);

  try {
    // Inserir UTI
    const id1 = crypto.randomUUID();
    await sql`INSERT INTO setores (id, nome) VALUES (${id1}, 'UTI')`;
    console.log('✅ UTI inserida:', id1);

    // Inserir CME
    const id2 = crypto.randomUUID();
    await sql`INSERT INTO setores (id, nome) VALUES (${id2}, 'CME')`;
    console.log('✅ CME inserida:', id2);

    // Verificar
    const result = await sql`SELECT * FROM setores ORDER BY nome`;
    console.log('\n✅ Setores no banco:');
    result.forEach(s => console.log(`   ${s.id} - ${s.nome}`));
    
  } catch (err) {
    console.error('❌ ERRO:', err.message);
    console.error(err);
    process.exit(1);
  }
}

insertSetores();
