/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Plus, 
  Minus,
  Monitor, 
  Laptop, 
  MousePointer2, 
  Keyboard, 
  Power,
  X,
  CheckCircle2
} from 'lucide-react';
import { 
  LogIn, 
  LogOut, 
  ShieldAlert, 
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Dashboard from '@/src/components/Dashboard';
import Motoboy from '@/src/components/Motoboy';

interface CustomEquipment {
  id: string;
  name: string;
  quantity: number;
}

const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

export default function App() {
  const [user, setUser] = useState<{name: string, email: string, picture: string} | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [view, setView] = useState<'form' | 'dashboard' | 'motoboy'>('form');
  const [motoboyPendingCount, setMotoboyPendingCount] = useState(0);
  const [colaborador, setColaborador] = useState('');
  const [equipamentos, setEquipamentos] = useState<{id: string, quantity: number}[]>([]);
  const [customEquipName, setCustomEquipName] = useState('');
  const [customEquipQty, setCustomEquipQty] = useState(1);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastRegisteredName, setLastRegisteredName] = useState('');
  const [customEquipments, setCustomEquipments] = useState<CustomEquipment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Check auth status on mount
  useEffect(() => {
    // Try to load from localStorage first
    const savedUser = localStorage.getItem('dafiti_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
      } catch (e) {
        localStorage.removeItem('dafiti_user');
      }
    }
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password.trim()) {
      setAuthError("Por favor, insira a senha.");
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      const data = await resp.json();
      
      if (resp.ok && data.success) {
        setUser(data.user);
        localStorage.setItem('dafiti_user', JSON.stringify(data.user));
      } else {
        setAuthError(data.message || "Senha incorreta.");
      }
    } catch (error) {
      setAuthError("Erro ao iniciar login: verifique sua conexão.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('dafiti_user');
    setUser(null);
    setView('form');
    setMotoboyPendingCount(0);
  };

  // Limite de sessão de 15 minutos de inatividade
  useEffect(() => {
    if (!user) return; // Apenas monitora se estiver logado

    let timeout: NodeJS.Timeout;

    const logoutDueToInactivity = () => {
      handleLogout();
      // Opcional: mostrar um aviso (mas como a senha será pedida, a transição para a tela form já é auto-explicativa com logout)
    };

    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(logoutDueToInactivity, SESSION_TIMEOUT_MS);
    };

    // Inicia o timer logo que entrar
    resetTimer();

    // Eventos de atividade do usuário
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    return () => {
      clearTimeout(timeout);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user]); // recria/re-inicia quando o usuário loga

  const toggleEquipamento = (id: string) => {
    setEquipamentos(prev => {
      const exists = prev.find(e => e.id === id);
      if (exists) {
        return prev.filter(e => e.id !== id);
      }
      return [...prev, { id, quantity: 1 }];
    });
  };

  const updateEquipamentoQuantity = (id: string, quantity: number) => {
    setEquipamentos(prev => prev.map(e => e.id === id ? { ...e, quantity: Math.max(1, quantity) } : e));
  };

  const addCustomEquipment = () => {
    if (customEquipName.trim()) {
      setCustomEquipments(prev => [
        ...prev, 
        { id: Math.random().toString(36).substr(2, 9), name: customEquipName, quantity: customEquipQty }
      ]);
      setCustomEquipName('');
      setCustomEquipQty(1);
    }
  };

  const handleRegister = async () => {
    if (!colaborador) {
      setMessage({ type: 'error', text: 'Por favor, preencha o nome do colaborador.' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const equipList = [
        ...equipamentos.map(e => {
          const label = standardEquipments.find(s => s.id === e.id)?.label || e.id;
          return `${e.quantity}x ${label}`;
        }),
        ...customEquipments.map(e => `${e.quantity}x ${e.name}`)
      ].join(", ");

      const basePayload: Record<string, any> = {
        colaborador: colaborador,
        equipamentoQuantidade: equipList,
        equipDevolvido: 'Devolvido',
        controleMaju: 'Entregue'
      };

      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user?.email || ''
        },
        // Remove completamente a chave "email" da requisição.
        // A planilha nunca substituirá nada porque o "email" sequer será transmitido.
        body: JSON.stringify(basePayload),
      });

      if (response.status === 401) {
        localStorage.removeItem('dafiti_user');
        window.location.reload();
        return;
      }

      const result = await response.json();

      if (response.ok) {
        setLastRegisteredName(colaborador);
        setShowSuccessModal(true);
        setMessage({ type: 'success', text: 'Registro realizado com sucesso na planilha!' });
        // Limpar campos principais após sucesso
        setColaborador('');
        setEquipamentos([]);
        setCustomEquipments([]);
        
        // Auto-hide message after 5 seconds
        setTimeout(() => {
          setMessage(null);
        }, 5000);
      } else {
        throw new Error(result.error || 'Erro ao registrar na planilha.');
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const removeCustomEquipment = (id: string) => {
    setCustomEquipments(prev => prev.filter(e => e.id !== id));
  };

  const standardEquipments = [
    { id: 'notebook', label: 'Notebook', icon: Laptop },
    { id: 'fonte', label: 'Fonte', icon: Power },
    { id: 'mouse', label: 'Mouse', icon: MousePointer2 },
    { id: 'teclado', label: 'Teclado', icon: Keyboard },
    { id: 'monitor', label: 'Monitor', icon: Monitor },
    { id: 'macbook', label: 'MacBook', icon: Laptop },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium">Autenticando...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-cyan-500/30 flex items-center justify-center p-4">
        {/* Background Glows */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-cyan-500/20 blur-[120px] rounded-full" />
          <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-orange-500/10 blur-[120px] rounded-full" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative max-w-sm w-full"
        >
          <Card className="bg-[#1e293b]/50 border-slate-800 backdrop-blur-2xl shadow-2xl overflow-hidden p-8 text-center">
            <div className="flex justify-center mb-8">
              <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center border border-cyan-500/30 shadow-lg shadow-cyan-500/10 transition-transform hover:scale-110 duration-300 overflow-hidden">
                <img 
                  src="https://play-lh.googleusercontent.com/BpgosTzb9wzfgCUTYhN6LvYIAB_A-aWozJCZ6vg0nN6-8ul97z2THmJrrB8aQSO73M4" 
                  alt="Dafiti Icon" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            <h1 className="text-3xl font-black tracking-tight text-white mb-3 uppercase">
              ACESSO <span className="text-cyan-400 italic">DESLIGADOS</span>
            </h1>
            <p className="text-slate-400 font-medium mb-10 leading-relaxed text-sm">
              Gestão de Ativos • TI Infraestrutura<br/>
              Dafiti Group
            </p>

            {authError && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs flex items-start gap-4 text-left shadow-lg shadow-red-500/5"
              >
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <span>{authError}</span>
              </motion.div>
            )}

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="relative group">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Senha de Acesso"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 bg-slate-900/50 border-slate-700/50 text-center text-lg text-white placeholder:text-slate-500 tracking-widest focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 rounded-2xl pr-14"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-cyan-400 transition-colors p-2 rounded-full hover:bg-white/5"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>

              <Button 
                type="submit"
                disabled={authLoading}
                className="w-full h-14 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold text-lg rounded-2xl flex items-center justify-center gap-4 transition-all active:scale-95 shadow-xl shadow-cyan-900/20 disabled:opacity-50"
              >
                {authLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <LogIn className="w-6 h-6" />
                )}
                {authLoading ? 'Verificando...' : 'Acessar Sistema'}
              </Button>
            </form>

            <div className="mt-10 pt-8 border-t border-slate-800/50">
              <div className="flex justify-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/50" />
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500/50" />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500/50" />
              </div>
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">
                Segurança Corporativa
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <>
    <AnimatePresence mode="wait">
      {view === 'motoboy' ? (
        <motion.div
          key="motoboy"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          <Motoboy
            userEmail={user?.email || ''}
            onPendingCountChange={setMotoboyPendingCount}
            onBack={() => setView('form')}
          />
        </motion.div>
      ) : view === 'dashboard' ? (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          <Dashboard onBack={() => setView('form')} userEmail={user?.email || ''} />
        </motion.div>
      ) : (
        <motion.div
          key="form"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-cyan-500/30"
        >
          {/* Background Glows */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full" />
            <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-orange-500/5 blur-[120px] rounded-full" />
          </div>

          <div className="relative max-w-3xl mx-auto px-4 py-8">
            {/* Upper Profile Bar */}
            <div className="flex justify-between items-center mb-10 px-6 py-3 bg-slate-800/40 backdrop-blur-md rounded-2xl border border-slate-700/50 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center border-2 border-cyan-500/30 overflow-hidden shadow-inner shadow-slate-900/10">
                    <img 
                      src="https://play-lh.googleusercontent.com/BpgosTzb9wzfgCUTYhN6LvYIAB_A-aWozJCZ6vg0nN6-8ul97z2THmJrrB8aQSO73M4" 
                      alt="Dafiti Icon" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-[#0f172a] rounded-full" />
                </div>
                <div>
                  <div className="text-sm font-black text-white leading-tight">{user.name}</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{user.email}</div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl h-10 px-4 transition-all"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span className="text-xs font-bold uppercase tracking-tight">Sair</span>
              </Button>
            </div>

            {/* Header */}
            <div className="flex flex-col items-center mb-12 text-center">
              <div className="mb-8 flex flex-wrap justify-center gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setView('dashboard')}
                  className="bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 transition-all gap-2 rounded-lg px-6"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setView('motoboy')}
                  className="relative bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20 hover:text-orange-300 transition-all gap-2 rounded-lg px-6"
                >
                  Motoboy
                  {motoboyPendingCount > 0 && (
                    <span className="absolute -right-2 -top-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                      {motoboyPendingCount}
                    </span>
                  )}
                </Button>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-2 uppercase">
                REGISTRO DE <br className="md:hidden" />
                <span className="text-cyan-400">DESLIGADOS</span>
              </h1>
          <p className="text-slate-400 font-medium text-lg">Sistema de Controle de Colaboradores</p>
          
          <div className="flex gap-1.5 mt-6">
            <div className="h-1.5 w-14 bg-cyan-500 rounded-full" />
            <div className="h-1.5 w-10 bg-orange-500 rounded-full" />
            <div className="h-1.5 w-6 bg-slate-600 rounded-full" />
          </div>
        </div>

        {/* Form Card */}
        <Card className="bg-[#1e293b]/50 border-slate-800 backdrop-blur-xl shadow-2xl overflow-hidden">
          <CardHeader className="pb-4 relative">
            <div>
              <CardTitle className="text-2xl font-bold text-white">Novo Registro</CardTitle>
              <CardDescription className="text-slate-400">Preencha os dados do colaborador desligado</CardDescription>
            </div>
            <div className="h-0.5 w-16 bg-gradient-to-r from-cyan-500 to-orange-500 mt-2 rounded-full" />
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="colaborador" className="text-sm font-semibold text-slate-300">
                  Colaborador <span className="text-red-500">*</span>
                </Label>
                <Input 
                  id="colaborador"
                  placeholder="Nome completo do colaborador"
                  value={colaborador}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Remove any numbers using regex
                    const sanitizedValue = value.replace(/[0-9]/g, '');
                    setColaborador(sanitizedValue);
                  }}
                  className="bg-[#0f172a]/50 border-slate-700 focus:border-cyan-500/50 focus:ring-cyan-500/20 text-white h-12"
                />
              </div>
            </div>

            {/* Equipments */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold text-slate-300">
                Equipamentos <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-1 gap-3">
                {standardEquipments.map((equip) => {
                  const isSelected = equipamentos.some(e => e.id === equip.id);
                  const currentQty = equipamentos.find(e => e.id === equip.id)?.quantity || 1;

                  return (
                    <div 
                      key={equip.id}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all group ${
                        isSelected 
                          ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' 
                          : 'bg-[#0f172a]/30 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div 
                        className="flex items-center gap-3 cursor-pointer flex-1"
                        onClick={() => toggleEquipamento(equip.id)}
                      >
                        <Checkbox 
                          id={equip.id} 
                          checked={isSelected}
                          onCheckedChange={() => toggleEquipamento(equip.id)}
                          className="border-slate-600 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                        />
                        <equip.icon className={`w-5 h-5 ${isSelected ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-400'}`} />
                        <span className="font-medium">{equip.label}</span>
                      </div>

                      <AnimatePresence>
                        {isSelected && (
                          <motion.div 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button 
                              variant="secondary" 
                              size="icon"
                              className="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-slate-300 border-none rounded-md"
                              onClick={() => updateEquipamentoQuantity(equip.id, currentQty - 1)}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            
                            <div className="w-10 h-8 bg-slate-800/50 flex items-center justify-center rounded-md text-sm font-bold text-white border border-slate-700/50">
                              {currentQty}
                            </div>

                            <Button 
                              variant="secondary" 
                              size="icon"
                              className="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-slate-300 border-none rounded-md"
                              onClick={() => updateEquipamentoQuantity(equip.id, currentQty + 1)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Equipments */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold text-slate-300">
                Adicionar Equipamentos Personalizados
              </Label>
              <div className="flex gap-2 items-center">
                <Input 
                  placeholder="Ex: Webcam, Headset, Monitor Secundário..."
                  value={customEquipName}
                  onChange={(e) => setCustomEquipName(e.target.value)}
                  className="bg-[#0f172a]/50 border-slate-700 focus:border-cyan-500/50 focus:ring-cyan-500/20 text-white h-12 flex-1"
                />
                
                <AnimatePresence>
                  {customEquipName.trim() && (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center gap-2"
                    >
                      <div className="flex items-center gap-1 bg-[#0f172a]/50 border border-slate-700 rounded-xl px-1 h-12">
                        <Button 
                          variant="secondary" 
                          size="icon"
                          className="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-slate-300 border-none rounded-md"
                          onClick={() => setCustomEquipQty(Math.max(1, customEquipQty - 1))}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        
                        <div className="w-10 h-8 bg-slate-800/50 flex items-center justify-center rounded-md text-sm font-bold text-white border border-slate-700/50">
                          {customEquipQty}
                        </div>

                        <Button 
                          variant="secondary" 
                          size="icon"
                          className="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-slate-300 border-none rounded-md"
                          onClick={() => setCustomEquipQty(customEquipQty + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>

                      <Button 
                        onClick={addCustomEquipment}
                        className="bg-cyan-500 hover:bg-cyan-400 text-white h-12 w-12 p-0 rounded-xl shrink-0"
                      >
                        <Plus className="w-6 h-6" />
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence>
                {customEquipments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {customEquipments.map((equip) => (
                      <motion.div
                        key={equip.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-2 bg-slate-800/50 border border-slate-700 px-3 py-1.5 rounded-full text-sm text-slate-300"
                      >
                        <span className="font-bold text-cyan-400">{equip.quantity}x</span>
                        <span>{equip.name}</span>
                        <button 
                          onClick={() => removeCustomEquipment(equip.id)}
                          className="text-slate-500 hover:text-red-400 transition-colors ml-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Submit Button */}
            <Button 
              onClick={handleRegister}
              disabled={isLoading}
              className="w-full h-14 text-lg font-bold text-white bg-gradient-to-r from-cyan-500 via-cyan-400 to-orange-500 hover:from-cyan-400 hover:to-orange-400 shadow-xl shadow-cyan-500/20 transition-all duration-300 rounded-xl mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Registrando...
                </div>
              ) : (
                'Registrar Recebimento'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center gap-2 text-slate-500 text-sm">
          <img 
            src="https://play-lh.googleusercontent.com/BpgosTzb9wzfgCUTYhN6LvYIAB_A-aWozJCZ6vg0nN6-8ul97z2THmJrrB8aQSO73M4" 
            alt="Dafiti Icon" 
            className="w-8 h-8 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-300 pointer-events-none"
            referrerPolicy="no-referrer"
          />
          <p>© 2026 Dafiti Group - TI Infraestrutura</p>
        </div>
      </div>
    </motion.div>
    )}
    </AnimatePresence>

    {/* Floating Notification */}
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[110] w-full max-w-sm px-4"
        >
          <div className={`p-4 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3 border ${
            message.type === 'success' 
              ? 'bg-green-500/20 border-green-500/30 text-green-400' 
              : 'bg-red-500/20 border-red-500/30 text-red-400'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <ShieldAlert className="w-5 h-5 shrink-0" />
            )}
            <span className="text-sm font-bold">{message.text}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Success Modal */}
    <AnimatePresence>
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSuccessModal(false)}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Success Animation Background */}
            <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-green-500/20 to-transparent pointer-events-none" />
            
            <div className="relative p-8 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 border border-green-500/30">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </motion.div>
              </div>
              
              <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">
                Registro Concluído!
              </h3>
              
              <p className="text-slate-400 mb-6 font-medium">
                O colaborador <span className="text-white font-bold">{lastRegisteredName}</span> foi registrado com sucesso na planilha de desligados.
              </p>
              
              <div className="w-full h-px bg-slate-800 mb-6" />
              
              <Button 
                onClick={() => setShowSuccessModal(false)}
                className="w-full h-12 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg shadow-green-900/20 transition-all active:scale-95"
              >
                Entendido
              </Button>
            </div>
            
            {/* Bottom Accent */}
            <div className="h-1.5 w-full bg-green-500" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}
