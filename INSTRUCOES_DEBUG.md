# 🔧 PASSOS PARA RESOLVER O PROBLEMA LOCAL

## 1️⃣ Limpar Cache do Navegador

### Chrome/Edge:
1. Abra http://localhost:3000
2. Pressione `Ctrl + Shift + Delete`
3. Selecione "Imagens e arquivos em cache"
4. Clique em "Limpar dados"
5. OU simplesmente: `Ctrl + Shift + R` (hard reload)

### Firefox:
1. Pressione `Ctrl + Shift + Delete`
2. Selecione "Cache"
3. Clique em "Limpar agora"
4. OU: `Ctrl + F5` (hard reload)

## 2️⃣ Testar em Aba Anônima/Privada

- Chrome: `Ctrl + Shift + N`
- Firefox: `Ctrl + Shift + P`
- Edge: `Ctrl + Shift + N`

Isso garante que não há cache interferindo.

## 3️⃣ Verificar Console do Navegador

Abra o DevTools (F12) e procure por:
- `[AutorizacaoPonto] Aprovando justificativa:`
- `[AutorizacaoPonto] Atualizando ponto principal:`
- `[ControleDeProducao] Pontos com validadoPor:`

Se esses logs não aparecerem, o código antigo ainda está em cache.

## 4️⃣ Forçar Rebuild do Vite

No terminal onde o `vercel dev` está rodando:
1. Pare o servidor (Ctrl + C)
2. Delete a pasta `.vercel` (se existir)
3. Execute novamente: `vercel dev`

## 5️⃣ Usar a Página de Debug

1. Acesse: http://localhost:3000/debug-justificativas.html
2. Essa página mostra EXATAMENTE o que está no localStorage
3. Se após aprovar/rejeitar NÃO aparecer os campos preenchidos, então há problema no código
4. Se aparecer na página de debug MAS NÃO no Espelho da Biometria, então o problema é na renderização

---

## ⚠️ SOBRE FAZER DEPLOY NO VERCEL

**Só faça deploy DEPOIS de confirmar que funciona localmente!**

Se não funcionar local, também não vai funcionar no Vercel.

O Vercel vai:
✅ Compilar o código mais recente
✅ Não ter cache do navegador
❌ MAS se o código estiver errado, vai continuar errado

---

## 🎯 PRÓXIMO PASSO

**Execute os testes acima e me informe:**

1. O que aparece na página debug-justificativas.html depois de aprovar/rejeitar?
2. Você vê os logs `[AutorizacaoPonto]` no console?
3. Testou em aba anônima?

Com essas informações, vou saber se é cache ou se há bug no código.
