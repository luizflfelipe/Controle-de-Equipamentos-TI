/**
 * Google Apps Script
 * Melhorias feitas na última versão
 * 1. Pega colaboradores de TODAS as Filiais (Extrema, Belo Horizonte, etc.)
 * 2. Correção da Data: Só preenche a data de "Recebido" se a pessoa devolver o equipamento.
 * 3. Busca Global reforçada com nome normalizado.
 * 4. Alertas de E-mail com Destinatário e Cópia (CC)
 * 5. FILTRO EXCLUSIVO: Retorna e registra APENAS "Barra Funda".
 * 6. Aba por Data de Desligamento: usa a data de desligamento quando disponível.
 * 7. Correção lógica: se o colaborador já existe em mês anterior, atualiza a aba original.
 */

var CFG = {
  SPREADSHEET_ID: "1Ik_6Fr9okKUp2EiRAj0I1tE_m-u5wsGzodjAGg3GQa8",
  EMAIL_RESPONSAVEL: "maria.sousa@dafiti.com.br",
  EMAIL_COPIA: "erivaldo.siqueira@dafiti.com.br",
  REMETENTE_PLANILHA: "suporte.dafiti@dafiti.com.br",
  TIMEZONE: "GMT-3",
  MAX_THREADS: 50,
  ESTILO: {
    FONTE: "Montserrat",
    TAMANHO: 10,
    ALINHAMENTO: "center",
    COR_CABECALHO: "#f3f4f6"
  }
};

var MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

var EQUIP_VARIATIONS = (function () {
  var map = {
    "Notebook": ["notebook", "notbook", "notebock", "note", "laptop", "notes", "notebooks"],
    "Fonte": ["fonte", "font", "fontes", "carregador", "carreg"],
    "Mouse": ["mouse", "mouses", "mous"],
    "Monitor": ["monitor", "monitores", "tela", "monit"],
    "Celular": ["celular", "celulares", "iphone", "android", "cel"],
    "Teclado": ["teclado", "teclados", "tec"],
    "Macbook": ["macbook", "mac", "macbooks", "mac book"],
    "Headset": ["headset", "headsets", "fone", "fones", "headphone", "head"],
    "Adaptador": ["adaptador", "adaptadores", "adap"],
    "Mochila": ["mochila", "mochilas", "bag"]
  };

  var reverse = {};

  for (var std in map) {
    if (map.hasOwnProperty(std)) {
      var vars = map[std];

      for (var i = 0; i < vars.length; i++) {
        reverse[vars[i]] = std;
      }
    }
  }

  return reverse;
})();

var EQUIP_REGEX = /(\d+)\s*[xX]?\s*([^0-9,+]+?)(?=\s*\d|\s*[+,]|$)/g;

function isFilialPermitida(filial) {
  if (!filial) return false;

  var str = normalizarTexto(filial);

  return str.indexOf("barra funda") !== -1;
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
}

function nowDateStr() {
  return Utilities.formatDate(new Date(), CFG.TIMEZONE, "dd/MM/yyyy");
}

function normalizarTexto(valor) {
  if (valor === null || valor === undefined) return "";

  return valor
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isTextoVazio(valor) {
  return (
    valor === null ||
    valor === undefined ||
    valor.toString().trim() === ""
  );
}

function ensureRowLength(row, minLength) {
  var arr = row ? row.slice() : [];

  while (arr.length < minLength) {
    arr.push("");
  }

  return arr;
}

function simplificarChaveCabecalho(valor) {
  return normalizarTexto(valor)
    .replace(/[.\-_/()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildHeaderIndex(headerRow) {
  var idx = {};

  if (!headerRow) return idx;

  for (var i = 0; i < headerRow.length; i++) {
    var normal = normalizarTexto(headerRow[i]);
    var simples = simplificarChaveCabecalho(headerRow[i]);

    if (normal) idx[normal] = i;
    if (simples) idx[simples] = i;
  }

  return idx;
}

function getHeaderIndex(headerIndex, nomesPossiveis, fallback) {
  if (!headerIndex) return fallback;

  for (var i = 0; i < nomesPossiveis.length; i++) {
    var normal = normalizarTexto(nomesPossiveis[i]);
    var simples = simplificarChaveCabecalho(nomesPossiveis[i]);

    if (headerIndex.hasOwnProperty(normal)) {
      return headerIndex[normal];
    }

    if (headerIndex.hasOwnProperty(simples)) {
      return headerIndex[simples];
    }
  }

  return fallback;
}

function getCell(row, index) {
  if (!row || index === null || index === undefined || index < 0) return "";
  return row[index];
}

function ensureMonthSheet(ss, date) {
  var name = MONTHS[date.getMonth()] + date.getFullYear();
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 9).setValues([[
      "COLABORADOR", "CARGO", "DESLIGAMENTO", "RECEBIDO",
      "FILIAL", "E-MAIL", "Equip. Devolvido", "Controle Maju", "Equipamento(s) e Quantidade"
    ]]);

    aplicarEstiloMontserrat(sheet.getRange(1, 1, 1, 9), true);
  }

  return sheet;
}

function parseDateSafe(dateString) {
  if (dateString instanceof Date) {
    return isNaN(dateString.getTime()) ? null : dateString;
  }

  if (typeof dateString === "number" && !isNaN(dateString)) {
    if (dateString > 20000 && dateString < 80000) {
      return new Date(Math.round((dateString - 25569) * 86400 * 1000));
    }
  }

  if (!dateString || typeof dateString !== "string" || dateString.trim() === "") {
    return null;
  }

  var clean = dateString.trim();

  if (clean.indexOf("-") !== -1) {
    var partsIso = clean.split("T")[0].split("-");

    if (partsIso.length === 3) {
      var dateIso = new Date(
        parseInt(partsIso[0], 10),
        parseInt(partsIso[1], 10) - 1,
        parseInt(partsIso[2], 10)
      );

      if (!isNaN(dateIso.getTime())) return dateIso;
    }
  }

  if (clean.indexOf("/") !== -1) {
    var partsBr = clean.split(" ")[0].split("/");

    if (partsBr.length === 3) {
      var dateBr = new Date(
        parseInt(partsBr[2], 10),
        parseInt(partsBr[1], 10) - 1,
        parseInt(partsBr[0], 10)
      );

      if (!isNaN(dateBr.getTime())) return dateBr;
    }
  }

  var parsed = new Date(clean);

  if (!isNaN(parsed.getTime())) return parsed;

  return null;
}

function getTargetSheetByDesligamento(ss, desligamento) {
  var dataDesligamento = parseDateSafe(desligamento);

  if (dataDesligamento) {
    return ensureMonthSheet(ss, dataDesligamento);
  }

  console.warn(
    "Data de desligamento ausente ou inválida. Usando aba do mês atual como fallback. Valor recebido: " +
    desligamento
  );

  return ensureMonthSheet(ss, new Date());
}

function aplicarEstiloMontserrat(range, isHeader) {
  range
    .setFontFamily(CFG.ESTILO.FONTE)
    .setFontSize(CFG.ESTILO.TAMANHO)
    .setVerticalAlignment("middle")
    .setHorizontalAlignment(CFG.ESTILO.ALINHAMENTO);

  if (isHeader) {
    range
      .setFontWeight("bold")
      .setBackground(CFG.ESTILO.COR_CABECALHO);
  }
}

function detectarLinhaCabecalho(data) {
  if (!data || data.length === 0) {
    return { found: false, rowIndex: 0, headerIndex: {}, idxNome: -1 };
  }

  var limite = Math.min(data.length, 10);

  for (var r = 0; r < limite; r++) {
    var headerIndex = buildHeaderIndex(data[r]);
    var idxNome = getHeaderIndex(headerIndex, ["colaborador", "nome"], -1);

    if (idxNome !== -1) {
      return { found: true, rowIndex: r, headerIndex: headerIndex, idxNome: idxNome };
    }
  }

  var fallbackHeaderIndex = buildHeaderIndex(data[0]);

  return {
    found: false,
    rowIndex: 0,
    headerIndex: fallbackHeaderIndex,
    idxNome: getHeaderIndex(fallbackHeaderIndex, ["colaborador", "nome"], 0)
  };
}

function getSheetMonthYear(sheetName) {
  var normalized = normalizarTexto(sheetName);
  var monthIndex = -1;

  for (var i = 0; i < MONTHS.length; i++) {
    if (normalized.indexOf(normalizarTexto(MONTHS[i])) !== -1) {
      monthIndex = i;
      break;
    }
  }

  var yearMatch = normalized.match(/(19\d{2}|20\d{2})/);

  if (monthIndex === -1 || !yearMatch) {
    return null;
  }

  return { month: monthIndex, year: parseInt(yearMatch[1], 10) };
}

function sheetMatchesDesligamento(sheetName, desligamento) {
  var dataDesligamento = parseDateSafe(desligamento);
  if (!dataDesligamento) return false;

  var sheetInfo = getSheetMonthYear(sheetName);
  if (!sheetInfo) return false;

  return (
    sheetInfo.month === dataDesligamento.getMonth() &&
    sheetInfo.year === dataDesligamento.getFullYear()
  );
}

function calcularScoreMatchColaborador(match) {
  var score = 0;

  var idxDesligamento = getHeaderIndex(match.headerIndex, ["desligamento", "data desligamento"], 2);
  var idxEquipDev = getHeaderIndex(match.headerIndex, ["equip. devolvido", "equip devolvido"], 6);

  var desligamento = getCell(match.dadosExistentes, idxDesligamento);
  var dataDesligamento = parseDateSafe(desligamento);

  if (dataDesligamento) score += 50;
  if (sheetMatchesDesligamento(match.aba.getName(), desligamento)) score += 50;

  var statusDev = normalizarTexto(getCell(match.dadosExistentes, idxEquipDev));
  if (statusDev !== "devolvido") score += 10;

  return score;
}

function buscarColaboradorGlobal(ss, nome) {
  if (!nome) return null;

  var sheets = ss.getSheets();
  var search = normalizarTexto(nome);
  var matches = [];

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    if (sheet.getLastRow() < 2) continue;

    var data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) continue;

    var headerInfo = detectarLinhaCabecalho(data);
    var sheetMonthInfo = getSheetMonthYear(sheet.getName());

    if (!headerInfo.found && !sheetMonthInfo) continue;

    var idxNome = headerInfo.idxNome;
    if (idxNome === -1) continue;

    for (var i = headerInfo.rowIndex + 1; i < data.length; i++) {
      var nomePlanilha = normalizarTexto(data[i][idxNome]);
      if (!nomePlanilha) continue;

      if (nomePlanilha === search) {
        matches.push({
          aba: sheet,
          linha: i + 1,
          dadosExistentes: data[i],
          headers: data[headerInfo.rowIndex].map(function (h) { return normalizarTexto(h); }),
          headerIndex: headerInfo.headerIndex,
          headerRowIndex: headerInfo.rowIndex + 1
        });
      }
    }
  }

  if (matches.length === 0) return null;

  matches.forEach(function (match) {
    match.score = calcularScoreMatchColaborador(match);
  });

  matches.sort(function (a, b) {
    return b.score - a.score;
  });

  return matches[0];
}

function doGet(e) {
  try {
    var ss = getSpreadsheet();
    var sheets = ss.getSheets();

    var totalDes = 0;
    var mesAtDes = 0;
    var resMensal = {};
    var equipRank = {};
    var pends = [];
    var recentReturns = [];

    var now = new Date();
    var curYr = now.getFullYear();

    sheets.forEach(function (sheet) {
      if (sheet.getLastRow() < 2) return;

      var sheetName = sheet.getName();
      var fMonth = -1;
      var sYear = curYr.toString();

      var yMatch = sheetName.match(/\d{4}/);
      if (yMatch) sYear = yMatch[0];

      for (var i = 0; i < MONTHS.length; i++) {
        if (normalizarTexto(sheetName).indexOf(normalizarTexto(MONTHS[i])) !== -1) {
          fMonth = i;
          break;
        }
      }

      if (fMonth === -1) return;

      var data = sheet.getDataRange().getValues();
      var hd = data[0].map(function (h) { return h.toString().toLowerCase().trim(); });
      var idx = {};
      hd.forEach(function (h, i) { idx[h] = i; });

      var key = MONTHS[fMonth] + "|" + sYear;
      if (!resMensal[key]) {
        resMensal[key] = { count: 0, equip: 0 };
      }

      for (var row = 1; row < data.length; row++) {
        var nome = data[row][idx["colaborador"]];
        if (!nome || nome.toString().trim() === "") continue;

        var filialObj = data[row][idx["filial"]];
        if (!isFilialPermitida(filialObj)) continue;

        resMensal[key].count++;
        totalDes++;

        if (fMonth === now.getMonth() && sYear == curYr) {
          mesAtDes++;
        }

        var dev = idx["equip. devolvido"] !== undefined
          ? data[row][idx["equip. devolvido"]].toString().trim().toLowerCase()
          : "";

        var equipStr = idx["equipamento(s) e quantidade"] !== undefined
          ? data[row][idx["equipamento(s) e quantidade"]]
          : "";

        if (dev !== "devolvido") {
          var rawDate = data[row][idx["desligamento"]];
          var diffDays = rawDate instanceof Date
            ? Math.ceil(Math.abs(now - rawDate) / (1000 * 60 * 60 * 24))
            : 0;

          pends.push({
            name: nome.toString(),
            date: rawDate instanceof Date
              ? Utilities.formatDate(rawDate, "GMT-3", "dd/MM/yyyy")
              : "N/A",
            filial: filialObj || "N/A",
            priority: diffDays > 7 ? "ALTA" : "NORMAL"
          });
        } else {
          var idxRecebido = idx["recebido"] !== undefined ? idx["recebido"] :
            idx["recebimento"] !== undefined ? idx["recebimento"] :
            idx["data recebido"] !== undefined ? idx["data recebido"] :
            idx["data"] !== undefined ? idx["data"] : undefined;

          var recDateStr = idxRecebido !== undefined ? data[row][idxRecebido] : undefined;
          if (!recDateStr) recDateStr = data[row][idx["desligamento"]];

          var recDate = null;
          if (recDateStr instanceof Date) {
            recDate = recDateStr;
          } else if (typeof recDateStr === "string" && recDateStr.trim() !== "") {
            var dateOnly = recDateStr.split(" ")[0];
            var parts = dateOnly.split("/");
            if (parts.length === 3) {
              recDate = new Date(parts[2], parts[1] - 1, parts[0]);
            } else {
              recDate = new Date(recDateStr);
            }
          }

          if (recDate && !isNaN(recDate.getTime())) {
            var diffDaysRec = Math.ceil(
              Math.abs(now.getTime() - recDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (diffDaysRec <= 31) {
              recentReturns.push({
                name: nome.toString(),
                date: recDate instanceof Date
                  ? Utilities.formatDate(recDate, "GMT-3", "dd/MM/yyyy")
                  : typeof recDateStr === "string" ? recDateStr : "N/A",
                equipments: equipStr.toString() || "Não especificado",
                timestamp: recDate.getTime()
              });
            }
          }
        }

        if (equipStr) {
          var items = parseEquipments(equipStr);
          items.forEach(function (it) {
            resMensal[key].equip += it.qty;
            equipRank[it.name] = (equipRank[it.name] || 0) + it.qty;
          });
        }
      }
    });

    recentReturns.sort(function (a, b) {
      return b.timestamp - a.timestamp;
    });

    var sortedKeys = Object.keys(resMensal).sort(function (a, b) {
      var pA = a.split("|");
      var pB = b.split("|");
      if (pA[1] !== pB[1]) return pA[1] - pB[1];
      return MONTHS.indexOf(pA[0]) - MONTHS.indexOf(pB[0]);
    });

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: {
        totalDesligamentos: totalDes,
        desligamentosMesAtual: mesAtDes,
        mensalData: sortedKeys.map(function (k) {
          return { month: k.replace("|", " "), count: resMensal[k].count };
        }),
        equipamentosMensal: sortedKeys.map(function (k) {
          return { month: k.replace("|", " "), count: resMensal[k].equip };
        }),
        equipamentosRanking: Object.keys(equipRank).map(function (k) {
          return { name: k, count: equipRank[k] };
        }).sort(function (a, b) {
          return b.count - a.count;
        }).slice(0, 10),
        pendencias: pends.reverse().slice(0, 15),
        recentReturns: recentReturns.slice(0, 50),
        lastUpdate: new Date().toLocaleTimeString("pt-BR")
      }
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.message,
      stack: err.stack
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Nenhum dado foi recebido no POST.");
    }

    var contents = parsePostBody_(e);
    if (!contents || typeof contents !== "object" || Array.isArray(contents)) {
      throw new Error("O conteúdo recebido não possui um objeto JSON válido.");
    }

    contents.equipDevolvido = contents.equipDevolvido || "Devolvido";
    contents.controleMaju = contents.controleMaju || "Entregue";
    contents.origem = contents.origem || "Portal Web";

    var registroSalvo = registrarNaPlanilha(contents);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      colaborador: contents.colaborador || null,
      registroSalvo: registroSalvo || null
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function parsePostBody_(e) {
  if (e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }

  var contents = e.postData.contents;
  var trimmed = contents.toString().trim();

  if (trimmed.charAt(0) === "{" || trimmed.charAt(0) === "[") {
    return JSON.parse(trimmed);
  }

  var params = {};
  trimmed.split("&").forEach(function (part) {
    if (!part) return;

    var pair = part.split("=");
    var key = decodeURIComponent((pair[0] || "").replace(/\+/g, " "));
    var value = decodeURIComponent((pair.slice(1).join("=") || "").replace(/\+/g, " "));

    if (key) params[key] = value;
  });

  if (params.payload) {
    return JSON.parse(params.payload);
  }

  return params;
}

function registrarNaPlanilha(contents) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var ss = getSpreadsheet();
    var novoStatusDev = contents.equipDevolvido || "Pendente";
    var novoStatusMaju = contents.controleMaju || "Não Entregue";
    var obs = contents.equipamentoQuantidade || contents.equipamentos || contents.origem || "Portal Web";
    var origemNormalizada = normalizarTexto(contents.origem);
    var veioDoPortal = origemNormalizada.indexOf("portal web") !== -1;
    var isFromEmail = origemNormalizada.indexOf("email automato") !== -1 || origemNormalizada.indexOf("importado") !== -1;

    var encontrada = buscarColaboradorGlobal(ss, contents.colaborador);

    if (encontrada) {
      var sheet = encontrada.aba;
      var existing = ensureRowLength(encontrada.dadosExistentes, 9).slice(0, 9);
      var headerIndex = encontrada.headerIndex || buildHeaderIndex(encontrada.headers);

      function getIdx(nomesPossiveis, fallback) {
        return getHeaderIndex(headerIndex, nomesPossiveis, fallback);
      }

      var idxColaborador = getIdx(["colaborador", "nome"], 0);
      var idxCargo = getIdx(["cargo"], 1);
      var idxDesligamento = getIdx(["desligamento", "data desligamento"], 2);
      var idxRecebido = getIdx(["recebido", "recebimento", "data recebido"], 3);
      var idxFilial = getIdx(["filial"], 4);
      var idxEmail = getIdx(["e-mail", "email"], 5);
      var idxEquipDev = getIdx(["equip. devolvido", "equip devolvido"], 6);
      var idxMaju = getIdx(["controle maju"], 7);
      var idxEquips = getIdx(["equipamento(s) e quantidade", "equipamentos e quantidade"], 8);

      existing[idxColaborador] = contents.colaborador || existing[idxColaborador];
      if (contents.cargo) existing[idxCargo] = contents.cargo;
      if (isTextoVazio(existing[idxDesligamento])) existing[idxDesligamento] = contents.desligamento || "";
      if (contents.filial) existing[idxFilial] = contents.filial;
      if (isFromEmail || isTextoVazio(existing[idxEmail])) {
        existing[idxEmail] = contents.email || existing[idxEmail];
      }

      if (normalizarTexto(novoStatusDev) === "devolvido" || normalizarTexto(novoStatusDev) === "desligamento") {
        if (veioDoPortal && isTextoVazio(existing[idxRecebido])) {
          existing[idxRecebido] = nowDateStr();
        }
        existing[idxEquipDev] = novoStatusDev;
        existing[idxMaju] = "Entregue";
        existing[idxEquips] = obs;
      }

      var range = sheet.getRange(encontrada.linha, 1, 1, 9);
      range.setValues([existing]);
      aplicarEstiloMontserrat(range, false);
    } else {
      var dataDesligamento = parseDateSafe(contents.desligamento);
      var sheetAtual = dataDesligamento
        ? getTargetSheetByDesligamento(ss, contents.desligamento)
        : ensureMonthSheet(ss, new Date());

      var rowData = [[
        contents.colaborador || "",
        contents.cargo || "",
        contents.desligamento || "",
        veioDoPortal && normalizarTexto(novoStatusDev) === "devolvido" ? nowDateStr() : "",
        contents.filial || "",
        contents.email || "",
        novoStatusDev,
        novoStatusMaju,
        obs
      ]];

      var nextRow = sheetAtual.getLastRow() + 1;
      sheetAtual.getRange(nextRow, 1, 1, 9).setValues(rowData);
      aplicarEstiloMontserrat(sheetAtual.getRange(nextRow, 1, 1, 9), false);
    }
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function processarEmailsRecebidos() {
  var query = "from:" + CFG.REMETENTE_PLANILHA + " has:attachment is:unread filename:(xlsx OR xls OR csv)";
  var threads = GmailApp.search(query, 0, CFG.MAX_THREADS);

  if (!threads || threads.length === 0) return;

  for (var i = 0; i < threads.length; i++) {
    try {
      var msgs = threads[i].getMessages();
      if (!msgs || msgs.length === 0) continue;

      var lastMessage = msgs[msgs.length - 1];
      var attachments = lastMessage.getAttachments({ includeInlineImages: false });
      if (!attachments || attachments.length === 0) continue;

      for (var k = 0; k < attachments.length; k++) {
        var attachment = attachments[k];
        var fileName = attachment.getName() || "Arquivo_Sem_Nome";
        if (!/\.(xlsx|xls|csv)$/i.test(fileName)) continue;

        var rawData = extrairDadosDoAnexoV3(attachment);
        if (rawData && rawData.length > 0) {
          var headerRowIdx = -1;

          for (var r = 0; r < Math.min(rawData.length, 15); r++) {
            var rowStr = rawData[r].join("|").toLowerCase();
            if (rowStr.indexOf("nome") !== -1 && rowStr.indexOf("cargo") !== -1) {
              headerRowIdx = r;
              break;
            }
          }

          if (headerRowIdx === -1) continue;

          var headers = rawData[headerRowIdx].map(function (h) {
            return h ? h.toString().toLowerCase().trim() : "";
          });

          var iNome = headers.indexOf("nome");
          var iEmail = headers.indexOf("e-mail") !== -1 ? headers.indexOf("e-mail") : headers.indexOf("email");
          var iCargo = headers.indexOf("cargo");
          var iDeslig = headers.indexOf("desligamento");
          var iFilial = headers.indexOf("filial");

          if (iNome === -1) continue;

          var rows = rawData.slice(headerRowIdx + 1);
          rows.forEach(function (row) {
            var nomeColab = row[iNome];
            if (nomeColab && nomeColab.toString().trim() !== "" && nomeColab.toString().toLowerCase().indexOf("nome") === -1) {
              var filialLida = iFilial !== -1 && row[iFilial] ? row[iFilial].toString().trim() : "";
              if (isFilialPermitida(filialLida)) {
                var payload = {
                  colaborador: nomeColab.toString().trim(),
                  email: iEmail !== -1 && row[iEmail] ? row[iEmail].toString().trim() : "",
                  cargo: iCargo !== -1 && row[iCargo] ? row[iCargo].toString().trim() : "",
                  desligamento: iDeslig !== -1 && row[iDeslig] ? row[iDeslig] : "",
                  filial: filialLida,
                  origem: "Email Autômato (" + fileName + ")"
                };

                registrarNaPlanilha(payload);
              }
            }
          });
        }
      }

      threads[i].markRead();
    } catch (e) {
      console.error("Falha no bloco: " + e.message);
    }
  }
}

function extrairDadosDoAnexoV3(anexo) {
  var rawBlob = anexo.copyBlob();
  var bytes = rawBlob.getBytes();
  var name = anexo.getName();
  var contentType = "application/octet-stream";

  if (name.toLowerCase().endsWith(".xlsx")) {
    contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else if (name.toLowerCase().endsWith(".xls")) {
    contentType = "application/vnd.ms-excel";
  } else if (name.toLowerCase().endsWith(".csv")) {
    contentType = "text/csv";
  }

  var cleanBlob = Utilities.newBlob(bytes, contentType, "SCAN_" + name);
  var resource = {
    name: "TEMP_" + Utilities.getUuid(),
    mimeType: "application/vnd.google-apps.spreadsheet"
  };

  var file = Drive.Files.create(resource, cleanBlob);
  var spreadsheet = SpreadsheetApp.openById(file.id);
  var data = spreadsheet.getSheets()[0].getDataRange().getValues();

  Drive.Files.remove(file.id);
  return data;
}

function enviarAlertasPrioridadeAlta() {
  var ss = getSpreadsheet();
  var sheets = ss.getSheets();
  var now = new Date();
  var pendenciasAltas = [];

  sheets.forEach(function (sheet) {
    if (sheet.getLastRow() < 2) return;

    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function (h) {
      return h.toString().toLowerCase().trim();
    });

    var idx = {};
    headers.forEach(function (h, i) { idx[h] = i; });

    for (var row = 1; row < data.length; row++) {
      var nome = data[row][idx["colaborador"]];
      if (!nome) continue;

      var filialObj = data[row][idx["filial"]];
      if (!isFilialPermitida(filialObj)) continue;

      var devStatus = (data[row][idx["equip. devolvido"]] || "").toString().trim().toLowerCase();
      if (devStatus !== "devolvido") {
        var regDate = data[row][idx["desligamento"]];
        if (regDate instanceof Date) {
          var diffDays = Math.ceil(Math.abs(now - regDate) / (1000 * 60 * 60 * 24));
          if (diffDays > 7) {
            pendenciasAltas.push({
              nome: nome,
              dias: diffDays,
              data: Utilities.formatDate(regDate, CFG.TIMEZONE, "dd/MM/yyyy"),
              filial: filialObj || "N/A"
            });
          }
        }
      }
    }
  });

  return pendenciasAltas;
}

function normalizeEquipmentName(name) {
  if (!name) return "";

  var clean = name.toString().replace(/[\(\)]/g, "").trim();
  var key = clean.toLowerCase();

  if (EQUIP_VARIATIONS[key]) return EQUIP_VARIATIONS[key];
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

function parseEquipments(equipStr) {
  var res = [];
  if (!equipStr) return res;

  var str = equipStr.toString();
  EQUIP_REGEX.lastIndex = 0;

  var match;
  var found = false;

  while ((match = EQUIP_REGEX.exec(str)) !== null) {
    var norm = normalizeEquipmentName(match[2]);
    if (norm) {
      res.push({ qty: parseInt(match[1], 10), name: norm });
      found = true;
    }
  }

  if (!found) {
    var pts = str.split(/,|\+/);
    for (var i = 0; i < pts.length; i++) {
      var n = normalizeEquipmentName(pts[i]);
      if (n) res.push({ qty: 1, name: n });
    }
  }

  return res;
}
