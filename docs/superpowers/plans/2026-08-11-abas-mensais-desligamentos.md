# Abas Mensais de Desligamentos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o Apps Script gravar desligamentos e calcular o dashboard sempre na aba do mes atual.

**Architecture:** A mudanca fica concentrada em `apps-script/Code.gs`. Uma funcao resolve o nome da aba mensal pelo timezone do Apps Script e outra funcao retorna a aba mensal atual reaproveitando `getSheet_`, que ja cria abas ausentes e garante cabecalhos.

**Tech Stack:** Google Apps Script, JavaScript ES5-compatible, Node.js verification scripts with `node:assert/strict`.

## Global Constraints

- Usar o mes atual no momento do registro, baseado no timezone configurado no Apps Script.
- O dashboard deve consultar somente a aba do mes atual.
- Nao alterar o fluxo Motoboy.
- Nao alterar a UI React.
- Nao migrar dados antigos da aba `Desligamentos`.
- A propriedade `DESLIGAMENTOS_SHEET_NAME` pode permanecer configurada, mas nao deve controlar registros nem dashboard de desligamentos.

---

## File Structure

- Modify: `apps-script/Code.gs`
  - Add monthly sheet helpers.
  - Replace fixed `DESLIGAMENTOS_SHEET_NAME` usage in the desligamentos registration and dashboard paths.
  - Keep Motoboy sheet lookup unchanged.
- Create: `scripts/verify-monthly-desligamentos-sheet.mjs`
  - Static contract verification for the monthly sheet behavior.
- Modify: `package.json`
  - Add a script entry so the monthly sheet contract can be run consistently.

---

### Task 1: Monthly Sheet Contract Verification

**Files:**
- Create: `scripts/verify-monthly-desligamentos-sheet.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `apps-script/Code.gs` as source text.
- Produces: npm script `verify:monthly-desligamentos-sheet`.

- [ ] **Step 1: Write the failing verification script**

Create `scripts/verify-monthly-desligamentos-sheet.mjs`:

```js
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync("apps-script/Code.gs", "utf8");

for (const token of [
  "function getCurrentDesligamentosSheet_()",
  "return getSheet_(DESLIGAMENTOS_SPREADSHEET_ID, getCurrentMonthSheetName_(), DESLIGAMENTOS_HEADERS)",
  "function getCurrentMonthSheetName_(date)",
  "Session.getScriptTimeZone()",
  "Utilities.formatDate(date || new Date(), Session.getScriptTimeZone(), \"M\")",
  "\"Janeiro\"",
  "\"Fevereiro\"",
  "\"Março\"",
  "\"Abril\"",
  "\"Maio\"",
  "\"Junho\"",
  "\"Julho\"",
  "\"Agosto\"",
  "\"Setembro\"",
  "\"Outubro\"",
  "\"Novembro\"",
  "\"Dezembro\""
]) {
  assert.ok(source.includes(token), `missing monthly sheet token: ${token}`);
}

assert.ok(
  source.includes("function registerDesligamento_(data)") &&
    source.includes("const sheet = getCurrentDesligamentosSheet_();"),
  "registerDesligamento_ must use current monthly desligamentos sheet"
);

assert.ok(
  source.includes("function getDashboardData_()") &&
    source.includes("const sheet = getCurrentDesligamentosSheet_();"),
  "getDashboardData_ must use current monthly desligamentos sheet"
);

assert.ok(
  source.includes("const sheet = getSheet_(MOTOBOY_SPREADSHEET_ID, MOTOBOY_SHEET_NAME, MOTOBOY_HEADERS);"),
  "Motoboy must continue using MOTOBOY_SHEET_NAME"
);

console.log("monthly desligamentos sheet contract verified");
```

- [ ] **Step 2: Add the package script**

Modify `package.json` scripts block to include:

```json
"verify:monthly-desligamentos-sheet": "node scripts/verify-monthly-desligamentos-sheet.mjs"
```

Place it after `"lint": "tsc --noEmit"` and keep valid JSON commas:

```json
"lint": "tsc --noEmit",
"verify:monthly-desligamentos-sheet": "node scripts/verify-monthly-desligamentos-sheet.mjs",
"start": "node server.ts"
```

- [ ] **Step 3: Run the verification to confirm it fails**

Run:

```bash
npm run verify:monthly-desligamentos-sheet
```

Expected: FAIL with `missing monthly sheet token: function getCurrentDesligamentosSheet_()`.

- [ ] **Step 4: Commit the failing verification**

```bash
git add package.json scripts/verify-monthly-desligamentos-sheet.mjs
git commit -m "test: add monthly desligamentos sheet contract"
```

---

### Task 2: Apps Script Monthly Sheet Selection

**Files:**
- Modify: `apps-script/Code.gs`
- Test: `scripts/verify-monthly-desligamentos-sheet.mjs`

**Interfaces:**
- Consumes: `getSheet_(spreadsheetPropertyName, sheetName, defaultHeaders)`.
- Produces: `getCurrentDesligamentosSheet_(): GoogleAppsScript.Spreadsheet.Sheet`
- Produces: `getCurrentMonthSheetName_(date?: Date): string`

- [ ] **Step 1: Add the monthly helper functions**

In `apps-script/Code.gs`, add these functions after `fetchExternal_(url)` and before `getSheet_(...)`:

```js
function getCurrentDesligamentosSheet_() {
  return getSheet_(DESLIGAMENTOS_SPREADSHEET_ID, getCurrentMonthSheetName_(), DESLIGAMENTOS_HEADERS);
}

function getCurrentMonthSheetName_(date) {
  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro"
  ];
  const monthNumber = Number(Utilities.formatDate(date || new Date(), Session.getScriptTimeZone(), "M"));
  return monthNames[monthNumber - 1];
}
```

- [ ] **Step 2: Route registration to the monthly sheet**

In `registerDesligamento_(data)`, replace:

```js
const sheet = getSheet_(DESLIGAMENTOS_SPREADSHEET_ID, DESLIGAMENTOS_SHEET_NAME, DESLIGAMENTOS_HEADERS);
```

with:

```js
const sheet = getCurrentDesligamentosSheet_();
```

- [ ] **Step 3: Route dashboard to the monthly sheet**

In `getDashboardData_()`, replace:

```js
const sheet = getSheet_(DESLIGAMENTOS_SPREADSHEET_ID, DESLIGAMENTOS_SHEET_NAME, DESLIGAMENTOS_HEADERS);
```

with:

```js
const sheet = getCurrentDesligamentosSheet_();
```

- [ ] **Step 4: Run the monthly verification**

Run:

```bash
npm run verify:monthly-desligamentos-sheet
```

Expected: PASS with `monthly desligamentos sheet contract verified`.

- [ ] **Step 5: Run the existing Apps Script contract**

Run:

```bash
node scripts/verify-apps-script.mjs
```

Expected: PASS with `apps script contract verified`.

- [ ] **Step 6: Run type checking**

Run:

```bash
npm run lint
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 7: Commit the implementation**

```bash
git add apps-script/Code.gs
git commit -m "feat: use monthly desligamentos sheets"
```

---

### Task 3: Production Notes Update

**Files:**
- Modify: `docs/prod-transition-notes.md`

**Interfaces:**
- Consumes: implemented monthly sheet behavior from Task 2.
- Produces: production transition documentation that reflects the completed decision.

- [ ] **Step 1: Update the production note**

Replace the current bullet:

```md
- Automatizar selecao da aba mensal de desligamentos no Apps Script caso a rotina atual por data deixe de atender o fluxo de producao. O comportamento esperado e escolher a aba correta, como `Julho` ou `Agosto`, sem troca manual em `DESLIGAMENTOS_SHEET_NAME`.
```

with:

```md
- Aba mensal de desligamentos automatizada no Apps Script: novos registros e dashboard usam a aba do mes atual, como `Julho` ou `Agosto`, sem troca manual em `DESLIGAMENTOS_SHEET_NAME`.
```

- [ ] **Step 2: Run final verification**

Run:

```bash
npm run verify:monthly-desligamentos-sheet
node scripts/verify-apps-script.mjs
npm run lint
```

Expected:

```text
monthly desligamentos sheet contract verified
apps script contract verified
```

`npm run lint` exits with code 0 and no TypeScript errors.

- [ ] **Step 3: Commit the docs update**

```bash
git add docs/prod-transition-notes.md
git commit -m "docs: update prod transition monthly sheet note"
```

---

## Self-Review

Spec coverage:

- Monthly registration sheet selection: Task 2.
- Dashboard reads only the current month sheet: Task 2.
- Auto-create missing month sheet with headers: Task 2 reuses `getSheet_`.
- Motoboy unchanged: Task 1 verification and Task 2 scoped edits.
- No UI changes and no historical migration: Global Constraints and no frontend tasks.
- Production note reflects completed transition: Task 3.

Placeholder scan:

- No placeholders remain.

Type and name consistency:

- `getCurrentDesligamentosSheet_` and `getCurrentMonthSheetName_` names are consistent across tasks and tests.
- The package script name is consistently `verify:monthly-desligamentos-sheet`.
