# Idev - Instruções para Agentes de IA

## Visão Geral

**Idev** é um sistema web de gestão biométrica e controle de ponto para cooperativas médicas/hospitalares. Construído em **React 19 + TypeScript + Vite**, com backend em **Vercel Functions** e banco de dados **PostgreSQL (Neon)**.

## Arquitetura

### Stack Tecnológico
- **Frontend**: React 19, TypeScript, Vite, Lucide Icons, Recharts (gráficos)
- **Backend**: Vercel Serverless Functions (Node.js) em `api/`
- **Banco de Dados**: PostgreSQL via Neon (@neondatabase/serverless)
- **Storage Cliente**: localStorage (seed data e sessão)
- **Biometria**: DigitalPersona SDK (JavaScript, carregado em `public/js/`)

### Estrutura de Pastas
```
api/           → Vercel Functions (setup, cooperados, biometrics)
components/    → Componentes React reutilizáveis (Layout, BiometricCapture, ScannerMock)
services/      → Lógica de negócio (api.ts, storage.ts, biometry.ts)
views/         → Páginas completas (Dashboard, BiometriaManager, Login, etc)
public/js/     → SDKs de biometria (DigitalPersona, WebSDK)
```

## Padrões Principais

### 1. Autenticação & Permissões
- Duas roles de acesso: **Managers** (administradores) e **Hospitals** (instituições)
- Permissões baseadas em `HospitalPermissions` (interface em `types.ts`)
- Fluxo: Login → `StorageService.authenticate()` → Sessão armazenada → Acesso by role
- Usuário padrão: `gabriel/gabriel` com todas as permissões

**Exemplo de uso:**
```tsx
// App.tsx: Valida permissão antes de renderizar view
if (!userPermissions[currentView as keyof HospitalPermissions]) {
  return <div>Acesso não autorizado.</div>;
}
```

### 2. StorageService - Camada de Dados
Localizado em `services/storage.ts` (448 linhas), gerencia tudo via localStorage:
- `getCooperados()`, `saveCooperado()` - Cooperados/equipe médica
- `getPontos()`, `savePonto()` - Registros de ponto/produção
- `logAudit()` - Rastreamento de ações
- `authenticate()` - Validação de credenciais
- `getSession()`, `setSession()`, `clearSession()` - Gerenciamento de sessão

**Importante**: Há dois níveis de dados:
1. **localStorage** (dev/fallback): dados de seed + histórico local
2. **Neon PostgreSQL** (produção): tabelas persistidas via `api/setup`

### 3. Serviço de Biometria
`services/biometry.ts` encapsula o DigitalPersona SDK:
- `enumerateDevices()` - Detecta leitores de digitais conectados
- `startAcquisition()` - Inicia captura de impressão
- `stopAcquisition()` - Encerra captura
- Suporta **ScannerMock** para testes sem hardware
- SDK carregado globalmente como `window.Fingerprint`

### 4. API Client Pattern
`services/api.ts` - Funções genéricas tipadas:
```typescript
apiGet<T>(path: string): Promise<T>
apiPost<T>(path: string, body: any): Promise<T>
// Uso: const users = await apiGet<User[]>('cooperados')
```

## Fluxos de Negócio Críticos

### Registro de Ponto/Biometria
1. Usuário seleciona cooperado em `BiometriaManager`
2. Captura impressão via `DigitalPersonaService.startAcquisition()`
3. `handleScanSuccess()` cria `Biometria` com hash da digital
4. `StorageService.saveCooperado()` persiste + `logAudit()` registra ação
5. Localmente sincronizado; em produção vai para `POST /api/biometrics`

### Dashboard & Relatórios
- Renderiza dados de `StorageService.getPontos()` e `getCooperados()`
- Usa **Recharts** para gráficos (veja `Dashboard.tsx`)
- Filtros por período, especialidade, status cooperado

### Views Principais
| View | Arquivo | Função |
|------|---------|--------|
| Dashboard | `views/Dashboard.tsx` | Resumo de produção, gráficos |
| Registro de Ponto | `views/PontoMachine.tsx` | Captura biométrica + ponto |
| Biometria | `views/BiometriaManager.tsx` | Gestão de digitais por cooperado |
| Cooperados | `views/CooperadoRegister.tsx` | CRUD de equipe médica |
| Auditoria | `views/AuditLogViewer.tsx` | Logs de ações do sistema |
| Relatórios | `views/RelatorioProducao.tsx` | Produção por período |

## Tarefas Comuns

### Adicionar Nova View
1. Criar arquivo em `views/MeuModulo.tsx` como componente React
2. Adicionar case em `App.tsx` switch statement
3. Importar em `App.tsx` 
4. Adicionar item em `Layout.tsx` → `allNavItems` com ícone + permissionKey
5. Adicionar interface de permissão em `types.ts` → `HospitalPermissions`

### Integrar Dados com Neon
1. Criar função handler em `api/novo-endpoint.ts`
2. Usar `neon(connectionString)` para queries SQL
3. Consumir via `apiPost<T>('/novo-endpoint', data)`
4. Considerar cache local com `StorageService` para offline

### Adicionar Auditoria
```typescript
StorageService.logAudit('TIPO_ACAO', `Descrição da ação`);
// Exemplos: 'CADASTRO_BIOMETRIA', 'LOGIN_SUCESSO', 'ALTERACAO_COOPERADO'
```

## Configuração & Build

### Desenvolvimento Local
```bash
npm install
npm run dev      # Inicia Vite em http://localhost:5173
```

### Build & Deploy
```bash
npm run build    # Gera dist/ otimizado
npm run preview  # Testa build localmente
# Deploy: Git push para Vercel (conectado automaticamente)
```

### Variáveis de Ambiente
- `DATABASE_URL` - PostgreSQL connection string (Vercel Project Settings)
- `GEMINI_API_KEY` - Para integração com IA (opcional, não usado atualmente)

### Inicializar Banco de Dados
```bash
# Em produção (Vercel)
POST https://<seu-deploy>/api/setup

# Localmente com Vercel CLI
vercel dev
curl -X POST http://localhost:3000/api/setup
```

## Pontos de Atenção

1. **SDK Biometria Lazy-Loading**: O DigitalPersona é carregado em `public/html` e verificado em `App.tsx` via polling. Em ambiente de teste, use `ScannerMock` ou `BiometricCapture` para debug.

2. **localStorage vs PostgreSQL**: Atualmente a maioria dos dados vive em localStorage (seed data). Em produção, migrar lógica para Neon conforme necessário.

3. **TypeScript Strict**: Projeto usa ES2022 com `jsx: "react-jsx"`. Sempre tipar componentes e funções.

4. **Tailwind + Lucide**: UI usa Tailwind CSS (não visto em imports, assume global) e Lucide para ícones. Mantenha consistência visual com cores `primary-*`.

5. **Permissões Granulares**: Sempre verificar `userPermissions` antes de renderizar features sensíveis. Não confie apenas em validação UI.

## Exemplos Úteis

### Query de Cooperados
```typescript
// Local
const cooperados = StorageService.getCooperados();

// API (produção)
const cooperados = await apiGet<Cooperado[]>('cooperados');
```

### Atualizar Cooperado com Biometria
```typescript
const updated = { ...cooperado, biometrias: [...cooperado.biometrias, novaBio] };
StorageService.saveCooperado(updated);
StorageService.logAudit('CADASTRO_BIOMETRIA', `Bio adicionada para ${updated.nome}`);
```

### Renderizar Condicionalmente por Permissão
```tsx
{permissions?.biometria && <BiometriaManager />}
{permissions?.relatorio && <RelatorioProducao />}
```

## Convenções de Código

- **Nomes em Português**: Variáveis, funções, comentários em português (usuários são brasileiros)
- **Types.ts**: Fonte única de verdade para interfaces
- **Services**: Lógica pura (sem JSX), reutilizável
- **Views vs Components**: Views = páginas completas; Components = reutilizáveis
- **Exports**: Use `export const` para componentes/funções, não default exports quando possível

---

**Última atualização**: Dezembro 2025  
**Contato**: Gabriel Gomes  
**Repositório**: GitHub/Sistema-Web
