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
  const sheet = getSheet_(DESLIGAMENTOS_SPREADSHEET_ID, DESLIGAMENTOS_SHEET_NAME, DESLIGAMENTOS_HEADERS);
  const headers = ensureHeaders_(sheet, DESLIGAMENTOS_HEADERS);
  const values = sheet.getDataRange().getValues();
  const rows = values.length > 1 ? values.slice(1) : [];
  const colaboradorIndex = findHeaderIndex_(headers, ["Colaborador"]);
  const dateIndex = findHeaderIndex_(headers, ["Data Registro", "Data"]);
  const equipamentoIndex = findHeaderIndex_(headers, ["Equipamento/Quantidade", "Equipamento"]);
  const now = new Date();
  const monthKey = Utilities.formatDate(now, Session.getScriptTimeZone(), "MM/yyyy");
  const mensalMap = {};
  const equipamentosMap = {};

  rows.forEach(function (row) {
    if (colaboradorIndex >= 0 && !row[colaboradorIndex]) return;

    const date = dateIndex >= 0 ? parseDate_(row[dateIndex]) : null;
    const key = date ? Utilities.formatDate(date, Session.getScriptTimeZone(), "MM/yyyy") : "Sem data";
    mensalMap[key] = (mensalMap[key] || 0) + 1;

    if (equipamentoIndex >= 0 && row[equipamentoIndex]) {
      String(row[equipamentoIndex]).split(",").forEach(function (item) {
        const name = item.replace(/^\s*\d+x\s*/i, "").trim();
        if (name) equipamentosMap[name] = (equipamentosMap[name] || 0) + 1;
      });
    }
  });

  const mensalData = Object.keys(mensalMap).sort().map(function (month) {
    return { month: month, count: mensalMap[month] };
  });

  const equipamentosRanking = Object.keys(equipamentosMap)
    .map(function (name) { return { name: name, count: equipamentosMap[name] }; })
    .sort(function (a, b) { return b.count - a.count; });

  return {
    totalDesligamentos: rows.length,
    desligamentosMesAtual: mensalMap[monthKey] || 0,
    mensalData: mensalData,
    equipamentosMensal: mensalData,
    equipamentosRanking: equipamentosRanking,
    pendencias: [],
    recentReturns: [],
    lastUpdate: Utilities.formatDate(now, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss")
  };
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
