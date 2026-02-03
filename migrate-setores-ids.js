// Script para migrar IDs de setores de UUID para números sequenciais
import { neon } from '@neondatabase/serverless';

const connectionString = "postgresql://neondb_owner:npg_lOhyE4z1QBtc@ep-dry-dawn-ahl0dlm6-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function migrateSetoresIds() {
  console.log('[MIGRATE] Migrando IDs de setores para números sequenciais...');
  const sql = neon(connectionString);

  try {
    // 1. Obter setores atuais e criar mapeamento em memória
    console.log('\n📋 Criando mapeamento...');
    const setoresAtuais = await sql`SELECT id, nome FROM setores ORDER BY nome`;
    
    const mapping = setoresAtuais.map((s, index) => ({
      old_id: s.id,
      new_id: index + 1,
      nome: s.nome
    }));

    console.log(`✅ Mapeamento criado (${mapping.length} setores):`);
    mapping.forEach(m => console.log(`   ${m.new_id}. ${m.nome} (era ${m.old_id})`));

    // 2. Criar nova tabela setores com ID numérico
    console.log('\n🔨 Criando nova estrutura de setores...');
    await sql`DROP TABLE IF EXISTS setores_new CASCADE`;
    await sql`
      CREATE TABLE setores_new (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL UNIQUE
      )
    `;

    // 3. Inserir setores na ordem correta
    console.log('📥 Inserindo setores...');
    for (const m of mapping) {
      await sql`
        INSERT INTO setores_new (id, nome)
        VALUES (${m.new_id}, ${m.nome})
      `;
    }

    // Resetar sequência
    await sql`
      SELECT setval('setores_new_id_seq', (SELECT MAX(id) FROM setores_new))
    `;

    // 4. Criar nova tabela hospital_setores
    console.log('\n🔨 Criando nova estrutura hospital_setores...');
    await sql`DROP TABLE IF EXISTS hospital_setores_new CASCADE`;
    await sql`
      CREATE TABLE hospital_setores_new (
        id SERIAL PRIMARY KEY,
        hospital_id TEXT NOT NULL,
        setor_id INTEGER NOT NULL,
        UNIQUE(hospital_id, setor_id)
      )
    `;

    // 5. Migrar relacionamentos com novos IDs
    console.log('🔄 Migrando relacionamentos...');
    const oldRelations = await sql`SELECT hospital_id, setor_id FROM hospital_setores`;
    
    for (const rel of oldRelations) {
      const newSetorId = mapping.find(m => m.old_id === rel.setor_id)?.new_id;
      if (newSetorId) {
        await sql`
          INSERT INTO hospital_setores_new (hospital_id, setor_id)
          VALUES (${rel.hospital_id}, ${newSetorId})
          ON CONFLICT DO NOTHING
        `;
      }
    }

    const newRelations = await sql`SELECT COUNT(*) as total FROM hospital_setores_new`;
    console.log(`✅ ${newRelations[0].total} relacionamentos migrados`);

    // 6. Substituir tabelas antigas pelas novas
    console.log('\n♻️  Substituindo tabelas...');
    await sql`DROP TABLE hospital_setores CASCADE`;
    await sql`DROP TABLE setores CASCADE`;
    await sql`ALTER TABLE setores_new RENAME TO setores`;
    await sql`ALTER TABLE hospital_setores_new RENAME TO hospital_setores`;

    // 7. Recriar foreign keys
    console.log('🔗 Criando foreign keys...');
    await sql`
      ALTER TABLE hospital_setores
      ADD CONSTRAINT fk_hospital 
      FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
    `;
    
    await sql`
      ALTER TABLE hospital_setores
      ADD CONSTRAINT fk_setor
      FOREIGN KEY (setor_id) REFERENCES setores(id) ON DELETE CASCADE
    `;

    // 8. Criar índices para performance
    console.log('📇 Criando índices...');
    await sql`CREATE INDEX idx_hospital_setores_hospital ON hospital_setores(hospital_id)`;
    await sql`CREATE INDEX idx_hospital_setores_setor ON hospital_setores(setor_id)`;

    // 9. Verificar resultado final
    console.log('\n✅ Migração completa! Verificando...');
    
    const finalSetores = await sql`SELECT id, nome FROM setores ORDER BY id`;
    console.log(`\n📚 Setores (${finalSetores.length}):`);
    finalSetores.forEach(s => console.log(`   ${s.id}. ${s.nome}`));

    const finalRelations = await sql`
      SELECT h.nome as hospital, s.nome as setor
      FROM hospital_setores hs
      JOIN hospitals h ON hs.hospital_id = h.id
      JOIN setores s ON hs.setor_id = s.id
      ORDER BY h.nome, s.nome
    `;
    console.log(`\n🔗 Relacionamentos (${finalRelations.length}):`);
    finalRelations.forEach(r => console.log(`   ${r.hospital} → ${r.setor}`));

  } catch (err) {
    console.error('❌ ERRO:', err.message);
    console.error(err);
    process.exit(1);
  }
}

migrateSetoresIds();
