# Google Apps Script

## Arquivo

Copie todo o conteúdo de `apps-script/Code.gs` para o arquivo `Code.gs` do projeto Apps Script configurado em `GOOGLE_SCRIPT_URL`.

Exemplo:

`https://script.google.com/macros/s/<deployment-id>/exec`

O deploy atual está retornando `Função de script não encontrada: doGet`, então o script publicado ainda não tem o código necessário.

## Propriedades Obrigatórias

No editor do Apps Script, abra `Configurações do projeto` > `Propriedades do script` e crie:

```text
DESLIGAMENTOS_SPREADSHEET_ID=<id-da-planilha-de-desligamentos>
MOTOBOY_SPREADSHEET_ID=<id-da-planilha-de-motoboy>
```

Opcional, se os nomes das abas forem diferentes dos padrões:

```text
DESLIGAMENTOS_SHEET_NAME=Desligamentos
MOTOBOY_SHEET_NAME=Motoboy
```

O ID da planilha é o trecho entre `/d/` e `/edit` na URL do Google Sheets.

## Deploy

Depois de colar o código e configurar as propriedades:

1. Clique em `Implantar` > `Gerenciar implantações`.
2. Edite a implantação atual.
3. Em `Versão`, selecione `Nova versão`.
4. Garanta que o acesso esteja como `Qualquer pessoa`.
5. Clique em `Implantar`.

## Teste

Abra no navegador:

```text
https://script.google.com/macros/s/<deployment-id>/exec?action=ping
```

Resposta esperada:

```json
{"success":true,"message":"Apps Script online"}
```
