import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend
} from 'recharts';
import { 
  RefreshCw, 
  PlusCircle, 
  TrendingUp, 
  Package, 
  Calendar,
  ArrowLeft
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';

interface DashboardData {
  totalDesligamentos: number;
  desligamentosMesAtual: number;
  mensalData: { month: string; count: number }[];
  equipamentosMensal: { month: string; count: number }[];
  equipamentosRanking: { name: string; count: number }[];
  pendencias: { name: string; date: string; filial: string; priority: 'ALTA' | 'NORMAL' }[];
  recentReturns?: { name: string; date: string; equipments: string; timestamp?: number }[];
  lastUpdate: string;
}

interface DashboardProps {
  onBack: () => void;
  userEmail: string;
}

export default function Dashboard({ onBack, userEmail }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (isManual = false) => {
    if (isManual) setData(null);
    setIsLoading(true);
    try {
      const response = await fetch('/api/dashboard-data', {
        headers: {
          'x-user-email': userEmail
        }
      });
      if (response.status === 401) {
        localStorage.removeItem('dafiti_user');
        window.location.reload();
        return;
      }
      if (!response.ok) throw new Error('Falha ao carregar dados do Dashboard. Verifique a conexão.');
      const result = await response.json();
      
      if (result.equipamentosRanking) {
        result.equipamentosRanking = result.equipamentosRanking.filter((equip: any) => {
          const name = equip.name.toLowerCase();
          return !name.includes('.xls') && !name.includes('-componente');
        });
      }

      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(false), 15000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center"
        >
          <div className="relative w-24 h-24 mb-8">
            {/* Outer Ring */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full"
            />
            {/* Inner Ring */}
            <motion.div 
              animate={{ rotate: -360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute inset-4 border-4 border-orange-500/10 border-t-orange-500 rounded-full"
            />
            {/* Center Pulse */}
            <motion.div 
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-8 bg-cyan-500/20 rounded-full flex items-center justify-center"
            >
              <div className="w-2 h-2 bg-cyan-400 rounded-full" />
            </motion.div>
          </div>
          
          <motion.h2 
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-white text-xl font-black tracking-tighter uppercase mb-2"
          >
            Sincronizando <span className="text-cyan-400">Dados</span>
          </motion.h2>
          <p className="text-slate-500 text-sm font-medium">Preparando seu dashboard premium...</p>
          
          <div className="mt-8 flex gap-1">
            <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
            <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
            <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-slate-600 rounded-full" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-4 font-sans text-center">
        <h2 className="text-white text-xl font-black mb-4">Ops! Ocorreu um erro no painel.</h2>
        <p className="text-red-400 mb-6">{error}</p>
        <Button onClick={onBack} className="bg-orange-500 hover:bg-orange-600">Voltar</Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-4 md:p-8 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center border border-cyan-500/30 overflow-hidden shadow-lg shadow-cyan-500/5">
            <img 
              src="https://play-lh.googleusercontent.com/BpgosTzb9wzfgCUTYhN6LvYIAB_A-aWozJCZ6vg0nN6-8ul97z2THmJrrB8aQSO73M4" 
              alt="Dafiti Icon" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white uppercase flex items-center gap-3">
              <span className="text-cyan-400">DASHBOARD DE</span> DESLIGAMENTOS
            </h1>
            <p className="text-slate-500 text-xs mt-1">
              Última atualização: {data.lastUpdate}
            </p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => fetchData(true)}
            className="bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button 
            size="sm"
            onClick={onBack}
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Novo Registro
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="bg-[#0f172a] border-cyan-500/20 shadow-lg shadow-cyan-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total de Desligamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-cyan-400">{data.totalDesligamentos}</div>
            <p className="text-[10px] text-slate-500 mt-1">Desde o início</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0f172a] border-orange-500/20 shadow-lg shadow-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wider">Desligamentos Este Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-orange-500">{data.desligamentosMesAtual}</div>
            <p className="text-[10px] text-slate-500 mt-1">Mês atual</p>
          </CardContent>
        </Card>
      </div>

      {/* Line Chart */}
      <Card className="bg-[#0f172a] border-slate-800 mb-8">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            Desligamentos por Mês
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.mensalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis 
                dataKey="month" 
                stroke="#64748b" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                itemStyle={{ color: '#22d3ee' }}
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#22d3ee" 
                strokeWidth={3} 
                dot={{ fill: '#22d3ee', r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name="Desligamentos"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bottom Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Bar Chart 1 */}
        <Card className="bg-[#0f172a] border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-400" />
              Equipamentos Devolvidos por Mês
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.equipamentosMensal || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey={(obj) => obj.month || obj.mes || 'N/A'} 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                />
                <Bar 
                  dataKey={(obj) => obj.count || obj.quantidade || obj.valor || 0} 
                  fill="#10b981" 
                  radius={[4, 4, 0, 0]} 
                  name="Equipamentos" 
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar Chart 2 */}
        <Card className="bg-[#0f172a] border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              Equipamentos Mais Devolvidos
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.equipamentosRanking} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} width={80} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Quantidade" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Pendencias Section */}
      <Card className="bg-[#0f172a] border-orange-500/20 shadow-lg shadow-orange-500/5 mb-8">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-orange-500" />
            Pendências de Devolução
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.pendencias && data.pendencias.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800">
                    <th className="pb-2 font-medium">COLABORADOR</th>
                    <th className="pb-2 font-medium">DATA DESLIGAMENTO</th>
                    <th className="pb-2 font-medium">FILIAL</th>
                    <th className="pb-2 font-medium text-right">PRIORIDADE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {data.pendencias.map((p, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 text-slate-300 font-medium">{p.name}</td>
                      <td className="py-3 text-slate-500">{p.date}</td>
                      <td className="py-3 text-slate-500">{p.filial}</td>
                      <td className="py-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.priority === 'ALTA' 
                            ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                            : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                        }`}>
                          {p.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 text-xs italic">
              Nenhuma pendência encontrada. Tudo em dia!
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ultimos Recebidos Section */}
      <Card className="bg-[#0f172a] border-cyan-500/20 shadow-lg shadow-cyan-500/5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
        <CardHeader>
          <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-cyan-500" />
            Últimos Equipamentos Recebidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentReturns && data.recentReturns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800">
                    <th className="pb-2 font-medium">COLABORADOR</th>
                    <th className="pb-2 font-medium">DATA RECEBIMENTO</th>
                    <th className="pb-2 font-medium">EQUIPAMENTOS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {data.recentReturns.map((p, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 text-slate-300 font-medium">{p.name}</td>
                      <td className="py-3 text-slate-500">{p.date}</td>
                      <td className="py-3 text-slate-500">{p.equipments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 text-xs italic">
              Nenhuma devolução recebida constando ou será necessário atualizar o script do Google para enviar esta variável (recentReturns).
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 text-center text-[10px] text-slate-600 uppercase tracking-widest">
        Dashboard atualizado automaticamente a cada 15 segundos
      </div>
    </div>
  );
}
