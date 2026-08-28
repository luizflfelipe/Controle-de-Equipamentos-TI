# Arquitetura de Informação

| Campo | Informação |
| --- | --- |
| Classificação | Uso interno |
| Proprietário | Equipe de TI e Recepção |
| Aprovador | Gestão de TI |
| Revisão | Trimestral ou quando houver alteração de fluxo ou acesso |
| Fontes | `src/App.tsx`, `src/components/` e `server.ts` |

## Públicos e objetivos

| Público | Objetivo principal | Áreas permitidas |
| --- | --- | --- |
| Suporte TI | Registrar devoluções e abrir solicitações logísticas. | Formulário, dashboard e Motoboy. |
| Recepção | Registrar retorno e executar a etapa operacional do Motoboy. | Formulário, dashboard e Motoboy. |
| Usuário sem papel Motoboy | Consultar áreas gerais após autenticação. | Formulário e dashboard; Motoboy retorna 403. |

O controle é baseado no e-mail armazenado na sessão, não no cabeçalho `x-user-email` enviado pelo navegador. Esse cabeçalho não é fonte de decisão de autorização no backend.

## Mapa de navegação

```text
Login
  -> Formulário de devolução
     -> Dashboard
     -> Motoboy
        -> Pendentes
        -> Concluídas
        -> Excluídas (até 7 dias na interface)
```

## Fluxo: desligamento e ativo

| Etapa | Informação recebida | Regra aplicada | Resultado |
| --- | --- | --- | --- |
| Identificação | Nome do colaborador | Obrigatório no backend. | Busca global por nome normalizado. |
| Equipamentos | Lista e quantidade | Pode estar vazia no schema atual. | Texto consolidado na planilha. |
| Situação | Devolução ou desligamento | Interface mapeia para `Devolvido` ou `Desligamento`. | Atualiza `Equip. Devolvido`. |
| Recebimento | Data atual | Preenchida somente para devolução vinda do Portal Web. | Atualiza coluna de recebido. |
| Consolidação | Aba mensal | Data de desligamento define a aba para novo registro; existente mantém sua aba. | Histórico mensal. |

O script aceita somente registros cuja filial contenha `Barra Funda` na importação por e-mail e nas métricas do dashboard.

## Fluxo: Motoboy

| Estado | Condição de entrada | Próximo estado possível |
| --- | --- | --- |
| `Pendente` | Solicitação criada. | `Em andamento`, `Pendente de recebimento`, `Concluído`, `Excluído`. |
| `Em andamento` | Enviado, máquina retirada ou rastreio informado. | `Pendente de recebimento`, `Concluído`, `Excluído`. |
| `Pendente de recebimento` | Enviado = Sim e recebido = Não. | `Concluído`, `Excluído`. |
| `Concluído` | Recebido = Sim. | `Excluído` pela rota disponível. |
| `Excluído` | Exclusão com justificativa. | Retido por até 7 dias na UI; Supabase pode purgar depois. |

## Matriz de permissões

| Ação | Suporte | Recepção | Sem papel |
| --- | --- | --- | --- |
| Criar solicitação Motoboy | Sim | Não | Não |
| Listar solicitações Motoboy | Sim | Sim | Não |
| Atualizar logística | Não | Sim | Não |
| Excluir com justificativa | Sim | Sim | Não |
| Consultar eventos | Sim, com Supabase | Sim, com Supabase | Não |

## Regras de apresentação

- Pendentes excluem `Concluído` e `Excluído`.
- Concluídas mostram somente `Concluído`.
- Excluídas mostram `Excluído` enquanto a data de exclusão estiver em até sete dias; sem data válida o item permanece visível preventivamente.
- O dashboard mostra até 15 pendências e 50 devoluções recentes, ordenadas do mais recente para o mais antigo.
