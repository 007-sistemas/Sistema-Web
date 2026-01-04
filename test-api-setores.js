// Teste direto da API de setores
const API_URL = 'https://bypass-lime.vercel.app';

async function testarAPI() {
  console.log('=== TESTE: GET /api/setores ===');
  try {
    const res = await fetch(`${API_URL}/api/setores`);
    const data = await res.json();
    console.log('✅ Setores no banco:', data);
  } catch (err) {
    console.error('❌ Erro GET:', err);
  }

  console.log('\n=== TESTE: POST /api/setores ===');
  try {
    const novoSetor = {
      id: crypto.randomUUID(),
      nome: `Teste ${new Date().toLocaleTimeString()}`
    };
    console.log('Enviando:', novoSetor);
    
    const res = await fetch(`${API_URL}/api/setores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoSetor)
    });
    
    if (!res.ok) {
      const error = await res.text();
      console.error('❌ Erro POST:', res.status, error);
    } else {
      const data = await res.json();
      console.log('✅ Resposta POST:', data);
    }
  } catch (err) {
    console.error('❌ Erro POST:', err);
  }

  console.log('\n=== TESTE: GET novamente ===');
  try {
    const res = await fetch(`${API_URL}/api/setores`);
    const data = await res.json();
    console.log('✅ Setores após POST:', data);
  } catch (err) {
    console.error('❌ Erro GET final:', err);
  }
}

testarAPI();
