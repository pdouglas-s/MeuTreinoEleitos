# Sistema de Histórico e Notificações

## Visão Geral

Sistema completo de histórico de treinos e notificações em tempo real para a plataforma Meu Treino Eleitos. Permite que alunos marquem treinos do dia, registrem progresso de exercícios e notifiquem professores automaticamente.

## Arquitetura

### Novas Coleções Firestore

#### `sessoes_treino`
Armazena sessões de treino (treino do dia) com histórico de exercícios concluídos.

```javascript
{
  id: string,
  treino_id: string,           // Referência ao treino
  aluno_id: string,            // UID do aluno
  professor_id: string,        // UID do professor responsável
  data_inicio: Timestamp,      // Quando aluno iniciou a sessão
  data_fim: Timestamp | null,  // Quando aluno finalizou (null = em andamento)
  status: 'em_andamento' | 'finalizado',
  exercicios: [                // Array de exercícios concluídos
    {
      exercicio_nome: string,
      series: number,
      repeticoes: number,
      carga: number,
      concluido_em: Timestamp  // Data/hora que marcou como concluído
    }
  ],
  created_at: Timestamp
}
```

#### `notificacoes`
Armazena notificações enviadas aos professores.

```javascript
{
  id: string,
  professor_id: string,        // UID do professor que recebe
  aluno_id: string,            // UID do aluno que gerou
  tipo: 'treino_iniciado' | 'exercicio_concluido' | 'treino_finalizado',
  mensagem: string,            // Mensagem formatada
  dados: object,               // Dados adicionais (treino_nome, exercicio_nome, etc)
  lida: boolean,               // Se professor já visualizou
  created_at: Timestamp
}
```

## Fluxo de Uso

### 1. Aluno Marca Treino do Dia

**Tela:** `AlunoHome` > `TreinoCard`

1. Aluno visualiza seus treinos
2. Clica no botão **"Iniciar Treino do Dia"** (azul)
3. Sistema cria nova `sessao_treino` com status `em_andamento`
4. Envia notificação ao professor: "Aluno X iniciou o treino Y"
5. Ícone de fitness (🏋️) aparece no card indicando sessão ativa
6. Checkboxes ficam habilitados para marcar exercícios

### 2. Aluno Conclui Exercícios

**Durante a sessão ativa:**

1. Aluno marca checkbox ao lado do exercício
2. Sistema salva no array `exercicios[]` da sessão com timestamp
3. Envia notificação ao professor: "Aluno X concluiu Supino (3x12)"
4. Exercício fica com check verde e texto riscado
5. Contador de progresso atualiza (ex: 3/5)

**Persistência:**
- Se aluno recarregar a página, sessão ativa é restaurada
- Exercícios já marcados continuam marcados
- Pode continuar de onde parou

### 3. Aluno Finaliza Sessão

1. Aluno clica em **"Finalizar Sessão"** (verde)
2. Se não completou todos exercícios, pede confirmação
3. Sistema atualiza sessão: `status = 'finalizado'`, `data_fim = agora`
4. Envia notificação ao professor: "Aluno X finalizou treino Y - 3/5 exercícios"
5. Sessão é resetada, pode iniciar nova sessão no futuro

### 4. Professor Recebe Notificações

**Tela:** `ProfessorHome`

- Badge vermelho no ícone de sino mostra contador de notificações não lidas
- Atualiza automaticamente a cada 30 segundos
- Clica no sino para acessar tela de notificações

**Tela:** `NotificacoesScreen`

- Lista de todas notificações (mais recentes primeiro)
- Notificações não lidas: fundo azul claro, borda azul, texto em negrito, ponto azul
- Notificações lidas: fundo branco, texto normal
- Ícones coloridos por tipo:
  - ▶️ Azul: Treino iniciado
  - ✅ Verde: Exercício concluído
  - 🏆 Dourado: Treino finalizado
- Pull-to-refresh para atualizar
- Botão "Marcar todas" para marcar tudo como lido
- Toque na notificação para marcar como lida

## Services Criados

### `historicoService.js`

```javascript
// Criar nova sessão
criarSessaoTreino(treinoId, alunoId, professorId)

// Marcar exercício como concluído
marcarExercicioConcluido(sessaoId, exercicioData)

// Finalizar sessão
finalizarSessao(sessaoId)

// Buscar sessão ativa de um treino
buscarSessaoAtiva(treinoId, alunoId)

// Listar sessões do aluno
listarSessoesAluno(alunoId, limite = 10)

// Listar sessões de todos alunos do professor
listarSessoesProfessor(professorId, limite = 20)

// Buscar histórico de um treino específico
buscarHistoricoTreino(treinoId)
```

### `notificacoesService.js`

```javascript
// Enviar notificação ao professor
enviarNotificacao(professorId, alunoId, tipo, dados)

// Listar notificações do professor
listarNotificacoesProfessor(professorId, somenteNaoLidas = false)

// Marcar como lida
marcarComoLida(notificacaoId)

// Marcar todas como lidas
marcarTodasComoLidas(professorId)

// Contar não lidas
contarNaoLidas(professorId)
```

## Regras Firestore

```javascript
// sessoes_treino: aluno cria/edita suas sessões, professor lê todas
match /sessoes_treino/{docId} {
  allow read: if request.auth != null && (
    isProfessor() || resource.data.aluno_id == request.auth.uid
  );
  allow create: if request.auth != null && 
    request.resource.data.aluno_id == request.auth.uid;
  allow update: if request.auth != null && 
    resource.data.aluno_id == request.auth.uid;
  allow delete: if false;
}

// notificacoes: aluno pode criar, professor lê e atualiza
match /notificacoes/{docId} {
  allow read: if request.auth != null && (
    resource.data.professor_id == request.auth.uid ||
    resource.data.aluno_id == request.auth.uid
  );
  allow create: if request.auth != null;
  allow update: if request.auth != null && 
    resource.data.professor_id == request.auth.uid;
  allow delete: if request.auth != null && 
    resource.data.professor_id == request.auth.uid;
}
```

## Componentes Atualizados

### `TreinoCard.js`

**Novas props necessárias:**
```javascript
<TreinoCard
  treino={treino}
  onOpen={handleOpen}
  alunoId={auth.currentUser.uid}
  professorId={treino.professor_id}
  alunoNome={profile.nome}
/>
```

**Principais mudanças:**
- useEffect carrega sessão ativa ao montar
- Restaura estado dos exercícios se há sessão ativa
- Botão "Iniciar Treino do Dia" (azul) quando não há sessão
- Botão "Finalizar Sessão" (verde) quando há sessão ativa
- Checkboxes desabilitados até iniciar sessão (cinza muito claro)
- Ícone de fitness no header quando sessão ativa
- Todas ações salvam no Firestore e enviam notificações

### `AlunoHome.js`

**Mudança:**
- Passa props adicionais para TreinoCard (alunoId, professorId, alunoNome)

### `ProfessorHome.js`

**Mudanças:**
- Botão de notificações no header com badge de contador
- useEffect carrega contador de notificações
- Intervalo de 30s para atualizar contador automaticamente
- Limpa intervalo ao desmontar

### `NotificacoesScreen.js` (NOVO)

**Tela completa de notificações:**
- Header com título e contador de não lidas
- Botão "Marcar todas" quando há não lidas
- FlatList com pull-to-refresh
- Cards de notificação com ícones coloridos
- Formato de data relativo (Agora, 5m atrás, 2h atrás)
- Toque para marcar como lida
- Empty state quando não há notificações

## Utilizando o Sistema

### Como Aluno

1. Faça login como aluno
2. Na tela inicial, veja seus treinos
3. Escolha um treino e clique em "Iniciar Treino do Dia"
4. Marque cada exercício conforme completar
5. Ao finalizar, clique em "Finalizar Sessão"
6. Seu professor será notificado em tempo real!

### Como Professor

1. Faça login como professor
2. No header, veja o sino com badge de notificações
3. Clique no sino para ver todas notificações
4. Notificações em azul são não lidas
5. Toque para marcar como lida
6. Use "Marcar todas" para limpar contador

## Arquivos Criados/Modificados

**Novos:**
- `src/services/historicoService.js`
- `src/services/notificacoesService.js`
- `src/screens/Professor/NotificacoesScreen.js`

**Modificados:**
- `src/components/TreinoCard.js`
- `src/screens/Aluno/AlunoHome.js`
- `src/screens/Professor/ProfessorHome.js`
- `functions/index.js`
- `firestore.rules`
- `App.js`

## Resumo Semanal Automático (Domingo)

Foi adicionada uma Cloud Function agendada para enviar um resumo semanal para cada atleta.

- **Função:** `enviarResumoSemanalAtletas`
- **Agenda:** todo domingo, às 21:00 (`America/Sao_Paulo`)
- **Fonte dos dados:** coleção `sessoes_treino` (`status = finalizado`)
- **Conteúdo do resumo:**
  - total de treinos finalizados na semana
  - intensidade média (`nivel_esforco`)
  - até 3 feedbacks da semana
- **Anti-duplicidade:** valida `dados.semana_chave` para não enviar 2x na mesma semana

### Deploy da Cloud Function

```bash
firebase deploy --only functions
```

Ou somente a função do resumo:

```bash
firebase deploy --only functions:enviarResumoSemanalAtletas
```

## Próximos Passos Sugeridos

1. **Tela de Histórico Detalhado:** Visualizar todas sessões passadas de um aluno
2. **Gráficos de Progresso:** Estatísticas de conclusão ao longo do tempo
3. **Notificações Push:** Usar Firebase Cloud Messaging para push notifications
4. **Filtros de Notificações:** Filtrar por aluno, tipo, data
5. **Comentários:** Professor pode comentar em sessões finalizadas
6. **Metas:** Definir metas semanais/mensais de treinos

## Deploy das Regras

Para aplicar as novas regras do Firestore:

```bash
firebase deploy --only firestore:rules
```

Ou atualizar manualmente no Firebase Console > Firestore Database > Regras
