/**
 * Google Apps Script - Controle de Motoboy
 *
 * Uso:
 * 1. Cole este arquivo no Apps Script vinculado à planilha de Motoboy.
 * 2. Se o script NÃO estiver vinculado à planilha, configure a propriedade:
 *    MOTOBOY_SPREADSHEET_ID=<id-da-planilha-de-motoboy>
 * 3. Implante como Web App e use a URL em MOTOBOY_GOOGLE_SCRIPT_URL.
 */

var MOTOBOY_CFG = {
  SPREADSHEET_ID_PROPERTY: "MOTOBOY_SPREADSHEET_ID",
  SHEET_NAME_PROPERTY: "MOTOBOY_SHEET_NAME",
  DEFAULT_SHEET_NAME: "Motoboy",
  TIMEZONE: "America/Sao_Paulo"
};

var MOTOBOY_HEADERS = [
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
  "Prioridade",
  "Se possui Retorno",
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

var MOTOBOY_FIELD_TO_HEADER = {
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

var MOTOBOY_COLUMN_MAP = {
  id: 1,
  nomeSolicitante: 2,
  dataSolicitacao: 3,
  equipamento: 4,
  funcionario: 5,
  email: 6,
  centroCusto: 7,
  telefone: 8,
  endereco: 9,
  tipoServico: 10,
  prioridade: 11,
  possuiRetorno: 12,
  maquinaRetirada: 13,
  enviado: 14,
  recebido: 15,
  dataEnvioRecebimento: 16,
  codigoRastreio: 17,
  observacoes: 18,
  status: 19,
  justificativaExclusao: 20,
  excluidoPor: 21,
  excluidoEm: 22,
  criadoEm: 23,
  atualizadoEm: 24
};

var MOTOBOY_HEADER_TO_FIELD = (function () {
  var reverse = {};

  Object.keys(MOTOBOY_FIELD_TO_HEADER).forEach(function (field) {
    reverse[MOTOBOY_FIELD_TO_HEADER[field]] = field;
  });

  return reverse;
})();

function doGet(e) {
  try {
    var action = getParam_(e, "action");

    if (!action || action === "ping") {
      return json_({
        success: true,
        message: "Apps Script Motoboy online"
      });
    }

    if (action === "listMotoboyRequests") {
      return json_({
        success: true,
        data: listMotoboyRequests_(getParam_(e, "role"))
      });
    }

    if (action === "setupMotoboySheet") {
      return json_({
        success: true,
        data: setupMotoboySheet_()
      });
    }

    throw new Error("Ação GET inválida para Motoboy: " + action);
  } catch (error) {
    return json_({
      success: false,
      error: error.message
    });
  }
}

function doPost(e) {
  try {
    var payload = parsePostBody_(e);

    if (payload.action === "createMotoboyRequest") {
      return json_({
        success: true,
        data: createMotoboyRequest_(payload.data || {})
      });
    }

    if (payload.action === "updateMotoboyRequest") {
      return json_({
        success: true,
        data: updateMotoboyRequest_(payload.id, payload.data || {})
      });
    }

    if (payload.action === "deleteMotoboyRequest") {
      return json_({
        success: true,
        data: deleteMotoboyRequest_(payload.id, payload.data || {})
      });
    }

    throw new Error("Ação POST inválida para Motoboy: " + (payload.action || "não informada"));
  } catch (error) {
    return json_({
      success: false,
      error: error.message
    });
  }
}

function createMotoboyRequest_(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var sheet = getMotoboySheet_();
    var headers = ensureHeaders_(sheet, MOTOBOY_HEADERS);
    var now = new Date();
    var rowObject = {};

    Object.keys(MOTOBOY_FIELD_TO_HEADER).forEach(function (field) {
      rowObject[field] = data[field] || "";
    });

    rowObject.status = data.status || "Pendente";
    rowObject.criadoEm = now;
    rowObject.atualizadoEm = now;

    if (!rowObject.id) {
      throw new Error("ID técnico da solicitação Motoboy é obrigatório.");
    }

    appendObjectRow_(sheet, headers, rowObject);
    hideColumnIfExists_(sheet, headers, "ID");

    return objectFromRowObject_(rowObject);
  } finally {
    releaseLock_(lock);
  }
}

function listMotoboyRequests_(role) {
  var sheet = getMotoboySheet_();
  var headers = ensureHeaders_(sheet, MOTOBOY_HEADERS);
  var values = sheet.getDataRange().getValues();

  if (values.length <= 1) return [];

  return values
    .slice(1)
    .filter(function (row) {
      return row.some(function (cell) {
        return cell !== "";
      });
    })
    .map(function (row) {
      var rowObject = valuesToRowObject_(row);

      return objectFromRowObject_(rowObject);
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

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var sheet = getMotoboySheet_();
    var headers = ensureHeaders_(sheet, MOTOBOY_HEADERS);
    var targetRow = findMotoboyRowById_(sheet, headers, id);
    var rowObject = getRowObject_(sheet, headers, targetRow);

    Object.keys(data).forEach(function (field) {
      if (MOTOBOY_FIELD_TO_HEADER[field] && MOTOBOY_COLUMN_MAP[field]) {
        rowObject[field] = data[field];
        setMappedField_(sheet, targetRow, field, data[field]);
      }
    });

    rowObject.atualizadoEm = new Date();
    setMappedField_(sheet, targetRow, "atualizadoEm", new Date());

    if (isSim_(data.recebido) || data.recebido === true) {
      rowObject.status = "Concluído";
      setMappedField_(sheet, targetRow, "status", "Concluído");
    } else if (isSim_(data.enviado) && isNao_(data.recebido)) {
      rowObject.status = "Pendente de recebimento";
      setMappedField_(sheet, targetRow, "status", "Pendente de recebimento");
    } else if (isSim_(data.enviado) || data.maquinaRetirada || data.codigoRastreio) {
      rowObject.status = "Em andamento";
      setMappedField_(sheet, targetRow, "status", "Em andamento");
    }

    return objectFromRowObject_(rowObject);
  } finally {
    releaseLock_(lock);
  }
}

function deleteMotoboyRequest_(id, data) {
  if (!id) throw new Error("ID da solicitação Motoboy é obrigatório.");
  if (!data.justificativa) throw new Error("Justificativa da exclusão é obrigatória.");

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var sheet = getMotoboySheet_();
    var headers = ensureHeaders_(sheet, MOTOBOY_HEADERS);
    var targetRow = findMotoboyRowById_(sheet, headers, id);
    var rowObject = getRowObject_(sheet, headers, targetRow);
    var now = new Date();

    rowObject.status = "Excluído";
    rowObject.justificativaExclusao = data.justificativa;
    rowObject.excluidoPor = data.excluidoPor || "";
    rowObject.excluidoEm = now;
    rowObject.atualizadoEm = now;

    setMappedField_(sheet, targetRow, "status", "Excluído");
    setMappedField_(sheet, targetRow, "justificativaExclusao", data.justificativa);
    setMappedField_(sheet, targetRow, "excluidoPor", data.excluidoPor || "");
    setMappedField_(sheet, targetRow, "excluidoEm", now);
    setMappedField_(sheet, targetRow, "atualizadoEm", now);

    return objectFromRowObject_(rowObject);
  } finally {
    releaseLock_(lock);
  }
}

function getMotoboySheet_() {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = props.getProperty(MOTOBOY_CFG.SPREADSHEET_ID_PROPERTY);
  var sheetName = props.getProperty(MOTOBOY_CFG.SHEET_NAME_PROPERTY) || MOTOBOY_CFG.DEFAULT_SHEET_NAME;
  var spreadsheet = spreadsheetId
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error("Configure MOTOBOY_SPREADSHEET_ID ou vincule o script à planilha Motoboy.");
  }

  var sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, MOTOBOY_HEADERS.length).setValues([MOTOBOY_HEADERS]);
  }

  return sheet;
}

function ensureHeaders_(sheet, defaultHeaders) {
  var lastColumn = sheet.getLastColumn();
  var existingHeaders = sheet.getLastRow() >= 1
    ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (header) {
      return String(header || "").trim();
    })
    : [];

  if (!existingHeaders.some(Boolean)) {
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    return defaultHeaders.slice();
  }

  assertRequiredHeaders_(existingHeaders, defaultHeaders);

  return existingHeaders;
}

function setupMotoboySheet_() {
  var sheet = getMotoboySheet_();
  var maxColumns = sheet.getMaxColumns();

  if (maxColumns < MOTOBOY_HEADERS.length) {
    sheet.insertColumnsAfter(maxColumns, MOTOBOY_HEADERS.length - maxColumns);
  }

  sheet.getRange(1, 1, 1, MOTOBOY_HEADERS.length).setValues([MOTOBOY_HEADERS]);
  sheet.setFrozenRows(1);

  var refreshedMaxColumns = sheet.getMaxColumns();
  var extraColumns = refreshedMaxColumns - MOTOBOY_HEADERS.length;

  if (extraColumns > 0) {
    sheet.deleteColumns(MOTOBOY_HEADERS.length + 1, extraColumns);
  }

  return {
    sheet: sheet.getName(),
    columns: MOTOBOY_HEADERS.length
  };
}

function assertRequiredHeaders_(headers, requiredHeaders) {
  var missing = requiredHeaders.filter(function (header) {
    return headers.indexOf(header) === -1;
  });

  if (missing.length > 0) {
    throw new Error("Cabeçalho obrigatório ausente na planilha Motoboy: " + missing.join(", "));
  }
}

function findMotoboyRowById_(sheet, headers, id) {
  var idColumn = MOTOBOY_COLUMN_MAP.id;

  if (!idColumn) {
    throw new Error("Coluna ID não encontrada na planilha Motoboy.");
  }

  var lastRow = sheet.getLastRow();
  var idValues = lastRow > 1
    ? sheet.getRange(2, idColumn, lastRow - 1, 1).getValues()
    : [];

  for (var i = 0; i < idValues.length; i++) {
    if (String(idValues[i][0]) === String(id)) {
      return i + 2;
    }
  }

  throw new Error("Solicitação Motoboy não encontrada para o ID informado.");
}

function getRowObject_(sheet, headers, rowNumber) {
  var values = sheet.getRange(rowNumber, 1, 1, getMaxMappedColumn_()).getValues()[0];

  return valuesToRowObject_(values);
}

function setRowObject_(sheet, headers, rowNumber, rowObject) {
  var values = rowObjectToValues_(rowObject);

  sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
}

function setMappedField_(sheet, rowNumber, field, value) {
  var column = MOTOBOY_COLUMN_MAP[field];

  if (!column) {
    throw new Error("Campo Motoboy sem coluna mapeada: " + field);
  }

  sheet.getRange(rowNumber, column).setValue(value || "");
}

function appendObjectRow_(sheet, headers, rowObject) {
  var row = rowObjectToValues_(rowObject);

  sheet.appendRow(row);
}

function valuesToRowObject_(values) {
  var rowObject = {};

  Object.keys(MOTOBOY_COLUMN_MAP).forEach(function (field) {
    var column = MOTOBOY_COLUMN_MAP[field];
    rowObject[field] = values[column - 1] || "";
  });

  return rowObject;
}

function rowObjectToValues_(rowObject) {
  var values = [];
  var maxColumn = getMaxMappedColumn_();

  for (var i = 0; i < maxColumn; i++) {
    values.push("");
  }

  Object.keys(MOTOBOY_COLUMN_MAP).forEach(function (field) {
    var column = MOTOBOY_COLUMN_MAP[field];
    values[column - 1] = rowObject[field] || "";
  });

  return values;
}

function getMaxMappedColumn_() {
  var maxColumn = 0;

  Object.keys(MOTOBOY_COLUMN_MAP).forEach(function (field) {
    maxColumn = Math.max(maxColumn, MOTOBOY_COLUMN_MAP[field]);
  });

  return maxColumn;
}

function objectFromRowObject_(rowObject) {
  var result = {};

  Object.keys(MOTOBOY_FIELD_TO_HEADER).forEach(function (field) {
    result[field] = normalizeValue_(rowObject[field]);
  });

  return result;
}

function parsePostBody_(e) {
  if (!e) return {};

  if (e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }

  if (!e.postData || !e.postData.contents) {
    return {};
  }

  var contents = String(e.postData.contents).trim();

  if (!contents) return {};

  if (contents[0] === "{" || contents[0] === "[") {
    return JSON.parse(contents);
  }

  var params = parseFormBody_(contents);

  if (params.payload) {
    return JSON.parse(params.payload);
  }

  if (params.action) {
    var payload = {
      action: params.action
    };

    if (params.id) payload.id = params.id;
    if (params.data) payload.data = JSON.parse(params.data);

    return payload;
  }

  return {};
}

function parseFormBody_(contents) {
  var params = {};

  String(contents).split("&").forEach(function (part) {
    if (!part) return;

    var pair = part.split("=");
    var key = decodeURIComponent((pair[0] || "").replace(/\+/g, " "));
    var value = decodeURIComponent((pair.slice(1).join("=") || "").replace(/\+/g, " "));

    if (key) params[key] = value;
  });

  return params;
}

function hideColumnIfExists_(sheet, headers, header) {
  var column = headers.indexOf(header) + 1;

  if (column > 0) {
    sheet.hideColumns(column);
  }
}

function getParam_(e, name) {
  return e && e.parameter ? e.parameter[name] : "";
}

function normalizeValue_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, MOTOBOY_CFG.TIMEZONE, "yyyy-MM-dd");
  }

  return value === null || value === undefined ? "" : value;
}

function normalizarTexto_(value) {
  if (value === null || value === undefined) return "";

  return value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function isSim_(value) {
  return normalizarTexto_(value) === "SIM";
}

function isNao_(value) {
  return normalizarTexto_(value) === "NAO";
}

function releaseLock_(lock) {
  try {
    lock.releaseLock();
  } catch (error) {
    // Evita erro secundário caso o lock já tenha sido liberado.
  }
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
