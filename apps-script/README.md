# Google Apps Script

## Arquivos

Este projeto usa Apps Scripts separados por planilha.

Para a planilha de Desligados, copie todo o conteúdo de `apps-script/Desligados-prod.gs` para o arquivo `Code.gs` do projeto Apps Script configurado em `GOOGLE_SCRIPT_URL`.

Para a planilha de Motoboy, copie todo o conteúdo de `apps-script/Controle-Motoboy-homologacao.gs` para o arquivo `Code.gs` do projeto Apps Script configurado em `MOTOBOY_GOOGLE_SCRIPT_URL`.

Exemplo:

`https://script.google.com/macros/s/<deployment-id>/exec`

Não publique `apps-script/Code.gs` no projeto de Desligados enquanto ele estiver misturando fluxos de Desligados e Motoboy.

## Propriedades Obrigatórias

No projeto Apps Script de Desligados, o arquivo `Desligados-prod.gs` usa o ID da planilha em `CFG.SPREADSHEET_ID`.

No projeto Apps Script de Motoboy, abra `Configurações do projeto` > `Propriedades do script` e crie:

```text
MOTOBOY_SPREADSHEET_ID=<id-da-planilha-de-motoboy>
```

Opcional para Motoboy, se o nome da aba for diferente do padrão:

```text
MOTOBOY_SHEET_NAME=Motoboy
```

O ID da planilha é o trecho entre `/d/` e `/edit` na URL do Google Sheets.

## Deploy

Depois de colar o código correto de cada Apps Script e configurar as propriedades necessárias:

1. Clique em `Implantar` > `Gerenciar implantações`.
2. Edite a implantação atual.
3. Em `Versão`, selecione `Nova versão`.
4. Garanta que o acesso esteja como `Qualquer pessoa`.
5. Clique em `Implantar`.

## Teste

Abra no navegador:

```text
https://script.google.com/macros/s/<deployment-id>/exec?action=getDashboardData
```

Resposta esperada para Desligados:

```json
{"success":true,"data":{"totalDesligamentos":0}}
```

Depois valide a URL real configurada em `.env`:

```bash
node scripts/validate-live-desligados-dashboard.mjs
```

Se a validação acusar meses no formato `08/2026` ou `equipamentosMensal` igual a `mensalData`, a implantação de Desligados ainda está com código legado.
