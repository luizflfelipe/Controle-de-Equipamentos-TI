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
  equipamentoQuantidade: z.string().max(1000).optional(),
  equipDevolvido: z.string().max(100).optional(),
  controleMaju: z.string().max(100).optional()
}).strip(); // O '.strip()' remove automaticamente quaisquer campos maliciosos/não-mapeados que venham na requisição

// --- ESTÁGIO 2: Resiliência e Performance ---

// 1. Variável Global de Cache para o Dashboard 
const dashboardCache = {
  data: null as any,
  lastFetch: 0
};
const CACHE_TTL = 2 * 60 * 1000; // 2 minutos em milissegundos

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Informa ao Express que ele está rodando atrás de um proxy reverso (Cloud Run / Nginx) 
  // Isso resolve os avisos de segurança (X-Forwarded-For) no rateLimiter e padroniza a coleta de IP real.
  app.set("trust proxy", 1);

  app.use(express.json({ limit: "50kb" })); // Trava global de tamanho de requisição para evitar ataques de estouro de payload
  app.use(cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'dafiti-ti-secret'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
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
    
    const tiPassword = process.env.TI_PASSWORD || process.env.SESSION_SECRET || 'dafiti-ti-secret';
    const receptionPassword = process.env.RECEPTION_PASSWORD || 'D3slig@d0s';

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
        password: process.env.MARIA_PASSWORD || 'Dafiti@20304050',
        user: { name: 'Maria Julia Sousa', email: 'maria.sousa@dafiti.com.br', picture: '' }
      }
    ];

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
    const proto = req.headers['x-forwarded-proto'];
    console.log(`[AUTH] Rota: ${req.url} | Protocolo: ${proto || 'local'} | IP: ${req.ip}`);
    
    // Log do estado da sessão para depuração em produção
    if (!req.session) {
      console.error(`[AUTH] Erro Crítico: req.session é undefined!`);
    }

    if (!req.session?.user) {
      console.warn(`[AUTH] Acesso bloqueado - Sessão de usuário não encontrada. IP: ${req.ip}`);
      console.log(`[AUTH] Cookies recebidos: ${req.headers.cookie ? 'Sim' : 'Não'}`);
      return res.status(401).json({ success: false, error: 'Acesso Negado: Sessão Inválida ou Expirada. Faça o login novamente.' });
    }
    
    console.log(`[AUTH] Acesso autorizado para: ${req.session.user.name}`);
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
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
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
