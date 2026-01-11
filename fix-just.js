                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                #!/usr/bin/env node

/**
 * Script para diagnosticar e reprocessar justificativas pendentes
 * 
 * Uso:
 *   npm run fix-just check          # Ver justificativas pendentes
 *   npm run fix-just reprocess      # Corrigir justificativas
 *   npm run fix-just check-pontos   # Ver pontos inconsistentes
 *   npm run fix-just fix-pontos     # Corrigir pontos
 */

import https from 'https';

// Usar domínio customizado sem proteção de preview
const BASE_URL = 'https://bypass-oezwbvluf-007-sistemas-projects.vercel.app';

const actionMap = {
  'check': 'check_justificativas',
  'reprocess': 'reprocess_justificativas',
  'check-pontos': 'check_pontos',
  'fix-pontos': 'fix_pontos'
};

const action = process.argv[2] || 'check';

if (!['check', 'reprocess', 'check-pontos', 'fix-pontos'].includes(action)) {
  console.error(`❌ Ação inválida: ${action}`);
  console.log('Ações disponíveis: check, reprocess, check-pontos, fix-pontos');
  process.exit(1);
}

const apiAction = actionMap[action];
const url = `${BASE_URL}/api/sync?action=${apiAction}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      
      if (res.statusCode === 200) {
        console.log(`✅ ${result.message || 'Operação realizada com sucesso'}\n`);
        
        if (result.total !== undefined) {
          console.log(`Total: ${result.total}\n`);
        }
        
        if (result.justificativas) {
          console.log('JUSTIFICATIVAS PENDENTES:');
          result.justificativas.forEach(j => {
            console.log(`  ID: ${j.id}`);
            console.log(`  Cooperado: ${j.cooperado_nome}`);
            console.log(`  Status: ${j.status}`);
            console.log(`  Validado por: ${j.validado_por || '-'}`);
            console.log(`  Rejeitado por: ${j.rejeitado_por || '-'}`);
            console.log('  ---');
          });
        }

        if (result.pontos) {
          console.log('PONTOS:');
          result.pontos.forEach(p => {
            console.log(`  ID: ${p.id}`);
            console.log(`  Cooperado: ${p.cooperado_nome}`);
            console.log(`  Status: ${p.status}`);
            console.log(`  Validado por: ${p.validado_por || '-'}`);
            console.log(`  Justificativa status: ${p.just_status || '-'}`);
            console.log('  ---');
          });
        }

        if (result.updated) {
          console.log('ATUALIZAÇÕES:');
          result.updated.forEach(u => {
            console.log(`  ${u.id}: ${u.oldStatus || u.status} → ${u.newStatus}`);
          });
        }
      } else {
        console.error(`❌ Erro: ${result.error || 'Desconhecido'}`);
        process.exit(1);
      }
    } catch (e) {
      console.error('❌ Erro ao processar resposta:', e.message);
      console.log('Resposta bruta:', data);
      process.exit(1);
    }
  });
}).on('error', (err) => {
  console.error('❌ Erro de conexão:', err.message);
  process.exit(1);
});
