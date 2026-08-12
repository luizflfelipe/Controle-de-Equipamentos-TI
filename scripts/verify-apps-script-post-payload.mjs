import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const server = readFileSync("server.ts", "utf8");
const appsScript = readFileSync("apps-script/Code.gs", "utf8");

for (const token of [
  "function createAppsScriptPostOptions(payload: unknown): RequestInit",
  "const body = new URLSearchParams()",
  "body.set(\"payload\", JSON.stringify(payload))",
  "\"Content-Type\": \"application/x-www-form-urlencoded;charset=UTF-8\"",
  "...createAppsScriptPostOptions(payload)",
  "...createAppsScriptPostOptions({ action: \"updateMotoboyRequest\", id, data })",
  "...createAppsScriptPostOptions({",
]) {
  assert.ok(server.includes(token), `missing server token: ${token}`);
}

for (const token of [
  "if (e.parameter && e.parameter.payload)",
  "return JSON.parse(e.parameter.payload)",
  "parseFormBody_(contents)",
  "function parseFormBody_(contents)",
  "if (params.payload) return JSON.parse(params.payload)",
  "if (params.action)",
]) {
  assert.ok(appsScript.includes(token), `missing Apps Script token: ${token}`);
}

console.log("apps script post payload contract verified");
