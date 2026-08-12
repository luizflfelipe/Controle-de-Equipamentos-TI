import express from "express";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import cookieSession from "cookie-session";
import rateLimit from "express-rate-limit";
import { z } from "zod";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Definição estrita do formato esperado para registrar desligamentos
const registerSchema = z.object({
  colaborador: z.string().min(1, "O nome do colaborador é obrigatório").max(200, "Nome muito longo"),
  desligamento: z.string().max(100).optional(),
  equipamentoQuantidade: z.string().max(1000).optional(),
  equipDevolvido: z.string().max(100).optional(),
  controleMaju: z.string().max(100).optional()
}).strip(); // O '.strip()' remove automaticamente quaisquer campos maliciosos/não-mapeados que venham na requisição

const motoboyCreateSchema = z.object({
  nomeSolicitante: z.string().min(1, "O nome do solicitante é obrigatório").max(200, "Nome do solicitante muito longo"),
  dataSolicitacao: z.string().min(1, "A data da solicitação é obrigatória").max(30, "Data da solicitação inválida"),
  equipamento: z.string().min(1, "O equipamento é obrigatório").max(200, "Equipamento muito longo"),
  funcionario: z.string().min(1, "O funcionário é obrigatório").max(200, "Funcionário muito longo"),
  email: z.string().email("E-mail inválido").max(200, "E-mail muito longo"),
  centroCusto: z.string().max(100, "Centro de custo muito longo").optional().default(""),
  telefone: z.string().min(1, "O telefone é obrigatório").max(50, "Telefone muito longo"),
  endereco: z.string().min(1, "O endereço é obrigatório").max(500, "Endereço muito longo"),
  tipoServico: z.enum(["ENTREGA", "Retirada"], { message: "Tipo de serviço inválido" }),
  possuiRetorno: z.enum(["Sim", "Não"], { message: "Informe se possui retorno" }),
  prioridade: z.enum(["Baixa", "Normal", "Alta", "Urgente"], { message: "Prioridade inválida" })
}).strip();

const motoboyUpdateSchema = z.object({
  maquinaRetirada: z.string().max(100).optional(),
  enviado: z.string().max(100).optional(),
  recebido: z.string().max(100).optional(),
  dataEnvioRecebimento: z.string().max(120, "Datas de envio/recebimento muito longas").optional(),
  codigoRastreio: z.string().max(120).optional(),
  observacoes: z.string().max(1000).optional()
}).strip();

const motoboyDeleteSchema = z.object({
  justificativa: z.string().trim().min(1, "Justificativa da exclusão é obrigatória").max(1000, "Justificativa da exclusão muito longa")
}).strip();

// --- ESTÁGIO 2: Resiliência e Performance ---

// 1. Variável Global de Cache para o Dashboard 
const dashboardCache = {
  data: null as any,
  lastFetch: 0
};
const CACHE_TTL = 2 * 60 * 1000; // 2 minutos em milissegundos
const SESSION_MAX_AGE_MS = 15 * 60 * 1000;
const AUTH_DEBUG = process.env.AUTH_DEBUG === "true";

type MotoboyRole = "suporte" | "recepcao" | "none";

function getMotoboyRole(userEmail: string): MotoboyRole {
  const normalizedEmail = userEmail.toLowerCase();
  if (normalizedEmail === "suporte.dafiti@dafiti.com.br") return "suporte";
  if (normalizedEmail === "recepcao@dafiti.com.br") return "recepcao";
  if (normalizedEmail === "maria.sousa@dafiti.com.br") return "recepcao";
  return "none";
}

function generateMotoboyId(date = new Date()) {
  const timestamp = date.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MOTO-${timestamp}-${random}`;
}

function filterValidMotoboyRequests(requests: any[]) {
  return requests.filter((request) => typeof request?.id === "string" && request.id.trim());
}

// 2. Fetch Helper com Auto-Retry (Exponential Backoff)
async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      // Se responder com erro do servidor Google (Rate Limit ou Erro Interno), consideramos falha para tentar dnv
      if (!response.ok && [429, 500, 502, 503, 504].includes(response.status)) {
        throw new Error(`Google API retornou Erro HTTP ${response.status}`);
      }
      
      return response;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error; // Última tentativa falhou, repassa o erro para a rota lidar
      }
      // Calcula o atraso: 500ms, 1000ms, 2000ms...
      const delay = 500 * Math.pow(2, i);
      console.warn(`[Retry] Falha na comunicação com o script. Tentativa ${i + 1}/${maxRetries} falhou. Tentando novamente em ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw new Error("Falha Crítica no Fetch");
}

function createAppsScriptPostOptions(payload: unknown): RequestInit {
  const body = new URLSearchParams();
  body.set("payload", JSON.stringify(payload));

  return {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body,
  };
}

function getMotoboyScriptUrl() {
  const scriptUrl = process.env.MOTOBOY_GOOGLE_SCRIPT_URL || process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) {
    throw new Error("MOTOBOY_GOOGLE_SCRIPT_URL or GOOGLE_SCRIPT_URL not configured in environment variables.");
  }
  return scriptUrl;
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET environment variable is required");
  }

  // Informa ao Express que ele está rodando atrás de um proxy reverso (Cloud Run / Nginx) 
  // Isso resolve os avisos de segurança (X-Forwarded-For) no rateLimiter e padroniza a coleta de IP real.
  app.set("trust proxy", 1);

  app.use(express.json({ limit: "50kb" })); // Trava global de tamanho de requisição para evitar ataques de estouro de payload
  app.use(cookieSession({
    name: 'session',
    keys: [sessionSecret],
    maxAge: SESSION_MAX_AGE_MS,
    // Temporariamente forçando secure: false para diagnosticar se o problema é o HTTPS no proxy
    secure: false, 
    sameSite: 'lax',
    httpOnly: true,
  }));

  // Bloqueio de Brute Force Limitando a Rota de Login (max 10 tentavias / 15 min)
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 10,
    message: { success: false, message: 'Muitas tentativas de login. Por questões de segurança, aguarde alguns minutos e tente novamente.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Auth Endpoint
  app.post('/api/auth/login', loginLimiter, (req, res) => {
    const { password } = req.body;
    
    const tiPassword = process.env.TI_PASSWORD;
    const receptionPassword = process.env.RECEPTION_PASSWORD;
    const mariaPassword = process.env.MARIA_PASSWORD;

    // Definição das contas de acesso e suas senhas (agora puxadas do .env)
    const validLogins = [
      {
        password: tiPassword,
        user: { name: 'Administrador TI', email: 'suporte.dafiti@dafiti.com.br', picture: '' }
      },
      {
        password: receptionPassword,
        user: { name: 'Recepção', email: 'recepcao@dafiti.com.br', picture: '' }
      },
      {
        password: mariaPassword,
        user: { name: 'Maria Julia Sousa', email: 'maria.sousa@dafiti.com.br', picture: '' }
      }
    ].filter((login) => Boolean(login.password));

    const matchedLogin = validLogins.find(login => login.password === password);

    if (matchedLogin) {
      console.log(`[AUTH] Login bem-sucedido para: ${matchedLogin.user.name}`);
      // @ts-ignore
      req.session.user = matchedLogin.user; 
      console.log(`[AUTH] Cookie de sessão definido: ${!!req.session.user}`);
      res.json({
        success: true,
        user: matchedLogin.user
      });
    } else {
      console.warn(`[AUTH] Tentativa de login falhou - Senha incorreta.`);
      res.status(401).json({ success: false, message: 'Senha incorreta' });
    }
  });

  // Middleware de Autenticação (A Blindagem Anti-Hacker)
  const requireAuth = (req: any, res: any, next: any) => {
    if (AUTH_DEBUG) {
      const proto = req.headers['x-forwarded-proto'];
      console.log(`[AUTH] Rota: ${req.url} | Protocolo: ${proto || 'local'} | IP: ${req.ip}`);
    }
    
    // Log do estado da sessão para depuração em produção
    if (!req.session) {
      console.error(`[AUTH] Erro Crítico: req.session é undefined!`);
    }

    if (!req.session?.user) {
      console.warn(`[AUTH] Acesso bloqueado - Sessão de usuário não encontrada. IP: ${req.ip}`);
      console.log(`[AUTH] Cookies recebidos: ${req.headers.cookie ? 'Sim' : 'Não'}`);
      return res.status(401).json({ success: false, error: 'Acesso Negado: Sessão Inválida ou Expirada. Faça o login novamente.' });
    }
    
    if (AUTH_DEBUG) {
      console.log(`[AUTH] Acesso autorizado para: ${req.session.user.name}`);
    }
    next();
  };

  // Endpoint Extra: Para o frontend saber se a sessão expirou e forçar logout
  app.get('/api/auth/status', (req, res) => {
    // @ts-ignore
    if (req.session?.user) {
      // @ts-ignore
      res.json({ authenticated: true, user: req.session.user });
    } else {
      res.json({ authenticated: false });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    // @ts-ignore
    req.session = null; // Destrói o cookie no Backend
    res.json({ success: true });
  });

  // API routes protegidas pelo Middleware (requireAuth)
  app.get("/api/dashboard-data", requireAuth, async (req, res) => {
    try {
      // ESTÁGIO 2: CAMADA DE CACHE (Memória)
      // Se tivermos os dados e ainda não se passaram os 2 minutos do CACHE_TTL
      if (dashboardCache.data && (Date.now() - dashboardCache.lastFetch < CACHE_TTL)) {
        console.log("Servindo Dashboard direto do Cache (Rápido!)");
        return res.json(dashboardCache.data);
      }

      if (!process.env.GOOGLE_SCRIPT_URL) {
        throw new Error("Google Script URL not configured.");
      }

      // Chama a função nova com Auto-Retry
      const response = await fetchWithRetry(`${process.env.GOOGLE_SCRIPT_URL}?action=getDashboardData`);
      const text = await response.text();
      
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        console.error("Response is not JSON:", text);
        throw new Error("O Google Apps Script retornou uma página HTML em vez de JSON. Verifique se ele foi implantado como 'Qualquer pessoa'.");
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Erro ao buscar dados do Dashboard.");
      }

      // Atualiza nossa camada de Cache com os dados novos processados pelo Google
      const equipCount = result.data?.equipamentosMensal?.length || 0;
      console.log(`[DASHBOARD] Dados recebidos. EquipamentosMensal: ${equipCount} itens.`);
      
      if (equipCount > 0) {
        console.log(`[DASHBOARD] Formato do primeiro item:`, JSON.stringify(result.data.equipamentosMensal[0]));
      }

      dashboardCache.data = result.data;
      dashboardCache.lastFetch = Date.now();

      res.json(result.data);
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/register", requireAuth, async (req, res) => {
    try {
      // 1. Validação estrita e higienização (zod)
      const data = registerSchema.parse(req.body);
      
      if (!process.env.GOOGLE_SCRIPT_URL) {
        throw new Error("Google Script URL not configured in environment variables.");
      }

      // 2. Fetch com os dados higienizados E proteção de Repetição (Retry)
      const response = await fetchWithRetry(process.env.GOOGLE_SCRIPT_URL, {
        ...createAppsScriptPostOptions(data),
      });

      const text = await response.text();
      
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        console.error("Response is not JSON:", text);
        throw new Error("O Google Apps Script retornou uma página HTML em vez de JSON. Verifique se ele foi implantado como 'Qualquer pessoa'.");
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Erro ao processar no Google Apps Script.");
      }

      // Se um novo registro for inserido com sucesso, invalidamos o cache na mesma hora para que o Dashboard puxe do zero atualizado.
      dashboardCache.lastFetch = 0; 
      
      res.json({ success: true, action: result.action, sheet: result.sheet });
    } catch (error: any) {
      console.error("Error/Validation writing to Google Sheets:", error);
      
      // Tratativa de erro clara para expor erros do Zod no frontend
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues[0].message });
      }
      
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/fetch-external-data", requireAuth, async (req, res) => {
    try {
      const { url } = req.query;
      if (!url) throw new Error("URL da planilha não fornecida.");

      if (!process.env.GOOGLE_SCRIPT_URL) {
        throw new Error("Google Script URL not configured.");
      }

      const response = await fetchWithRetry(`${process.env.GOOGLE_SCRIPT_URL}?action=fetchExternal&url=${encodeURIComponent(url as string)}`);
      const text = await response.text();
      
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        throw new Error("Erro ao processar resposta do script.");
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Erro ao buscar dados externos.");
      }

      res.json(result.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/motoboy/requests", requireAuth, async (req, res) => {
    try {
      const role = getMotoboyRole((req as any).session.user.email || "");
      if (role !== "suporte") {
        return res.status(403).json({ error: "Apenas Suporte TI pode criar solicitações de Motoboy." });
      }

      const scriptUrl = getMotoboyScriptUrl();

      const data = motoboyCreateSchema.parse(req.body);
      const payload = {
        action: "createMotoboyRequest",
        data: {
          id: generateMotoboyId(),
          ...data,
          status: "Pendente"
        }
      };

      const response = await fetchWithRetry(scriptUrl, {
        ...createAppsScriptPostOptions(payload),
      });

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        console.error("Response is not JSON:", text);
        throw new Error("Erro ao processar resposta do script.");
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Erro ao criar solicitação de Motoboy.");
      }

      res.json({ success: true, request: result.data || payload.data });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues[0].message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/motoboy/requests", requireAuth, async (req, res) => {
    try {
      const role = getMotoboyRole((req as any).session.user.email || "");
      if (role === "none") {
        return res.status(403).json({ error: "Usuário sem acesso à área Motoboy." });
      }

      const scriptUrl = getMotoboyScriptUrl();

      const query = { action: "listMotoboyRequests", role };
      const response = await fetchWithRetry(`${scriptUrl}?action=${query.action}&role=${query.role}`);
      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        console.error("Response is not JSON:", text);
        throw new Error("Erro ao processar resposta do script.");
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Erro ao listar solicitações de Motoboy.");
      }

      res.json({ success: true, role, requests: filterValidMotoboyRequests(result.data || []) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/motoboy/requests/:id", requireAuth, async (req, res) => {
    try {
      const role = getMotoboyRole((req as any).session.user.email || "");
      if (role !== "recepcao") {
        return res.status(403).json({ error: "Apenas Recepção pode atualizar solicitações de Motoboy." });
      }

      const scriptUrl = getMotoboyScriptUrl();

      const id = z.string().min(1, "ID da solicitação é obrigatório").parse(req.params.id);
      const data = motoboyUpdateSchema.parse(req.body);

      const response = await fetchWithRetry(scriptUrl, {
        ...createAppsScriptPostOptions({ action: "updateMotoboyRequest", id, data }),
      });

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        console.error("Response is not JSON:", text);
        throw new Error("Erro ao processar resposta do script.");
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Erro ao atualizar solicitação de Motoboy.");
      }

      res.json({ success: true, request: result.data });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues[0].message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/motoboy/requests/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).session.user;
      const role = getMotoboyRole(user.email || "");
      if (role !== "suporte" && role !== "recepcao") {
        return res.status(403).json({ error: "Apenas Suporte TI ou Recepção podem excluir solicitações de Motoboy." });
      }

      const scriptUrl = getMotoboyScriptUrl();

      const id = z.string().min(1, "ID da solicitação é obrigatório").parse(req.params.id);
      const data = motoboyDeleteSchema.parse(req.body);

      const response = await fetchWithRetry(scriptUrl, {
        ...createAppsScriptPostOptions({
          action: "deleteMotoboyRequest",
          id,
          data: {
            justificativa: data.justificativa,
            excluidoPor: `${user.name || "Usuário"} <${user.email || "sem-email"}>`
          }
        }),
      });

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        console.error("Response is not JSON:", text);
        throw new Error("Erro ao processar resposta do script.");
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Erro ao excluir solicitação de Motoboy.");
      }

      if (result.action === "registerDesligamento") {
        throw new Error("Apps Script publicado não recebeu a ação deleteMotoboyRequest. Atualize Code.gs, crie Nova versão da implantação e reinicie o backend.");
      }

      if (result.data?.status !== "Excluído") {
        throw new Error("Apps Script de Motoboy desatualizado. Atualize o Code.gs e reimplante o Web App.");
      }

      res.json({ success: true, request: result.data });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues[0].message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
