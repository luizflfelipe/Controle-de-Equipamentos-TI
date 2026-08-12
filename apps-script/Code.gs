const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();

const DESLIGAMENTOS_SPREADSHEET_ID = "DESLIGAMENTOS_SPREADSHEET_ID";
const MOTOBOY_SPREADSHEET_ID = "MOTOBOY_SPREADSHEET_ID";

const DESLIGAMENTOS_SHEET_NAME = SCRIPT_PROPERTIES.getProperty("DESLIGAMENTOS_SHEET_NAME") || "Desligamentos";
const MOTOBOY_SHEET_NAME = SCRIPT_PROPERTIES.getProperty("MOTOBOY_SHEET_NAME") || "Motoboy";

const DESLIGAMENTOS_HEADERS = [
  "Data Registro",
  "Colaborador",
  "Desligamento",
  "Equipamento/Quantidade",
  "Equip Devolvido",
  "Controle Maju"
];

const MOTOBOY_HEADERS = [
  "ID",
  "Nome do Solicitante",
  "Data da Solicitação",
  "Equipamento",
  "Funcionário",
  "email",
  "Centro de Custo",
  "Telefone",
  "Endereço",
  "ENTREGA/Retirada",
  "Se possui Retorno",
  "Prioridade",
  "Maquina Retirada",
  "Enviado",
  "Recebido",
  "Data do Envio/ Recebimento",
  "Cod. Rastreio",
  "Observações",
  "Status",
  "Justificativa da Exclusão",
  "Excluído por",
  "Excluído em",
  "Criado em",
  "Atualizado em"
];

const MOTOBOY_FIELD_TO_HEADER = {
  id: "ID",
  nomeSolicitante: "Nome do Solicitante",
  dataSolicitacao: "Data da Solicitação",
  equipamento: "Equipamento",
  funcionario: "Funcionário",
  email: "email",
  centroCusto: "Centro de Custo",
  telefone: "Telefone",
  endereco: "Endereço",
  tipoServico: "ENTREGA/Retirada",
  possuiRetorno: "Se possui Retorno",
  prioridade: "Prioridade",
  maquinaRetirada: "Maquina Retirada",
  enviado: "Enviado",
  recebido: "Recebido",
  dataEnvioRecebimento: "Data do Envio/ Recebimento",
  codigoRastreio: "Cod. Rastreio",
  observacoes: "Observações",
  status: "Status",
  justificativaExclusao: "Justificativa da Exclusão",
  excluidoPor: "Excluído por",
  excluidoEm: "Excluído em"
};

const MOTOBOY_HEADER_TO_FIELD = Object.keys(MOTOBOY_FIELD_TO_HEADER).reduce(function (acc, key) {
  acc[MOTOBOY_FIELD_TO_HEADER[key]] = key;
  return acc;
}, {});

function doGet(e) {
  try {
    const action = getParam_(e, "action");

    if (!action || action === "ping") {
      return json_({ success: true, message: "Apps Script online" });
    }

    if (action === "getDashboardData") {
      return json_({ success: true, data: getDashboardData_() });
    }

    if (action === "fetchExternal") {
      return json_({ success: true, data: fetchExternal_(getParam_(e, "url")) });
    }

    if (action === "listMotoboyRequests") {
      return json_({ success: true, data: listMotoboyRequests_(getParam_(e, "role")) });
    }

    throw new Error("Ação GET inválida: " + action);
  } catch (error) {
    return json_({ success: false, error: error.message });
  }
}

function doPost(e) {
  try {
    const payload = parsePostBody_(e);

    if (payload.action === "createMotoboyRequest") {
      return json_({ success: true, data: createMotoboyRequest_(payload.data || {}) });
    }

    if (payload.action === "updateMotoboyRequest") {
      return json_({ success: true, data: updateMotoboyRequest_(payload.id, payload.data || {}) });
    }

    if (payload.action === "deleteMotoboyRequest") {
      return json_({ success: true, data: deleteMotoboyRequest_(payload.id, payload.data || {}) });
    }

    return json_({ success: true, action: "registerDesligamento", sheet: registerDesligamento_(payload) });
  } catch (error) {
    return json_({ success: false, error: error.message });
  }
}

function createMotoboyRequest_(data) {
  const sheet = getSheet_(MOTOBOY_SPREADSHEET_ID, MOTOBOY_SHEET_NAME, MOTOBOY_HEADERS);
  const headers = ensureHeaders_(sheet, MOTOBOY_HEADERS);
  const now = new Date();
  const rowObject = {};

  Object.keys(MOTOBOY_FIELD_TO_HEADER).forEach(function (field) {
    rowObject[MOTOBOY_FIELD_TO_HEADER[field]] = data[field] || "";
  });

  rowObject["Status"] = data.status || "Pendente";
  rowObject["Criado em"] = now;
  rowObject["Atualizado em"] = now;

  if (!rowObject["ID"]) {
    throw new Error("ID técnico da solicitação Motoboy é obrigatório.");
  }

  appendObjectRow_(sheet, headers, rowObject);
  hideColumnIfExists_(sheet, headers, "ID");

  return objectFromHeaders_(headers, rowObject, MOTOBOY_HEADER_TO_FIELD);
}

function listMotoboyRequests_(role) {
  const sheet = getSheet_(MOTOBOY_SPREADSHEET_ID, MOTOBOY_SHEET_NAME, MOTOBOY_HEADERS);
  const headers = ensureHeaders_(sheet, MOTOBOY_HEADERS);
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) return [];

  return values.slice(1)
    .filter(function (row) {
      return row.some(function (cell) { return cell !== ""; });
    })
    .map(function (row) {
      const rowObject = {};
      headers.forEach(function (header, index) {
        rowObject[header] = row[index];
      });
      return objectFromHeaders_(headers, rowObject, MOTOBOY_HEADER_TO_FIELD);
    })
    .filter(function (request) {
      if (!request.id) return false;
      if (request.status === "Excluído") return false;
      if (role === "recepcao") return request.status !== "Concluído";
      return true;
    });
}

function updateMotoboyRequest_(id, data) {
  if (!id) throw new Error("ID da solicitação Motoboy é obrigatório.");

  const sheet = getSheet_(MOTOBOY_SPREADSHEET_ID, MOTOBOY_SHEET_NAME, MOTOBOY_HEADERS);
  const headers = ensureHeaders_(sheet, MOTOBOY_HEADERS);
  const idColumn = headers.indexOf("ID") + 1;

  if (idColumn === 0) throw new Error("Coluna ID não encontrada na planilha Motoboy.");

  const lastRow = sheet.getLastRow();
  const idValues = lastRow > 1 ? sheet.getRange(2, idColumn, lastRow - 1, 1).getValues() : [];
  const matchIndex = idValues.findIndex(function (row) { return String(row[0]) === String(id); });

  if (matchIndex === -1) throw new Error("Solicitação Motoboy não encontrada para o ID informado.");

  const targetRow = matchIndex + 2;
  const currentValues = sheet.getRange(targetRow, 1, 1, headers.length).getValues()[0];
  const rowObject = {};

  headers.forEach(function (header, index) {
    rowObject[header] = currentValues[index];
  });

  Object.keys(data).forEach(function (field) {
    const header = MOTOBOY_FIELD_TO_HEADER[field];
    if (header && headers.indexOf(header) !== -1) {
      rowObject[header] = data[field];
    }
  });

  rowObject["Atualizado em"] = new Date();

  if (data.recebido === "Sim" || data.recebido === true) {
    rowObject["Status"] = "Concluído";
  } else if (data.enviado === "Sim" && data.recebido === "Não") {
    rowObject["Status"] = "Pendente de recebimento";
  } else if (data.enviado === "Sim" || data.maquinaRetirada || data.codigoRastreio) {
    rowObject["Status"] = "Em andamento";
  }

  const nextValues = headers.map(function (header) {
    return rowObject[header] || "";
  });

  sheet.getRange(targetRow, 1, 1, headers.length).setValues([nextValues]);

  return objectFromHeaders_(headers, rowObject, MOTOBOY_HEADER_TO_FIELD);
}

function deleteMotoboyRequest_(id, data) {
  if (!id) throw new Error("ID da solicitação Motoboy é obrigatório.");
  if (!data.justificativa) throw new Error("Justificativa da exclusão é obrigatória.");

  const sheet = getSheet_(MOTOBOY_SPREADSHEET_ID, MOTOBOY_SHEET_NAME, MOTOBOY_HEADERS);
  const headers = ensureHeaders_(sheet, MOTOBOY_HEADERS);
  const idColumn = headers.indexOf("ID") + 1;

  if (idColumn === 0) throw new Error("Coluna ID não encontrada na planilha Motoboy.");

  const lastRow = sheet.getLastRow();
  const idValues = lastRow > 1 ? sheet.getRange(2, idColumn, lastRow - 1, 1).getValues() : [];
  const matchIndex = idValues.findIndex(function (row) { return String(row[0]) === String(id); });

  if (matchIndex === -1) throw new Error("Solicitação Motoboy não encontrada para o ID informado.");

  const targetRow = matchIndex + 2;
  const currentValues = sheet.getRange(targetRow, 1, 1, headers.length).getValues()[0];
  const rowObject = {};
  const now = new Date();

  headers.forEach(function (header, index) {
    rowObject[header] = currentValues[index];
  });

  rowObject["Status"] = "Excluído";
  rowObject["Justificativa da Exclusão"] = data.justificativa;
  rowObject["Excluído por"] = data.excluidoPor || "";
  rowObject["Excluído em"] = now;
  rowObject["Atualizado em"] = now;

  const nextValues = headers.map(function (header) {
    return rowObject[header] || "";
  });

  sheet.getRange(targetRow, 1, 1, headers.length).setValues([nextValues]);

  return objectFromHeaders_(headers, rowObject, MOTOBOY_HEADER_TO_FIELD);
}

function registerDesligamento_(data) {
  const sheet = getSheet_(DESLIGAMENTOS_SPREADSHEET_ID, DESLIGAMENTOS_SHEET_NAME, DESLIGAMENTOS_HEADERS);
  const headers = ensureHeaders_(sheet, DESLIGAMENTOS_HEADERS);

  const rowObject = {
    "Data Registro": new Date(),
    "Colaborador": data.colaborador || "",
    "Desligamento": data.desligamento || "",
    "Equipamento/Quantidade": data.equipamentoQuantidade || "",
    "Equip Devolvido": data.equipDevolvido || "",
    "Controle Maju": data.controleMaju || ""
  };

  appendObjectRow_(sheet, headers, rowObject);
  return sheet.getName();
}

function getDashboardData_() {
  const spreadsheet = getDesligadosSpreadsheet_();
  const now = new Date();
  const currentMonthKey = buildMonthKey_(now);
  const mensalMap = {};
  const equipamentosMensalMap = {};
  const equipamentosRankingMap = {};
  const pendencias = [];
  const recentReturns = [];
  let totalDesligamentos = 0;
  let desligamentosMesAtual = 0;

  spreadsheet.getSheets().forEach(function (sheet) {
    if (!isDesligadosMonthSheet_(sheet) && sheet.getName() !== DESLIGAMENTOS_SHEET_NAME) return;
    if (sheet.getLastRow() < 2) return;

    const values = sheet.getDataRange().getValues();
    const headerInfo = detectDesligadosHeader_(values);
    if (!headerInfo.found) return;

    const headers = values[headerInfo.rowIndex];
    const headerIndex = buildNormalizedHeaderIndex_(headers);
    const colaboradorIndex = findNormalizedHeaderIndex_(headerIndex, ["COLABORADOR", "Colaborador", "Nome"]);
    const cargoIndex = findNormalizedHeaderIndex_(headerIndex, ["CARGO", "Cargo"]);
    const desligamentoIndex = findNormalizedHeaderIndex_(headerIndex, ["DESLIGAMENTO", "Data Desligamento", "Data de Desligamento"]);
    const recebidoIndex = findNormalizedHeaderIndex_(headerIndex, ["RECEBIDO", "Recebimento", "Data Recebido", "Data do Recebimento"]);
    const filialIndex = findNormalizedHeaderIndex_(headerIndex, ["FILIAL", "Filial"]);
    const emailIndex = findNormalizedHeaderIndex_(headerIndex, ["E-MAIL", "EMAIL", "E-mail"]);
    const equipDevolvidoIndex = findNormalizedHeaderIndex_(headerIndex, ["Equip. Devolvido", "Equip Devolvido"]);
    const equipamentosIndex = findNormalizedHeaderIndex_(headerIndex, [
      "Equipamento(s) e Quantidade",
      "Equipamentos e Quantidade",
      "Equipamento/Quantidade",
      "Equipamento"
    ]);

    if (colaboradorIndex < 0) return;

    values.slice(headerInfo.rowIndex + 1).forEach(function (row) {
      const colaborador = row[colaboradorIndex];
      if (!colaborador || String(colaborador).trim() === "") return;

      const filial = filialIndex >= 0 ? row[filialIndex] : "";
      if (!isFilialPermitida_(filial)) return;

      const desligamento = desligamentoIndex >= 0 ? row[desligamentoIndex] : "";
      const desligamentoDate = parseDate_(desligamento);
      const monthDate = desligamentoDate || getDateFromSheetName_(sheet.getName()) || now;
      const monthKey = buildMonthKey_(monthDate);

      mensalMap[monthKey] = (mensalMap[monthKey] || 0) + 1;
      totalDesligamentos += 1;

      if (monthKey === currentMonthKey) {
        desligamentosMesAtual += 1;
      }

      const equipamentoStr = equipamentosIndex >= 0 ? row[equipamentosIndex] : "";
      const equipamentos = parseEquipments_(equipamentoStr);

      equipamentos.forEach(function (equipamento) {
        equipamentosMensalMap[monthKey] = (equipamentosMensalMap[monthKey] || 0) + equipamento.qty;
        equipamentosRankingMap[equipamento.name] = (equipamentosRankingMap[equipamento.name] || 0) + equipamento.qty;
      });

      const statusDevolucao = equipDevolvidoIndex >= 0
        ? normalizeText_(row[equipDevolvidoIndex])
        : "";

      if (statusDevolucao !== "devolvido") {
        const diffDays = desligamentoDate
          ? Math.ceil(Math.abs(now.getTime() - desligamentoDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        pendencias.push({
          name: String(colaborador),
          date: desligamentoDate ? Utilities.formatDate(desligamentoDate, Session.getScriptTimeZone(), "dd/MM/yyyy") : "N/A",
          filial: filial || "N/A",
          priority: diffDays > 7 ? "ALTA" : "NORMAL"
        });
      } else {
        const recebido = recebidoIndex >= 0 ? row[recebidoIndex] : "";
        const recebidoDate = parseDate_(recebido) || desligamentoDate;

        if (recebidoDate && !isNaN(recebidoDate.getTime())) {
          const diffDaysRec = Math.ceil(Math.abs(now.getTime() - recebidoDate.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDaysRec <= 31) {
            recentReturns.push({
              name: String(colaborador),
              date: Utilities.formatDate(recebidoDate, Session.getScriptTimeZone(), "dd/MM/yyyy"),
              equipments: equipamentoStr ? String(equipamentoStr) : "Não especificado",
              timestamp: recebidoDate.getTime()
            });
          }
        }
      }
    });
  });

  recentReturns.sort(function (a, b) {
    return b.timestamp - a.timestamp;
  });

  const sortedMonthKeys = Object.keys(mensalMap).sort(compareMonthKeys_);
  const sortedEquipMonthKeys = Object.keys(equipamentosMensalMap).sort(compareMonthKeys_);

  const mensalData = sortedMonthKeys.map(function (month) {
    return { month: month, count: mensalMap[month] };
  });

  const equipamentosMensal = sortedEquipMonthKeys.map(function (month) {
    return { month: month, count: equipamentosMensalMap[month] };
  });

  const equipamentosRanking = Object.keys(equipamentosRankingMap)
    .map(function (name) { return { name: name, count: equipamentosRankingMap[name] }; })
    .sort(function (a, b) { return b.count - a.count; })
    .slice(0, 10);

  return {
    totalDesligamentos: totalDesligamentos,
    desligamentosMesAtual: desligamentosMesAtual,
    mensalData: mensalData,
    equipamentosMensal: equipamentosMensal,
    equipamentosRanking: equipamentosRanking,
    pendencias: pendencias.reverse().slice(0, 15),
    recentReturns: recentReturns.slice(0, 50),
    lastUpdate: Utilities.formatDate(now, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss")
  };
}

function getDesligadosSpreadsheet_() {
  const spreadsheetId = SCRIPT_PROPERTIES.getProperty(DESLIGAMENTOS_SPREADSHEET_ID);

  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error("Configure a propriedade " + DESLIGAMENTOS_SPREADSHEET_ID + " nas Propriedades do Script.");
  }

  return spreadsheet;
}

function detectDesligadosHeader_(values) {
  const limit = Math.min(values.length, 10);

  for (let i = 0; i < limit; i++) {
    const headerIndex = buildNormalizedHeaderIndex_(values[i]);
    const colaboradorIndex = findNormalizedHeaderIndex_(headerIndex, ["COLABORADOR", "Colaborador", "Nome"]);

    if (colaboradorIndex >= 0) {
      return { found: true, rowIndex: i };
    }
  }

  return { found: false, rowIndex: 0 };
}

function buildNormalizedHeaderIndex_(headers) {
  const index = {};

  headers.forEach(function (header, i) {
    const normal = normalizeHeader_(header);
    if (normal) index[normal] = i;
  });

  return index;
}

function findNormalizedHeaderIndex_(headerIndex, names) {
  for (let i = 0; i < names.length; i++) {
    const key = normalizeHeader_(names[i]);
    if (Object.prototype.hasOwnProperty.call(headerIndex, key)) {
      return headerIndex[key];
    }
  }

  return -1;
}

function normalizeHeader_(value) {
  return normalizeText_(value)
    .replace(/[.\-_/()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText_(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isFilialPermitida_(filial) {
  return normalizeText_(filial).indexOf("barra funda") !== -1;
}

function isDesligadosMonthSheet_(sheet) {
  return getDateFromSheetName_(sheet.getName()) !== null;
}

function getDateFromSheetName_(sheetName) {
  const normalized = normalizeText_(sheetName);
  const months = getMonthNames_();
  let monthIndex = -1;

  for (let i = 0; i < months.length; i++) {
    if (normalized.indexOf(normalizeText_(months[i])) !== -1) {
      monthIndex = i;
      break;
    }
  }

  const yearMatch = normalized.match(/(19\d{2}|20\d{2})/);
  if (monthIndex === -1 || !yearMatch) return null;

  return new Date(parseInt(yearMatch[1], 10), monthIndex, 1);
}

function buildMonthKey_(date) {
  return getMonthNames_()[date.getMonth()] + " " + date.getFullYear();
}

function compareMonthKeys_(a, b) {
  const dateA = getDateFromSheetName_(a) || parseMonthKey_(a);
  const dateB = getDateFromSheetName_(b) || parseMonthKey_(b);

  if (!dateA && !dateB) return a.localeCompare(b);
  if (!dateA) return 1;
  if (!dateB) return -1;

  return dateA.getTime() - dateB.getTime();
}

function parseMonthKey_(key) {
  const normalized = normalizeText_(key);
  const months = getMonthNames_();
  let monthIndex = -1;

  for (let i = 0; i < months.length; i++) {
    if (normalized.indexOf(normalizeText_(months[i])) !== -1) {
      monthIndex = i;
      break;
    }
  }

  const yearMatch = normalized.match(/(19\d{2}|20\d{2})/);
  if (monthIndex === -1 || !yearMatch) return null;

  return new Date(parseInt(yearMatch[1], 10), monthIndex, 1);
}

function getMonthNames_() {
  return [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
}

function parseEquipments_(equipStr) {
  const result = [];
  if (!equipStr) return result;

  const str = String(equipStr);
  const regex = /(\d+)\s*[xX]?\s*([^0-9,+]+?)(?=\s*\d|\s*[+,]|$)/g;
  let match;
  let found = false;

  while ((match = regex.exec(str)) !== null) {
    const name = normalizeEquipmentName_(match[2]);
    if (name) {
      result.push({ qty: parseInt(match[1], 10), name: name });
      found = true;
    }
  }

  if (!found) {
    str.split(/,|\+/).forEach(function (part) {
      const name = normalizeEquipmentName_(part);
      if (name) result.push({ qty: 1, name: name });
    });
  }

  return result;
}

function normalizeEquipmentName_(name) {
  if (!name) return "";

  const variations = {
    notebook: "Notebook",
    notbook: "Notebook",
    notebock: "Notebook",
    note: "Notebook",
    laptop: "Notebook",
    notes: "Notebook",
    notebooks: "Notebook",
    fonte: "Fonte",
    font: "Fonte",
    fontes: "Fonte",
    carregador: "Fonte",
    carreg: "Fonte",
    mouse: "Mouse",
    mouses: "Mouse",
    monitor: "Monitor",
    monitores: "Monitor",
    tela: "Monitor",
    celular: "Celular",
    celulares: "Celular",
    iphone: "Celular",
    android: "Celular",
    teclado: "Teclado",
    teclados: "Teclado",
    macbook: "Macbook",
    mac: "Macbook",
    "mac book": "Macbook",
    headset: "Headset",
    fone: "Headset",
    fones: "Headset",
    headphone: "Headset",
    adaptador: "Adaptador",
    adaptadores: "Adaptador",
    mochila: "Mochila",
    mochilas: "Mochila"
  };

  const clean = String(name).replace(/[\(\)]/g, "").trim();
  const key = normalizeText_(clean);

  if (variations[key]) return variations[key];

  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

function fetchExternal_(url) {
  if (!url) throw new Error("URL da planilha externa não fornecida.");

  const spreadsheet = SpreadsheetApp.openByUrl(url);
  const sheet = spreadsheet.getSheets()[0];
  const values = sheet.getDataRange().getValues();

  if (!values.length) return [];

  const headers = values[0].map(function (header) { return String(header); });
  return values.slice(1).map(function (row) {
    const item = {};
    headers.forEach(function (header, index) {
      item[header] = row[index];
    });
    return item;
  });
}

function getSheet_(spreadsheetPropertyName, sheetName, defaultHeaders) {
  const spreadsheetId = SCRIPT_PROPERTIES.getProperty(spreadsheetPropertyName);
  const spreadsheet = spreadsheetId
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error("Configure a propriedade " + spreadsheetPropertyName + " nas Propriedades do Script.");
  }

  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
  }

  return sheet;
}

function ensureHeaders_(sheet, defaultHeaders) {
  const lastColumn = Math.max(sheet.getLastColumn(), defaultHeaders.length);
  const existingHeaders = sheet.getLastRow() >= 1
    ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (header) { return String(header || "").trim(); })
    : [];

  if (!existingHeaders.some(Boolean)) {
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    return defaultHeaders.slice();
  }

  const headers = existingHeaders.slice();
  defaultHeaders.forEach(function (header) {
    if (headers.indexOf(header) === -1) {
      headers.push(header);
      sheet.getRange(1, headers.length).setValue(header);
    }
  });

  return headers;
}

function appendObjectRow_(sheet, headers, rowObject) {
  const row = headers.map(function (header) {
    return rowObject[header] || "";
  });
  sheet.appendRow(row);
}

function objectFromHeaders_(headers, rowObject, headerToField) {
  const result = {};
  headers.forEach(function (header) {
    const field = headerToField[header];
    if (field) result[field] = normalizeValue_(rowObject[header]);
  });
  return result;
}

function hideColumnIfExists_(sheet, headers, header) {
  const column = headers.indexOf(header) + 1;
  if (column > 0) sheet.hideColumns(column);
}

function findHeaderIndex_(headers, names) {
  for (let i = 0; i < names.length; i++) {
    const index = headers.indexOf(names[i]);
    if (index !== -1) return index;
  }
  return -1;
}

function parsePostBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  if (e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }

  const contents = e.postData.contents;
  const trimmed = String(contents).trim();
  if (!trimmed) return {};
  if (trimmed[0] === "{" || trimmed[0] === "[") {
    return JSON.parse(trimmed);
  }

  const params = parseFormBody_(contents);
  if (params.payload) return JSON.parse(params.payload);
  if (params.action) {
    const payload = { action: params.action };
    if (params.id) payload.id = params.id;
    if (params.data) payload.data = JSON.parse(params.data);
    return payload;
  }

  return {};
}

function parseFormBody_(contents) {
  const params = {};
  String(contents).split("&").forEach(function (part) {
    if (!part) return;
    const pair = part.split("=");
    const key = decodeURIComponent((pair[0] || "").replace(/\+/g, " "));
    const value = decodeURIComponent((pair.slice(1).join("=") || "").replace(/\+/g, " "));
    if (key) params[key] = value;
  });
  return params;
}

function getParam_(e, name) {
  return e && e.parameter ? e.parameter[name] : "";
}

function parseDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeValue_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return value == null ? "" : value;
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
