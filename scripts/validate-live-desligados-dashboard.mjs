import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

function readEnvValue(name) {
  const env = readFileSync(".env", "utf8");
  const line = env.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim() : "";
}

const scriptUrl = readEnvValue("GOOGLE_SCRIPT_URL");
assert.ok(scriptUrl, "GOOGLE_SCRIPT_URL must be configured in .env");

const url = new URL(scriptUrl);
url.searchParams.set("action", "getDashboardData");

const response = await fetch(url);
const text = await response.text();

let payload;
try {
  payload = JSON.parse(text);
} catch {
  throw new Error(`Apps Script did not return JSON. First 120 chars: ${text.slice(0, 120)}`);
}

assert.equal(payload.success, true, payload.error || "Apps Script returned success=false");

const data = payload.data;
assert.ok(data, "Apps Script response must include data");

const issues = [];
const firstMonth = data.mensalData?.[0]?.month || "";
const firstEquipMonth = data.equipamentosMensal?.[0]?.month || "";

if (/^\d{2}\/\d{4}$/.test(firstMonth)) {
  issues.push(`mensalData still uses legacy month format: ${firstMonth}`);
}

if (/^\d{2}\/\d{4}$/.test(firstEquipMonth)) {
  issues.push(`equipamentosMensal still uses legacy month format: ${firstEquipMonth}`);
}

if (JSON.stringify(data.equipamentosMensal || []) === JSON.stringify(data.mensalData || [])) {
  issues.push("equipamentosMensal still mirrors mensalData instead of summing equipment quantities");
}

if (Array.isArray(data.pendencias) && data.pendencias.length === 0) {
  issues.push("pendencias is empty; confirm this is real data, not legacy fixed []");
}

if (Array.isArray(data.recentReturns) && data.recentReturns.length === 0) {
  issues.push("recentReturns is empty; confirm this is real data, not legacy fixed []");
}

console.log(JSON.stringify({
  totalDesligamentos: data.totalDesligamentos,
  desligamentosMesAtual: data.desligamentosMesAtual,
  mensalDataCount: data.mensalData?.length || 0,
  equipamentosMensalCount: data.equipamentosMensal?.length || 0,
  equipamentosRankingCount: data.equipamentosRanking?.length || 0,
  pendenciasCount: data.pendencias?.length || 0,
  recentReturnsCount: data.recentReturns?.length || 0,
  firstMonth,
  firstEquipMonth,
  lastUpdate: data.lastUpdate,
  issues,
}, null, 2));

assert.equal(issues.length, 0, `Dashboard payload still has ${issues.length} issue(s)`);
