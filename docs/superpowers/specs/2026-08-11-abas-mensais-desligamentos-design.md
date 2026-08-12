# Design: Abas mensais de desligamentos

## Objetivo

Automatizar a escolha da aba de desligamentos no Apps Script durante a transicao para producao. O sistema deve gravar novos desligamentos na aba correspondente ao mes atual, sem troca manual da propriedade `DESLIGAMENTOS_SHEET_NAME`.

## Decisao aprovada

O Apps Script deve escolher a aba pelo mes atual no momento do registro, usando o timezone configurado no proprio script.

Exemplos:

- Registro feito em agosto: grava na aba `Agosto`.
- Registro feito em setembro: grava na aba `Setembro`.

O dashboard deve consultar somente a aba do mes atual, mantendo a visao operacional focada no periodo corrente.

## Escopo

Incluido:

- Resolver dinamicamente o nome da aba mensal de desligamentos.
- Criar a aba mensal automaticamente quando ela nao existir.
- Inicializar a aba criada com `DESLIGAMENTOS_HEADERS`.
- Usar a mesma regra mensal em `registerDesligamento_` e `getDashboardData_`.
- Manter o retorno `sheet` da API indicando a aba onde o registro foi gravado.

Fora de escopo:

- Alteracoes no fluxo Motoboy.
- Mudancas de UI no React.
- Leitura historica de todas as abas mensais no dashboard.
- Migracao automatica de dados ja existentes da aba `Desligamentos`.

## Arquitetura

A mudanca fica concentrada em `apps-script/Code.gs`.

Sera criada uma funcao auxiliar para calcular o nome da aba mensal com base em uma data e no timezone do Apps Script. Essa funcao retornara nomes em portugues no formato usado pela planilha: `Janeiro`, `Fevereiro`, `Março`, `Abril`, `Maio`, `Junho`, `Julho`, `Agosto`, `Setembro`, `Outubro`, `Novembro`, `Dezembro`.

Outra funcao auxiliar retornara a aba de desligamentos atual chamando `getSheet_` com o nome mensal calculado. Com isso, a logica existente de criacao de aba e garantia de cabecalhos permanece reaproveitada.

## Fluxo de Dados

1. O frontend envia o registro de desligamento para o backend.
2. O backend valida o payload e repassa ao Apps Script.
3. O Apps Script chama `registerDesligamento_`.
4. `registerDesligamento_` resolve a aba mensal pelo mes atual.
5. Se a aba nao existir, `getSheet_` cria a aba e aplica os cabecalhos.
6. O registro e inserido na aba mensal.
7. A resposta informa o nome da aba usada.

Para o dashboard:

1. O backend chama `getDashboardData`.
2. O Apps Script resolve a aba mensal pelo mes atual.
3. O dashboard e calculado somente a partir dessa aba.

## Tratamento de Erros

Se a planilha de desligamentos nao estiver configurada, o erro atual de `getSheet_` continua sendo usado.

Se a aba mensal ainda nao existir, isso nao e erro: ela sera criada automaticamente.

Se o timezone do script estiver incorreto, a aba pode virar de mes em horario inesperado. A configuracao de timezone do Apps Script deve ser mantida como `America/Sao_Paulo`.

## Testes

Adicionar ou ajustar verificacao automatizada para confirmar que:

- O codigo nao depende mais de `DESLIGAMENTOS_SHEET_NAME` para registros de desligamento.
- A rotina de desligamentos usa uma funcao de aba mensal.
- O dashboard usa a mesma funcao de aba mensal.
- O fluxo Motoboy continua usando `MOTOBOY_SHEET_NAME`.

## Compatibilidade de Producao

A propriedade `DESLIGAMENTOS_SHEET_NAME` pode permanecer configurada sem afetar o novo fluxo mensal, mas deixa de controlar os registros e o dashboard de desligamentos.

Dados antigos na aba `Desligamentos` nao serao exibidos no dashboard mensal depois da mudanca. Essa decisao e intencional porque a visao aprovada para producao e somente do mes atual.
