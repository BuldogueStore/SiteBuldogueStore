/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Bot, License, UserProfile } from './types';
import { User } from '@supabase/supabase-js';
import { 
  Layout, 
  ShoppingBag, 
  User as UserIcon, 
  LogOut, 
  ShieldCheck, 
  Clock, 
  RefreshCw, 
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Terminal,
  Activity,
  Zap,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
}

function handleSupabaseError(error: unknown, operationType: OperationType, table: string) {
  console.error(`Supabase Error [${operationType}] on ${table}:`, error);
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bots, setBots] = useState<Bot[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [view, setView] = useState<'catalog' | 'client-area' | 'admin'>('catalog');
  const [loading, setLoading] = useState(true);

  // --- Auth & Profile ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (currentUser: User) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('uid', currentUser.id)
        .single();

      if (data) {
        setProfile(data as UserProfile);
      } else {
        // Create new profile
        const newProfile: UserProfile = {
          uid: currentUser.id,
          email: currentUser.email || '',
          role: currentUser.email === 'punisherjogador@gmail.com' ? 'admin' : 'customer'
        };
        const { error: insertError } = await supabase.from('users').insert(newProfile);
        if (!insertError) {
          setProfile(newProfile);
        }
      }
    } catch (err) {
      handleSupabaseError(err, OperationType.GET, 'users');
    } finally {
      setLoading(false);
    }
  };

  // --- Data Fetching ---
  useEffect(() => {
    fetchBots();
    
    // Subscribe to bots changes
    const botsSubscription = supabase
      .channel('public:bots')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bots' }, () => {
        fetchBots();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(botsSubscription);
    };
  }, []);

  useEffect(() => {
    if (user && profile) {
      fetchLicenses();

      // Subscribe to licenses changes
      const licensesSubscription = supabase
        .channel('public:licenses')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'licenses',
            filter: profile.role === 'admin' ? undefined : `userId=eq.${user.id}`
        }, () => {
          fetchLicenses();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(licensesSubscription);
      };
    } else {
      setLicenses([]);
    }
  }, [user, profile]);

  const fetchBots = async () => {
    const { data, error } = await supabase.from('bots').select('*');
    if (error) handleSupabaseError(error, OperationType.LIST, 'bots');
    else setBots(data || []);
  };

  const fetchLicenses = async () => {
    if (!user) return;
    
    let query = supabase.from('licenses').select('*');
    if (profile?.role !== 'admin') {
      query = query.eq('userId', user.id);
    }
    
    const { data, error } = await query;
    if (error) handleSupabaseError(error, OperationType.LIST, 'licenses');
    else {
      // Convert string dates to Timestamps/Dates for existing UI components
      const formattedLicenses = (data || []).map(l => ({
        ...l,
        expiresAt: { toDate: () => new Date(l.expiresAt) } // Mock Firebase Timestamp for compatibility
      }));
      setLicenses(formattedLicenses as any);
    }
  };


  // --- Actions ---
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [isAdminFormOpen, setIsAdminFormOpen] = useState(false);
  const [newBot, setNewBot] = useState<Partial<Bot>>({
    name: '',
    description: '',
    price: 0,
    features: [],
    imageUrl: ''
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'register') {
        const { error } = await supabase.auth.signUp({
          email: authForm.email,
          password: authForm.password,
        });
        if (error) throw error;
        // Supabase might require email confirmation depending on settings
        setAuthError('Verifique seu e-mail para confirmar o cadastro (se necessário pelo Supabase), ou tente fazer login.');
        setAuthMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authForm.email,
          password: authForm.password,
        });
        if (error) throw error;
        setIsAuthModalOpen(false);
        setAuthForm({ email: '', password: '' });
      }
    } catch (error: any) {
      setAuthError(error.message || 'Erro na autenticação.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = () => {
    setIsAuthModalOpen(true);
    setAuthMode('login');
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setView('catalog');
  };

  const openPayment = (bot: Bot) => {
    if (!user) return handleLogin();
    setSelectedBot(bot);
    setIsPaymentModalOpen(true);
  };

  const confirmPurchase = async () => {
    if (!user || !selectedBot) return;
    
    try {
      const licenseKey = `BULDOGUE-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const newLicense = {
        userId: user.id,
        botId: selectedBot.id,
        botName: selectedBot.name,
        licenseKey,
        expiresAt: expiresAt.toISOString(),
        status: 'active'
      };

      const { error } = await supabase.from('licenses').insert(newLicense);
      if (error) throw error;

      setIsPaymentModalOpen(false);
      setSelectedBot(null);
      fetchLicenses();
      setView('client-area');
    } catch (error) {
      handleSupabaseError(error, OperationType.CREATE, 'licenses');
    }
  };

  const handleCreateBot = async (e: any) => {
    e.preventDefault();
    if (!newBot.name || !newBot.description || !newBot.price) return;

    try {
      const { error } = await supabase.from('bots').insert(newBot);
      if (error) throw error;

      setNewBot({ name: '', description: '', price: 0, features: [], imageUrl: '' });
      setIsAdminFormOpen(false);
      fetchBots();
    } catch (error) {
      handleSupabaseError(error, OperationType.CREATE, 'bots');
    }
  };

  const deleteBot = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este bot?')) return;
    try {
      const { error } = await supabase.from('bots').delete().eq('id', id);
      if (error) throw error;
      fetchBots();
    } catch (error) {
      handleSupabaseError(error, OperationType.DELETE, `bots`);
    }
  };

  const renewLicense = async (license: any) => {
    try {
      const currentExpiry = license.expiresAt.toDate();
      const newExpiry = new Date(currentExpiry > new Date() ? currentExpiry : new Date());
      newExpiry.setDate(newExpiry.getDate() + 30);

      const { error } = await supabase
        .from('licenses')
        .update({ 
          expiresAt: newExpiry.toISOString(),
          status: 'active' 
        })
        .eq('id', license.id);
        
      if (error) throw error;
      fetchLicenses();
    } catch (error) {
      handleSupabaseError(error, OperationType.UPDATE, `licenses`);
    }
  };

  // --- Admin Actions ---
  const seedBots = async () => {
    const initialBots = [
      { name: 'Buldogue Moderation', description: 'O bot definitivo para manter seu servidor seguro e organizado.', price: 29.90, features: ['Auto-mod', 'Logs avançados', 'Sistema de tickets'] },
      { name: 'Buldogue Economy', description: 'Sistema de economia completo com cassino, lojas e rankings.', price: 19.90, features: ['Cassino', 'Loja customizável', 'Daily rewards'] },
      { name: 'Buldogue Music Pro', description: 'Qualidade de áudio superior sem lag para seu servidor.', price: 14.90, features: ['High quality audio', 'Spotify/YT support', 'Filtros de áudio'] }
    ];

    for (const b of initialBots) {
      await supabase.from('bots').insert(b);
    }
    fetchBots();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center font-mono overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.15)_0%,transparent_70%)]" />
        <div className="tech-scan" />
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="w-24 h-24 border-4 border-red-600 border-t-transparent rounded-full animate-spin shadow-[0_0_30px_rgba(220,38,38,0.5)]" />
          <div className="space-y-2 text-center">
            <h2 className="text-red-600 text-2xl font-black tracking-[0.3em] glitch-text">INITIALIZING SYSTEM</h2>
            <div className="flex gap-1 justify-center">
              {[...Array(5)].map((_, i) => (
                <motion.div 
                  key={i}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                  className="w-2 h-2 bg-red-600"
                />
              ))}
            </div>
          </div>
          <div className="text-[10px] text-zinc-600 uppercase tracking-widest mt-4">
            Buldogue OS v2.5.0 // Connection: Secure
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-red-600 selection:text-white relative">
      {/* HUD Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
        <div className="absolute top-10 left-10 text-[10px] font-mono text-red-900/40 vertical-text uppercase tracking-widest hidden lg:block">
          System_Status: Operational // Latency: 14ms // Uptime: 99.9%
        </div>
        <div className="absolute bottom-10 right-10 text-[10px] font-mono text-red-900/40 uppercase tracking-widest hidden lg:block">
          [SECURE_ENCRYPTION_ACTIVE]
        </div>
        {/* Red background details */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-red-900/5 rounded-full blur-[150px]" />
      </div>

      {/* Navbar */}
      <nav className="border-b border-red-600/20 bg-black/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('catalog')}>
              <div className="relative">
                <div className="w-12 h-12 bg-red-600 cyber-border flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.6)] group-hover:scale-110 transition-transform">
                  <Cpu className="text-black w-7 h-7" />
                </div>
                <div className="absolute -inset-1 border border-red-600/50 cyber-border animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tighter uppercase italic leading-none glitch-text">
                  Buldogue <span className="text-red-600">Store</span>
                </span>
                <span className="text-[8px] font-mono text-red-600/60 tracking-[0.4em] uppercase">Advanced Bot Solutions</span>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-8 text-sm font-bold uppercase tracking-widest">
              <button onClick={() => setView('catalog')} className={`hover:text-red-600 transition-colors ${view === 'catalog' ? 'text-red-600' : ''}`}>Catálogo</button>
              {user && (
                <button onClick={() => setView('client-area')} className={`hover:text-red-600 transition-colors ${view === 'client-area' ? 'text-red-600' : ''}`}>Minha Área</button>
              )}
              {profile?.role === 'admin' && (
                <button onClick={() => setView('admin')} className={`hover:text-red-600 transition-colors ${view === 'admin' ? 'text-red-600' : ''}`}>Admin</button>
              )}
            </div>

            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="hidden sm:block text-right">
                    <p className="text-xs font-bold text-gray-400 truncate max-w-[120px]">{user.displayName || user.email}</p>
                    <p className="text-[10px] text-red-600 uppercase font-black">{profile?.role}</p>
                  </div>
                  <button onClick={handleLogout} className="p-2 hover:bg-red-600/10 rounded-full transition-colors text-gray-400 hover:text-red-600">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleLogin}
                  className="bg-red-600 hover:bg-red-700 text-black px-6 py-2 rounded-full font-black uppercase text-xs tracking-widest transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:shadow-[0_0_30px_rgba(220,38,38,0.5)] active:scale-95"
                >
                  Entrar
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <AnimatePresence mode="wait">
          {view === 'catalog' && (
            <motion.div 
              key="catalog"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="text-center space-y-6 relative py-10">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-20 bg-gradient-to-b from-red-600 to-transparent" />
                <h1 className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter leading-none">
                  Automação de <span className="text-red-600 glitch-text">Elite</span>
                </h1>
                <div className="flex items-center justify-center gap-4">
                  <div className="h-px w-12 bg-red-600/30" />
                  <p className="text-red-600 font-mono text-xs uppercase tracking-[0.5em] animate-pulse">
                    [ Protocolo de Elite Ativado ]
                  </p>
                  <div className="h-px w-12 bg-red-600/30" />
                </div>
                <p className="text-zinc-500 max-w-2xl mx-auto text-lg font-medium">
                  Sistemas autônomos de alta performance para servidores que exigem o absoluto melhor.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {bots.map((bot) => (
                  <div key={bot.id} className="group relative">
                    {/* Cyber Card Background */}
                    <div className="absolute -inset-0.5 bg-gradient-to-br from-red-600/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity cyber-border blur-sm" />
                    
                    <div className="relative bg-zinc-950 border border-zinc-800 cyber-border overflow-hidden transition-all duration-500 group-hover:translate-y-[-8px] group-hover:border-red-600/50">
                      <div className="h-56 bg-zinc-900 relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.2)_0%,transparent_70%)]" />
                        {bot.imageUrl ? (
                          <img src={bot.imageUrl} alt={bot.name} className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Terminal className="w-20 h-20 text-red-600/20" />
                          </div>
                        )}
                        <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md border border-red-600/30 px-3 py-1 cyber-border">
                          <span className="text-red-600 font-mono text-xs font-black">ID: {bot.id.substring(0, 6)}</span>
                        </div>
                        <div className="tech-scan opacity-30" />
                      </div>

                      <div className="p-8 space-y-6">
                        <div className="space-y-2">
                          <div className="flex justify-between items-end">
                            <h3 className="text-2xl font-black uppercase italic tracking-tight group-hover:text-red-600 transition-colors">{bot.name}</h3>
                            <div className="text-right">
                              <p className="text-[10px] text-zinc-500 uppercase font-bold">Monthly_Rate</p>
                              <p className="text-2xl font-black text-white">R$ {bot.price.toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="h-px w-full bg-gradient-to-r from-red-600/50 to-transparent" />
                        </div>

                        <p className="text-zinc-400 text-sm leading-relaxed font-medium h-12 line-clamp-2">{bot.description}</p>
                        
                        <div className="grid grid-cols-2 gap-3">
                          {bot.features?.slice(0, 4).map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 uppercase">
                              <Zap className="w-3 h-3 text-red-600" />
                              {f}
                            </div>
                          ))}
                        </div>

                        <button 
                          onClick={() => openPayment(bot)}
                          className="w-full relative group/btn overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-red-600 cyber-border translate-y-[100%] group-hover/btn:translate-y-0 transition-transform duration-300" />
                          <div className="relative border-2 border-red-600 py-4 cyber-border flex items-center justify-center gap-3 font-black uppercase text-xs tracking-[0.2em] transition-colors group-hover/btn:text-black">
                            <Activity className="w-4 h-4" />
                            Inicializar Aquisição
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {bots.length === 0 && (
                  <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-800 rounded-3xl">
                    <p className="text-gray-500 font-mono uppercase tracking-widest">Nenhum bot no catálogo no momento.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'client-area' && (
            <motion.div 
              key="client-area"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-10"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="relative">
                  <div className="absolute -left-4 top-0 bottom-0 w-1 bg-red-600" />
                  <h2 className="text-4xl font-black uppercase italic tracking-tighter">Terminal do <span className="text-red-600">Cliente</span></h2>
                  <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest mt-1">Acesso Autorizado // Nível: Usuário</p>
                </div>
                <div className="bg-zinc-950 px-6 py-3 cyber-border border border-red-600/20 flex items-center gap-4">
                  <div className="w-2 h-2 bg-red-600 animate-ping rounded-full" />
                  <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">{user?.email}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8">
                {licenses.map((license) => {
                  const isExpired = license.expiresAt.toDate() < new Date();
                  return (
                    <div key={license.id} className="relative group">
                      <div className={`absolute -inset-0.5 bg-red-600/20 opacity-0 group-hover:opacity-100 transition-opacity cyber-border blur-sm`} />
                      <div className={`relative bg-zinc-950 border ${isExpired ? 'border-red-600/50' : 'border-zinc-800'} cyber-border p-8 flex flex-col lg:flex-row gap-8 items-center justify-between`}>
                        <div className="flex items-center gap-8 w-full lg:w-auto">
                          <div className={`w-20 h-20 cyber-border flex items-center justify-center ${isExpired ? 'bg-red-900/20 text-red-600' : 'bg-zinc-900 text-red-600/40'}`}>
                            <Lock className="w-10 h-10" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-2xl font-black uppercase italic">{license.botName}</h3>
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-mono text-zinc-600 uppercase">Chave_de_Acesso</span>
                              <div className="bg-black px-4 py-2 cyber-border border border-zinc-800 flex items-center gap-3 group/key">
                                <span className="text-xs font-mono text-red-600 tracking-wider">{license.licenseKey}</span>
                                <button className="text-zinc-700 hover:text-white transition-colors">
                                  <RefreshCw className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-10 w-full lg:w-auto">
                          <div className="space-y-1">
                            <p className="text-[10px] font-mono text-zinc-600 uppercase">Expiração</p>
                            <p className={`text-lg font-black ${isExpired ? 'text-red-600' : 'text-white'}`}>
                              {license.expiresAt.toDate().toLocaleDateString('pt-BR')}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <p className="text-[10px] font-mono text-zinc-600 uppercase">Status_Sistêmico</p>
                            <div className={`flex items-center gap-2 text-xs font-black uppercase ${isExpired ? 'text-red-600' : 'text-emerald-500'}`}>
                              <Activity className="w-4 h-4" />
                              {isExpired ? 'Desativado' : 'Operacional'}
                            </div>
                          </div>

                          <button 
                            onClick={() => renewLicense(license)}
                            className="col-span-2 md:col-span-1 bg-red-600 hover:bg-red-700 text-black px-8 py-4 cyber-border font-black uppercase text-xs tracking-[0.2em] transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                          >
                            <Zap className="w-4 h-4" />
                            Renovar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {licenses.length === 0 && (
                  <div className="py-20 text-center border-2 border-dashed border-zinc-800 rounded-3xl space-y-4">
                    <ShoppingBag className="w-12 h-12 text-zinc-800 mx-auto" />
                    <p className="text-gray-500 font-mono uppercase tracking-widest">Você ainda não possui licenças.</p>
                    <button onClick={() => setView('catalog')} className="text-red-600 font-bold uppercase text-xs hover:underline">Ver catálogo</button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'admin' && profile?.role === 'admin' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-black uppercase italic">Painel <span className="text-red-600">Admin</span></h2>
                <button 
                  onClick={() => setIsAdminFormOpen(true)}
                  className="bg-red-600 hover:bg-red-700 text-black px-6 py-3 rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg shadow-red-600/20"
                >
                  <Plus className="w-4 h-4" />
                  Novo Bot
                </button>
              </div>

              {isAdminFormOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-zinc-900 p-8 rounded-3xl border border-red-600/30 shadow-2xl"
                >
                  <form onSubmit={handleCreateBot} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-gray-500">Nome do Bot</label>
                      <input 
                        type="text" 
                        required
                        className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 focus:border-red-600 outline-none transition-colors"
                        value={newBot.name}
                        onChange={e => setNewBot({...newBot, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-gray-500">Preço (R$)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        required
                        className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 focus:border-red-600 outline-none transition-colors"
                        value={newBot.price}
                        onChange={e => setNewBot({...newBot, price: parseFloat(e.target.value)})}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-black uppercase text-gray-500">Descrição</label>
                      <textarea 
                        required
                        className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 focus:border-red-600 outline-none transition-colors h-32"
                        value={newBot.description}
                        onChange={e => setNewBot({...newBot, description: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-black uppercase text-gray-500">URL da Imagem de Capa</label>
                      <input 
