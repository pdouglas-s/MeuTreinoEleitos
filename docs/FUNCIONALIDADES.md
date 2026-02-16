# Funcionalidades do Sistema

Este documento descreve as funcionalidades atualmente disponíveis no MeuTreinoEleitos, organizadas por módulos e perfis de acesso.

## 1. Visão Geral

O sistema é uma plataforma de gestão de treinos com múltiplos perfis:

- `admin_sistema`: governança global da plataforma.
- `admin_academia`: gestão operacional da academia.
- `professor`: montagem e manutenção de treinos.
- `aluno`: execução dos treinos e acompanhamento do progresso.

A aplicação utiliza:

- Firebase Authentication (login e senha).
- Cloud Firestore (dados de usuários, treinos, itens, notificações, etc.).
- Regras de segurança no Firestore para isolamento por academia e controle de permissões.

---

## 2. Fluxos de Acesso e Autenticação

### 2.1 Login

- Entrada por e-mail e senha.
- Validação de e-mail no formulário.
- Redirecionamento automático por perfil:
  - `admin_sistema` → área de administração do sistema.
  - `admin_academia` → área de administração da academia.
  - `professor` → área do professor.
  - `aluno` → área do aluno.

### 2.2 Primeiro acesso

- Usuários com `primeiro_acesso = true` são encaminhados para troca de senha.
- Após troca bem-sucedida:
  - senha é atualizada no Auth,
  - campo `primeiro_acesso` é atualizado no Firestore,
  - usuário é redirecionado para a tela do seu perfil.

### 2.3 Cadastro público inicial

- O cadastro público (tela de registro) é permitido apenas para criar o primeiro `admin_sistema`.
- Após existir admin do sistema (via `system/admin_lock`), o cadastro público é desabilitado.

---

## 3. Funcionalidades por Perfil

## 3.1 Admin do Sistema (`admin_sistema`)

### Gestão de Academias

- Cadastrar novas academias.
- Visualizar lista de academias cadastradas.

### Gestão de Admin de Academia

- Criar usuários `admin_academia` vinculados a uma academia existente.

### Dashboard Gerencial

- Indicadores globais:
  - total de academias,
  - total de alunos,
  - total de professores,
  - total de admins de academia,
  - total de treinos,
  - total de notificações.
- Insights:
  - média de alunos por academia,
  - academia com maior número de alunos,
  - visão por academia (alunos/professores/admins/treinos/notificações).

### Segurança operacional

- Pode gerenciar dados em escopo global, respeitando regras de segurança.

---

## 3.2 Admin da Academia (`admin_academia`)

### Gestão de Alunos

- Criar aluno com nome e e-mail.
- Senha padrão definida por variável de ambiente.
- Aluno criado com `primeiro_acesso = true`.

### Gestão de Professores

- Criar professor com nome e e-mail.
- Senha padrão definida por variável de ambiente.
- Professor criado com `primeiro_acesso = true`.
- Listar professores da própria academia.
- Excluir professor da própria academia (com bloqueio de e-mail no sistema).

### Banco de Exercícios

- Acesso à tela de gerenciamento do banco de exercícios.
- Criar exercícios personalizados.
- Editar nome de exercício.
- Excluir exercício.
- Inicializar/reinicializar exercícios padrão.
- Excluir exercícios padrão.

### Indicadores locais

- Cards de resumo com quantidade de alunos, treinos e notificações.

---

## 3.3 Professor (`professor`)

### Montagem de Ficha

- Criar treino modelo (sem aluno).
- Criar treino já vinculado a um aluno.

### Gestão de Treinos

- Listar treinos próprios (filtrados por professor e academia) e treinos padrão disponíveis.
- Abrir detalhe do treino.
- Excluir treino (quando permitido pelas regras).

### Edição de Treino (detalhe)

- Alterar nome do treino.
- Adicionar e remover exercícios do treino.
- Buscar exercício por categoria no banco.
- Associar treino a aluno.

### Regra de vínculo múltiplo por aluno (nova lógica)

Quando um treino já vinculado é alterado para outro aluno:

- o vínculo anterior é preservado,
- o sistema cria um novo vínculo (novo treino) para o novo aluno,
- os exercícios são copiados para o novo vínculo,
- há aviso visual antes de salvar,
- há confirmação explícita antes de criar novo vínculo,
- botão muda dinamicamente para "Criar novo vínculo".

### Notificações

- Acesso ao centro de notificações.
- Contador de não lidas.
- Marcar uma ou todas como lidas.

---

## 3.4 Aluno (`aluno`)

### Home do Aluno

- Lista de treinos vinculados ao aluno.
- Carregamento de itens de cada treino.
- Indicador de quantidade de treinos disponíveis.

### Execução de treino (TreinoCard)

- Iniciar sessão de treino.
- Marcar exercício concluído.
- Editar peso (carga) do exercício durante execução.
- Visualizar progresso (ex.: concluídos/total).
- Finalizar sessão com:
  - nível de esforço (escala com emoji),
  - feedback opcional.

### Continuidade

- Recupera sessão ativa em andamento ao voltar para a tela.

### Notificações

- Acesso ao centro de notificações.
- Contador de não lidas.
- Marcar uma ou todas como lidas.

---

## 4. Notificações do Sistema

Tipos de eventos suportados no fluxo atual:

- `treino_iniciado`
- `exercicio_concluido`
- `treino_finalizado`
- `treino_associado`
- `resumo_semanal`

Comportamentos:

- listagem por perfil (professor/admin vs aluno),
- identificação visual por tipo (ícones e cores),
- marcação individual e em lote como lida.

---

## 5. Banco de Exercícios

Módulo de cadastro e manutenção de exercícios com:

- nome,
- categoria,
- séries padrão,
- repetições padrão,
- origem (padrão/personalizado).

Permite uso em montagem de treino para acelerar prescrição.

---

## 6. Segurança e Regras de Negócio

## 6.1 Controle por perfil

As regras de segurança no Firestore aplicam permissões por papel (`role`) e por `academia_id`.

## 6.2 Isolamento por academia

Usuários de uma academia não acessam dados de outra (com exceções administrativas globais do `admin_sistema`).

## 6.3 Criação de usuários

- `admin_sistema`: bootstrap inicial e governança.
- `admin_academia`: criado por `admin_sistema` e obrigatoriamente vinculado à academia existente.
- `professor`: criação restrita ao `admin_academia`.
- `aluno`: criação por equipe da academia (conforme regras vigentes).

## 6.4 Treinos

- Professor cria treinos no escopo da própria academia.
- Leitura de treinos considera regras por perfil, vínculo com aluno e treinamentos padrão.

---

## 7. Estrutura de Dados (alto nível)

Coleções principais:

- `users`
- `academias`
- `system` (ex.: `admin_lock`)
- `emails_bloqueados`
- `treinos`
- `treino_itens`
- `exercicios`
- `sessoes_treino`
- `notificacoes`
- `avaliacoes`

---

## 8. Fluxos Críticos Implementados

- Bloqueio de cadastro público após primeiro admin do sistema.
- Forçar troca de senha em primeiro acesso.
- Separação de áreas por perfil (admin sistema, admin academia, professor, aluno).
- Persistência e listagem de treinos por academia/professor.
- Reassociação de treino com criação de novo vínculo e preservação do vínculo anterior.

---

## 9. Observações Operacionais

- As funcionalidades dependem de regras do Firestore atualizadas em produção.
- Mudanças de regra/permissão exigem deploy de `firestore.rules`.
- Testes automatizados existentes cobrem serviços, componentes e snapshots principais.
