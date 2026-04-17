/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  getDoc,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  limit
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Calendar, 
  DollarSign, 
  Users, 
  Settings, 
  RefreshCw, 
  Plus, 
  Trash2, 
  FileText, 
  Phone, 
  Edit,
  LogOut,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  User as UserIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  CreditCard,
  Building2,
  ShieldCheck,
  Snowflake
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './lib/firebase';
import { cn, formatCurrency, formatDate } from './lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

// --- TYPES ---
type UserRole = 'ADMIN' | 'TECH';

interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: any;
}

interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  createdAt?: any;
}

interface Service {
  id: string;
  clientName: string;
  clientId?: string;
  date: string;
  serviceType: string;
  value: number;
  phone: string;
  techId: string | null;
  status: 'QUOTE' | 'PENDING' | 'WAITING_PARTS' | 'FINISHED' | 'CANCELED';
  createdAt?: any;
  updatedAt?: any;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  date: string;
  serviceId?: string;
  createdAt?: any;
}

interface CompanySettings {
  name: string;
  owner: string;
  document?: string;
  phone?: string;
  email?: string;
  notifications?: {
    enabled: boolean;
    daysAhead: number;
    soundEnabled: boolean;
  };
}

const STATUS_LABELS = {
  QUOTE: { label: 'Orçamento', color: 'bg-violet-100 text-violet-700', icon: FileText },
  PENDING: { label: 'Agendado', color: 'bg-blue-100 text-blue-700', icon: Clock },
  WAITING_PARTS: { label: 'Aguardando Peça', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  FINISHED: { label: 'Finalizado', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  CANCELED: { label: 'Cancelado', color: 'bg-rose-100 text-rose-700', icon: X },
};

// --- COMPONENTS ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<SystemUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [syncing, setSyncing] = useState(false);

  // Data State
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [company, setCompany] = useState<CompanySettings>({
    name: 'DR CLIMA',
    owner: 'Mateus Santana',
  });

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Fetch profile
        const profileDoc = await getDoc(doc(db, 'users', u.uid));
        if (profileDoc.exists()) {
          setProfile({ id: u.uid, ...profileDoc.data() } as SystemUser);
        } else {
          // If bootstrapped admin (first login)
          if (u.email === 'mateusantna@gmail.com') {
             const adminData = {
               name: 'Mateus Santana',
               email: u.email,
               role: 'ADMIN' as const,
               createdAt: serverTimestamp()
             };
             await setDoc(doc(db, 'users', u.uid), adminData);
             setProfile({ id: u.uid, ...adminData } as SystemUser);
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Real-time Listeners
  useEffect(() => {
    if (!profile) return;

    const unsubscribers: (() => void)[] = [];

    // Company Settings
    unsubscribers.push(onSnapshot(doc(db, 'settings', 'company'), (doc) => {
      if (doc.exists()) setCompany(doc.data() as CompanySettings);
    }));

    // Clients
    unsubscribers.push(onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
    }));

    // Services
    const servicesQuery = profile.role === 'ADMIN' 
      ? query(collection(db, 'services'), orderBy('date', 'desc'))
      : query(collection(db, 'services'), where('techId', '==', profile.id), orderBy('date', 'desc'));
    
    unsubscribers.push(onSnapshot(servicesQuery, (snapshot) => {
      setServices(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
    }));

    if (profile.role === 'ADMIN') {
      // Users (for admin)
      unsubscribers.push(onSnapshot(collection(db, 'users'), (snapshot) => {
        setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SystemUser)));
      }));

      // Transactions (for admin)
      unsubscribers.push(onSnapshot(query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(100)), (snapshot) => {
        setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
      }));
    }

    return () => unsubscribers.forEach(unsub => unsub());
  }, [profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCw className="w-8 h-8 text-blue-500" />
        </motion.div>
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginScreen />;
  }

  const isAdmin = profile.role === 'ADMIN';

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-bg text-text-main font-sans">
      {/* Sidebar / Desktop Nav */}
      <aside className={cn(
        "hidden md:flex flex-col w-64 bg-sidebar text-text-dim h-screen sticky top-0 border-r border-card-border z-20"
      )}>
        <div className="p-8 border-b border-card-border">
          <div className="flex items-center gap-2 mb-1">
            <Snowflake className="text-brand-primary" size={24} />
            <h1 className="text-text-main font-black text-xl tracking-tighter truncate leading-none">{company.name}</h1>
          </div>
          <div className="mt-6 p-4 bg-white/5 rounded-xl text-center">
            <p className="text-[10px] uppercase font-bold text-text-dim tracking-widest mb-1">
              {isAdmin ? 'Administrador' : 'Técnico'}
            </p>
            <p className="text-text-main font-bold text-sm truncate">{profile.name}</p>
          </div>
        </div>
        
        <nav className="flex-1 py-6 space-y-2 px-4">
          {isAdmin && (
            <NavItem 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
              icon={<LayoutDashboard size={20} />} 
              label="Dashboard" 
            />
          )}
          {isAdmin && (
            <NavItem 
              active={activeTab === 'clients'} 
              onClick={() => setActiveTab('clients')} 
              icon={<Users size={20} />} 
              label="Clientes" 
            />
          )}
          <NavItem 
            active={activeTab === 'services'} 
            onClick={() => setActiveTab('services')} 
            icon={<Calendar size={20} />} 
            label={isAdmin ? 'Agenda Geral' : 'Meus Serviços'} 
          />
          {isAdmin && (
            <NavItem 
              active={activeTab === 'finance'} 
              onClick={() => setActiveTab('finance')} 
              icon={<DollarSign size={20} />} 
              label="Fluxo de Caixa" 
            />
          )}
          {isAdmin && (
            <NavItem 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')} 
              icon={<Settings size={20} />} 
              label="Equipe / Config" 
            />
          )}
        </nav>
        
        <div className="p-4 border-t border-card-border">
          <button 
            onClick={() => signOut(auth)}
            className="w-full flex items-center justify-center gap-2 text-rose-400 text-sm font-bold p-3 hover:bg-rose-500/10 rounded-xl transition-colors"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden bg-header text-text-main p-4 flex justify-between items-center sticky top-0 z-30 border-b border-card-border">
        <div className="flex items-center gap-2">
          <Snowflake className="text-brand-primary" size={20} />
          <span className="font-bold text-base tracking-tight">{company.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase font-black text-brand-primary">
            {isAdmin ? 'Admin' : 'Técnico'}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-24 md:pb-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 md:p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && isAdmin && <DashboardView services={services} transactions={transactions} clients={clients} company={company} onNavigate={setActiveTab} />}
              {activeTab === 'clients' && isAdmin && <ClientsView clients={clients} />}
              {activeTab === 'services' && <ServicesView services={services} isAdmin={isAdmin} users={users} />}
              {activeTab === 'finance' && isAdmin && <FinanceView transactions={transactions} company={company} />}
              {activeTab === 'settings' && isAdmin && <SettingsView company={company} users={users} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-3 z-50">
        {isAdmin ? (
          <>
            <MobileNavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} label="Início" />
            <MobileNavItem active={activeTab === 'clients'} onClick={() => setActiveTab('clients')} icon={<Users size={20} />} label="Clientes" />
            <MobileNavItem active={activeTab === 'services'} onClick={() => setActiveTab('services')} icon={<Calendar size={20} />} label="Agenda" />
            <MobileNavItem active={activeTab === 'finance'} onClick={() => setActiveTab('finance')} icon={<DollarSign size={20} />} label="Caixa" />
          </>
        ) : (
          <>
            <MobileNavItem active={activeTab === 'services'} onClick={() => setActiveTab('services')} icon={<Calendar size={20} />} label="Tarefas" />
            <button onClick={() => signOut(auth)} className="flex flex-col items-center gap-1 text-rose-400">
              <LogOut size={20} />
              <span className="text-[9px] font-bold">Sair</span>
            </button>
          </>
        )}
      </nav>
    </div>
  );
}

// --- SUBVIEWS ---

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError('Credenciais inválidas. Verifique seu email e senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 -left-20 w-80 h-80 bg-brand-primary rounded-full mix-blend-multiply filter blur-3xl opacity-10"></div>
      <div className="absolute bottom-0 -right-20 w-80 h-80 bg-brand-secondary rounded-full mix-blend-multiply filter blur-3xl opacity-10"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card w-full max-w-md rounded-3xl shadow-2xl p-8 md:p-12 relative z-10 border border-card-border"
      >
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Snowflake className="text-brand-primary" size={40} />
            <h1 className="text-4xl font-black text-text-main tracking-tighter">DR <span className="text-brand-primary">CLIMA</span></h1>
          </div>
          <p className="text-text-dim font-bold text-xs uppercase tracking-widest">Acesso ao Sistema</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-text-dim uppercase tracking-widest ml-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
              className="w-full bg-bg border border-card-border p-4 rounded-2xl outline-none focus:ring-4 focus:ring-brand-primary/10 font-bold text-text-main" 
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-text-dim uppercase tracking-widest ml-1">Senha</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
              className="w-full bg-bg border border-card-border p-4 rounded-2xl outline-none focus:ring-4 focus:ring-brand-primary/10 font-bold text-text-main" 
            />
          </div>

          {error && <p className="text-rose-500 text-xs font-bold text-center">{error}</p>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-brand-primary text-bg font-black py-5 rounded-2xl shadow-xl hover:opacity-90 active:scale-95 transition-all text-lg disabled:opacity-70"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick} 
      className={cn(
        "flex items-center gap-3 w-full p-3.5 rounded-xl transition-all font-semibold",
        active ? 'bg-brand-primary/10 text-brand-primary border-r-2 border-brand-primary' : 'text-text-dim hover:bg-white/5 hover:text-text-main'
      )}
    >
      {icon} <span className="text-sm">{label}</span>
    </button>
  );
}

function MobileNavItem({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick} 
      className={cn(
        "flex flex-col items-center gap-1 transition-all",
        active ? 'text-brand-primary scale-110' : 'text-text-dim'
      )}
    >
      {icon} <span className="text-[9px] font-bold">{label}</span>
    </button>
  );
}

// --- VIEW COMPONENTS ---

function DashboardView({ services, transactions, clients, company, onNavigate }: any) {
  const totalIncome = transactions.filter((t: any) => t.type === 'INCOME').reduce((acc: any, t: any) => acc + t.amount, 0);
  const totalExpense = transactions.filter((t: any) => t.type === 'EXPENSE').reduce((acc: any, t: any) => acc + t.amount, 0);
  const finishedServices = services.filter((s: any) => s.status === 'FINISHED').length;
  const profit = totalIncome - totalExpense;

  const chartData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthPrefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const income = transactions.filter((t: any) => t.date.startsWith(monthPrefix) && t.type === 'INCOME').reduce((a: any, b: any) => a + b.amount, 0);
      const expense = transactions.filter((t: any) => t.date.startsWith(monthPrefix) && t.type === 'EXPENSE').reduce((a: any, b: any) => a + b.amount, 0);
      months.push({
        name: d.toLocaleString('pt-BR', { month: 'short' }).toUpperCase(),
        income,
        expense
      });
    }
    return months;
  }, [transactions]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-text-main tracking-tighter">Olá, {company.owner.split(' ')[0]}!</h2>
          <p className="text-text-dim font-bold uppercase text-[10px] tracking-widest mt-1">Sua central de controle DR CLIMA</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard label="Lucro Líquido" value={formatCurrency(profit)} theme="blue" icon={<TrendingUp size={20} />} />
        <MetricCard label="Despesas" value={formatCurrency(totalExpense)} theme="rose" icon={<TrendingDown size={20} />} />
        <MetricCard label="Serviços Finalizados" value={finishedServices} theme="indigo" icon={<CheckCircle2 size={20} />} />
        <MetricCard label="Clientes Totais" value={clients.length} theme="emerald" icon={<Users size={20} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-card p-8 rounded-2xl border border-card-border shadow-sm">
          <h3 className="text-sm font-black text-text-dim uppercase tracking-widest mb-6">Desempenho Semestral</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a', fontWeight: 'bold' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a', fontWeight: 'bold' }} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#18181b', borderRadius: '1rem', border: '1px solid #27272a', color: '#fafafa' }}
                />
                <Bar dataKey="income" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={12} name="Entradas" />
                <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={12} name="Saídas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card p-8 rounded-2xl border border-card-border shadow-2xl text-text-main">
          <h3 className="text-xl font-black mb-8 tracking-tight">Atalhos Rápidos</h3>
          <div className="space-y-4">
            <button 
              onClick={() => onNavigate('services')}
              className="group flex items-center gap-4 w-full p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-brand-primary hover:text-bg transition-all font-black uppercase text-xs"
            >
              <span className="w-10 h-10 flex items-center justify-center bg-brand-primary/20 rounded-lg text-brand-primary group-hover:bg-brand-primary group-hover:text-bg">
                <Plus size={20} />
              </span> 
              Novo Agendamento
            </button>
            <button 
              onClick={() => onNavigate('finance')}
              className="group flex items-center gap-4 w-full p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-rose-500 hover:text-white transition-all font-black uppercase text-xs"
            >
              <span className="w-10 h-10 flex items-center justify-center bg-rose-500/20 rounded-lg text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-all">
                <CreditCard size={20} />
              </span> 
              Registrar Despesa
            </button>
            <button 
              onClick={() => onNavigate('clients')}
              className="group flex items-center gap-4 w-full p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-brand-secondary hover:text-white transition-all font-black uppercase text-xs"
            >
              <span className="w-10 h-10 flex items-center justify-center bg-brand-secondary/20 rounded-lg text-brand-secondary group-hover:bg-brand-secondary group-hover:text-white">
                <UserIcon size={20} />
              </span> 
              Gerenciar Clientes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, theme, icon }: any) {
  const themes: any = {
    blue: 'text-brand-primary bg-brand-primary/5 border-brand-primary/20',
    rose: 'text-rose-500 bg-rose-500/5 border-rose-500/20',
    indigo: 'text-brand-secondary bg-brand-secondary/5 border-brand-secondary/20',
    emerald: 'text-emerald-500 bg-emerald-500/5 border-emerald-500/20'
  };
  return (
    <div className={cn("p-6 rounded-2xl border shadow-sm flex flex-col items-center justify-center text-center transition-all hover:scale-105", themes[theme])}>
      <div className="mb-2 opacity-60">{icon}</div>
      <span className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-1">{label}</span>
      <span className="text-2xl font-black">{value}</span>
    </div>
  );
}

function ClientsView({ clients }: any) {
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const handleSaveClient = async (data: any) => {
    try {
      if (editingClient) {
        await updateDoc(doc(db, 'clients', editingClient.id), data);
      } else {
        await addDoc(collection(db, 'clients'), {
          ...data,
          createdAt: serverTimestamp()
        });
      }
      setShowModal(false);
      setEditingClient(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente excluir este cliente?')) {
      await deleteDoc(doc(db, 'clients', id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-3xl font-black text-text-main tracking-tight">Clientes</h2>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-brand-primary text-bg px-6 py-4 rounded-xl font-black shadow-xl hover:opacity-90 active:scale-95 flex items-center gap-2"
        >
          <Plus size={20} /> Novo Cliente
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.length > 0 ? clients.map((c: any) => (
          <div key={c.id} className="bg-card p-6 rounded-2xl border border-card-border shadow-sm hover:border-brand-primary/30 transition-all flex flex-col justify-between group">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-14 h-14 rounded-xl bg-bg border border-card-border flex items-center justify-center text-text-dim font-black text-xl group-hover:text-brand-primary transition-colors">
                  {c.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingClient(c); setShowModal(true); }} className="p-2 text-text-dim hover:text-brand-primary"><Edit size={16} /></button>
                  <button onClick={() => handleDelete(c.id)} className="p-2 text-text-dim hover:text-rose-500"><Trash2 size={16} /></button>
                </div>
              </div>
              <h3 className="font-black text-xl text-text-main leading-tight mb-1">{c.name}</h3>
              <div className="flex gap-2 items-center text-sm text-text-dim mt-2 bg-bg p-2 rounded-xl">
                <span className="text-brand-primary"><Phone size={14} fill="currentColor" /></span> 
                <span className="font-bold">{c.phone}</span>
              </div>
              <p className="text-xs text-text-dim mt-2 px-2 line-clamp-2">{c.address}</p>
            </div>
            <div className="mt-6">
              <button className="w-full bg-bg border border-card-border text-text-main font-black py-4 rounded-xl text-[10px] uppercase tracking-widest hover:bg-card transition-all">
                Ver Histórico
              </button>
            </div>
          </div>
        )) : (
          <p className="col-span-full text-center text-text-dim py-10 italic">Nenhum cliente cadastrado.</p>
        )}
      </div>

      {showModal && (
        <ClientModal 
          client={editingClient} 
          onClose={() => { setShowModal(false); setEditingClient(null); }} 
          onSave={handleSaveClient} 
        />
      )}
    </div>
  );
}

function ClientModal({ client, onClose, onSave }: any) {
  const [formData, setFormData] = useState({
    name: client?.name || '',
    phone: client?.phone || '',
    email: client?.email || '',
    address: client?.address || '',
  });

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-card rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-card-border" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8 bg-sidebar text-text-main border-b border-card-border flex justify-between items-center">
          <h3 className="text-2xl font-black">{client ? 'Editar Cliente' : 'Novo Cliente'}</h3>
          <button onClick={onClose} className="hover:rotate-90 transition-transform"><X size={24} /></button>
        </div>
        <form 
          onSubmit={(e) => { e.preventDefault(); onSave(formData); }} 
          className="p-8 space-y-4"
        >
          <div className="space-y-1">
            <label className="text-[10px] font-black text-text-dim uppercase tracking-widest ml-2">Nome Completo</label>
            <input 
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required 
              className="w-full p-4 bg-bg border border-card-border rounded-xl font-bold text-text-main focus:ring-2 focus:ring-brand-primary/20 outline-none" 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-dim uppercase tracking-widest ml-2">WhatsApp</label>
              <input 
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                required 
                className="w-full p-4 bg-bg border border-card-border rounded-xl font-bold text-text-main focus:ring-2 focus:ring-brand-primary/20 outline-none" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-dim uppercase tracking-widest ml-2">Email</label>
              <input 
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                type="email"
                className="w-full p-4 bg-bg border border-card-border rounded-xl font-bold text-text-main focus:ring-2 focus:ring-brand-primary/20 outline-none" 
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-text-dim uppercase tracking-widest ml-2">Endereço Completo</label>
            <textarea 
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
              required 
              rows={3}
              className="w-full p-4 bg-bg border border-card-border rounded-xl font-bold text-text-main focus:ring-2 focus:ring-brand-primary/20 outline-none resize-none" 
            />
          </div>
          <button type="submit" className="w-full bg-brand-primary text-bg font-black py-4 rounded-xl shadow-xl text-lg mt-4 hover:opacity-90 transition-all">
            Salvar Cliente
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function ServicesView({ services, isAdmin, users }: any) {
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const handleSaveService = async (data: any) => {
    try {
      if (editingService) {
        await updateDoc(doc(db, 'services', editingService.id), {
          ...data,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'services'), {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setShowModal(false);
      setEditingService(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async (service: Service, newStatus: any) => {
    try {
      await updateDoc(doc(db, 'services', service.id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      if (newStatus === 'FINISHED') {
        // Auto-create transaction for income
        await addDoc(collection(db, 'transactions'), {
          description: `Serviço: ${service.clientName}`,
          amount: service.value,
          type: 'INCOME',
          date: new Date().toISOString().split('T')[0],
          serviceId: service.id,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente excluir este agendamento?')) {
      await deleteDoc(doc(db, 'services', id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-3xl font-black text-text-main tracking-tight">
          {isAdmin ? 'Agenda Geral' : 'Meus Serviços'}
        </h2>
        {isAdmin && (
          <button 
            onClick={() => setShowModal(true)}
            className="bg-brand-primary text-bg px-6 py-4 rounded-xl font-black shadow-xl hover:opacity-90 active:scale-95 flex items-center gap-2"
          >
            <Plus size={20} /> Novo Serviço
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.length > 0 ? services.map((s: any) => {
          const status = STATUS_LABELS[s.status as keyof typeof STATUS_LABELS];
          const tech = users.find((u: any) => u.id === s.techId);
          
          return (
            <div key={s.id} className="bg-card rounded-2xl border border-card-border shadow-sm hover:border-brand-primary/30 transition-shadow p-6 relative flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1", status.color)}>
                    <status.icon size={10} /> {status.label}
                  </span>
                  <span className="text-[10px] font-black text-text-dim">{formatDate(s.date)}</span>
                </div>
                <h3 className="font-black text-xl text-text-main leading-tight mb-1">{s.clientName}</h3>
                <p className="text-xs font-bold text-brand-secondary uppercase mb-2">{s.serviceType}</p>
                <p className="text-lg font-black text-brand-primary mb-2">{formatCurrency(s.value)}</p>
                
                {isAdmin && (
                  <div className="mt-4 p-3 bg-bg border border-card-border rounded-xl flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
                      <UserIcon size={12} className="text-text-dim" />
                    </div>
                    <span className="text-[10px] font-black text-text-dim uppercase">
                      {tech ? tech.name : 'Sem Técnico'}
                    </span>
                  </div>
                )}
                
                <p className="text-xs text-text-dim my-4 flex items-center gap-1">
                  <ShieldCheck size={12} /> {s.phone}
                </p>
              </div>

              <div className="space-y-2">
                {s.status !== 'FINISHED' && (
                  <button 
                    onClick={() => handleStatusChange(s, 'FINISHED')}
                    className="w-full bg-brand-primary text-bg font-black py-4 rounded-xl text-[10px] uppercase shadow-lg hover:opacity-90 active:scale-95 transition-all text-center"
                  >
                    Finalizar Serviço
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => { setEditingService(s); setShowModal(true); }}
                    className="flex items-center justify-center gap-2 bg-white/5 text-text-main font-black py-3 rounded-xl text-[10px] uppercase border border-card-border hover:bg-white/10 transition-colors"
                  >
                    <Edit size={14} /> Editar
                  </button>
                  <button 
                    onClick={() => handleDelete(s.id)}
                    className="flex items-center justify-center gap-2 bg-rose-500/5 text-rose-500 font-black py-3 rounded-xl text-[10px] uppercase border border-rose-500/20 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              </div>
            </div>
          );
        }) : (
          <p className="col-span-full text-center text-text-dim py-10 italic">Nenhum agendamento encontrado.</p>
        )}
      </div>

      {showModal && (
        <ServiceModal 
          service={editingService} 
          users={users.filter((u: any) => u.role === 'TECH')}
          onClose={() => { setShowModal(false); setEditingService(null); }} 
          onSave={handleSaveService} 
        />
      )}
    </div>
  );
}

function ServiceModal({ service, onClose, onSave, users }: any) {
  const [formData, setFormData] = useState({
    clientName: service?.clientName || '',
    date: service?.date || new Date().toISOString().split('T')[0],
    serviceType: service?.serviceType || '',
    value: service?.value || 0,
    phone: service?.phone || '',
    techId: service?.techId || '',
    status: service?.status || 'PENDING',
  });

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-card rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-card-border" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8 bg-sidebar text-text-main border-b border-card-border flex justify-between items-center">
          <h3 className="text-2xl font-black">{service ? 'Editar Serviço' : 'Novo Serviço'}</h3>
          <button onClick={onClose} className="hover:rotate-90 transition-transform"><X size={24} /></button>
        </div>
        <form 
          onSubmit={(e) => { e.preventDefault(); onSave(formData); }} 
          className="p-8 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar"
        >
          <div className="bg-brand-primary/10 border border-brand-primary/20 p-4 rounded-xl flex items-center gap-3 mb-4">
            <input 
              type="checkbox" 
              id="isQuote" 
              checked={formData.status === 'QUOTE'}
              onChange={e => setFormData({ ...formData, status: e.target.checked ? 'QUOTE' : 'PENDING' })}
              className="w-5 h-5 accent-brand-primary rounded" 
            />
            <label htmlFor="isQuote" className="text-xs font-black text-brand-primary uppercase">É um Orçamento</label>
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black text-text-dim uppercase tracking-widest ml-2">Nome do Cliente</label>
            <input 
              value={formData.clientName}
              onChange={e => setFormData({ ...formData, clientName: e.target.value })}
              required 
              className="w-full p-4 bg-bg border border-card-border rounded-xl font-bold text-text-main outline-none focus:ring-2 focus:ring-brand-primary/20" 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-dim uppercase tracking-widest ml-2">Data do Serviço</label>
              <input 
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                required 
                className="w-full p-4 bg-bg border border-card-border rounded-xl font-bold text-text-main outline-none focus:ring-2 focus:ring-brand-primary/20" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-dim uppercase tracking-widest ml-2">WhatsApp</label>
              <input 
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                required 
                className="w-full p-4 bg-bg border border-card-border rounded-xl font-bold text-text-main outline-none focus:ring-2 focus:ring-brand-primary/20" 
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black text-text-dim uppercase tracking-widest ml-2">Tipo de Serviço</label>
            <input 
              value={formData.serviceType}
              placeholder="Ex: Instalação de Ar Condicionado"
              onChange={e => setFormData({ ...formData, serviceType: e.target.value })}
              required 
              className="w-full p-4 bg-bg border border-card-border rounded-xl font-bold text-text-main outline-none focus:ring-2 focus:ring-brand-primary/20" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-dim uppercase tracking-widest ml-2">Valor Total</label>
              <input 
                type="number"
                step="0.01"
                value={formData.value}
                onChange={e => setFormData({ ...formData, value: parseFloat(e.target.value) })}
                required 
                className="w-full p-4 bg-bg border border-card-border rounded-xl font-bold text-brand-primary outline-none focus:ring-2 focus:ring-brand-primary/20" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-dim uppercase tracking-widest ml-2">Técnico Responsável</label>
              <select 
                value={formData.techId}
                onChange={e => setFormData({ ...formData, techId: e.target.value })}
                className="w-full p-4 bg-bg border border-card-border rounded-xl font-bold text-text-dim outline-none focus:ring-2 focus:ring-brand-primary/20"
              >
                <option value="">A definir</option>
                {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <button type="submit" className="w-full bg-brand-primary text-bg font-black py-4 rounded-xl shadow-xl text-lg mt-4 hover:opacity-90 transition-all">
            Salvar Agendamento
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function FinanceView({ transactions, company }: any) {
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showModal, setShowModal] = useState(false);

  const filtered = transactions.filter((t: any) => t.date.startsWith(reportMonth));
  const income = filtered.filter((t: any) => t.type === 'INCOME').reduce((a: any, b: any) => a + b.amount, 0);
  const expense = filtered.filter((t: any) => t.type === 'EXPENSE').reduce((a: any, b: any) => a + b.amount, 0);
  const balance = income - expense;

  const handleSaveTransaction = async (data: any) => {
    try {
      await addDoc(collection(db, 'transactions'), {
        ...data,
        createdAt: serverTimestamp()
      });
      setShowModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Excluir lançamento financeiro?')) {
      await deleteDoc(doc(db, 'transactions', id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-3xl font-black text-text-main tracking-tight">Fluxo de Caixa</h2>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-brand-primary text-bg px-6 py-4 rounded-xl font-black shadow-xl hover:opacity-90 active:scale-95 flex items-center gap-2"
        >
          <Plus size={20} /> Lançamento Avulso
        </button>
      </div>

      <div className="bg-card text-text-main p-8 rounded-2xl border border-card-border shadow-xl">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
          <div className="flex-1 w-full space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-text-dim">Filtrar Período</h3>
            <div className="flex flex-wrap items-center gap-4">
              <input 
                type="month" 
                value={reportMonth} 
                onChange={(e) => setReportMonth(e.target.value)}
                className="bg-bg border border-card-border text-text-main font-bold rounded-xl p-4 outline-none focus:ring-4 focus:ring-brand-primary/10" 
              />
              <button 
                onClick={() => window.print()}
                className="bg-white/5 hover:bg-white/10 text-text-main px-6 py-4 rounded-xl font-bold border border-card-border flex items-center gap-2 transition-all active:scale-95 text-xs uppercase tracking-widest"
              >
                <FileText size={18} /> Imprimir Relatório
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-6 md:gap-12 text-right">
            <div>
              <span className="block text-[10px] uppercase text-text-dim font-black tracking-widest mb-1">Entradas</span>
              <span className="text-xl md:text-2xl font-black text-brand-primary">{formatCurrency(income)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase text-text-dim font-black tracking-widest mb-1">Saídas</span>
              <span className="text-xl md:text-2xl font-black text-rose-500">{formatCurrency(expense)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase text-text-dim font-black tracking-widest mb-1">Resultado</span>
              <span className={cn("text-xl md:text-2xl font-black", balance >= 0 ? 'text-brand-secondary' : 'text-rose-500')}>
                {formatCurrency(balance)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-card-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-sidebar text-text-dim text-[10px] font-black uppercase tracking-widest border-b border-card-border">
                <th className="p-6">Data</th>
                <th className="p-6">Descrição</th>
                <th className="p-6 text-right">Valor</th>
                <th className="p-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {filtered.map((t: any) => (
                <tr key={t.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-6 text-xs font-bold text-text-dim">{formatDate(t.date)}</td>
                  <td className="p-6 font-bold text-text-main">{t.description}</td>
                  <td className={cn(
                    "p-6 text-right font-black",
                    t.type === 'INCOME' ? 'text-brand-primary' : 'text-rose-500'
                  )}>
                    {t.type === 'INCOME' ? '+' : '-'} {formatCurrency(t.amount)}
                  </td>
                  <td className="p-6 text-right">
                    <button 
                      onClick={() => handleDelete(t.id)}
                      className="text-text-dim hover:text-rose-500 transition-colors p-2"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-20 text-center text-text-dim italic text-sm">
                    Nenhuma movimentação neste período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <TransactionModal onClose={() => setShowModal(false)} onSave={handleSaveTransaction} />}
    </div>
  );
}

function TransactionModal({ onClose, onSave }: any) {
  const [formData, setFormData] = useState({
    description: '',
    amount: 0,
    type: 'INCOME',
    date: new Date().toISOString().split('T')[0],
  });

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-card rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-card-border" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8 border-b border-card-border flex justify-between items-center bg-sidebar text-text-main">
          <h3 className="text-xl font-black">Novo Lançamento</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form 
          onSubmit={(e) => { e.preventDefault(); onSave(formData); }} 
          className="p-8 space-y-4"
        >
          <div className="space-y-1">
            <label className="text-[10px] font-black text-text-dim uppercase tracking-widest ml-2">Descrição</label>
            <input 
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              required 
              className="w-full p-4 bg-bg border border-card-border rounded-xl font-bold text-text-main outline-none focus:ring-2 focus:ring-brand-primary/20" 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-dim uppercase tracking-widest ml-2">Valor R$</label>
              <input 
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                required 
                className="w-full p-4 bg-bg border border-card-border rounded-xl font-bold text-brand-primary outline-none focus:ring-2 focus:ring-brand-primary/20" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-dim uppercase tracking-widest ml-2">Tipo</label>
              <select 
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                className="w-full p-4 bg-bg border border-card-border rounded-xl font-bold text-text-dim outline-none focus:ring-2 focus:ring-brand-primary/20"
              >
                <option value="INCOME">Receita (+)</option>
                <option value="EXPENSE">Despesa (-)</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-text-dim uppercase tracking-widest ml-2">Data</label>
            <input 
              type="date"
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
              required 
              className="w-full p-4 bg-bg border border-card-border rounded-xl font-bold text-text-main outline-none focus:ring-2 focus:ring-brand-primary/20" 
            />
          </div>
          <button type="submit" className="w-full bg-brand-primary text-bg font-black py-4 rounded-xl shadow-xl text-lg mt-4 hover:opacity-90 transition-all">
            Confirmar Lançamento
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function SettingsView({ company, users }: any) {
  const [companyForm, setCompanyForm] = useState(company);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'TECH' as UserRole });

  const saveCompany = async () => {
    try {
      await setDoc(doc(db, 'settings', 'company'), companyForm);
      alert('Configurações salvas!');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      alert('Para novos colaboradores, adicione seu email no Firebase Authentication e crie seu perfil aqui.');
      await addDoc(collection(db, 'users'), {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        createdAt: serverTimestamp()
      });
      setNewUser({ name: '', email: '', password: '', role: 'TECH' });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteUser = async (id: string) => {
    if (confirm('Remover acesso deste colaborador?')) {
      await deleteDoc(doc(db, 'users', id));
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-black text-text-main tracking-tight">Equipe & Configurações</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-card p-8 rounded-2xl border border-card-border shadow-sm space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
              <Building2 size={22} />
            </div>
            <h3 className="font-black text-xl text-text-main">Dados da Empresa</h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-dim uppercase tracking-widest ml-2">Nome Fantasia</label>
              <input value={companyForm.name} onChange={e => setCompanyForm({...companyForm, name: e.target.value})} className="w-full p-4 bg-bg border border-card-border rounded-xl font-bold text-text-main focus:ring-2 focus:ring-brand-primary/20 outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-dim uppercase tracking-widest ml-2">Responsável</label>
              <input value={companyForm.owner} onChange={e => setCompanyForm({...companyForm, owner: e.target.value})} className="w-full p-4 bg-bg border border-card-border rounded-xl font-bold text-text-main focus:ring-2 focus:ring-brand-primary/20 outline-none" />
            </div>
            <button onClick={saveCompany} className="w-full bg-brand-primary text-bg font-black py-4 rounded-xl shadow-xl hover:opacity-90 transition-all">
              Atualizar Empresa
            </button>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-sidebar text-text-main p-8 rounded-2xl border border-card-border shadow-2xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white">
                <Users size={22} />
              </div>
              <h3 className="font-black text-xl">Gestão de Equipe</h3>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <input 
                value={newUser.name} 
                onChange={e => setNewUser({...newUser, name: e.target.value})}
                placeholder="Nome do Colaborador" 
                required
                className="w-full p-4 bg-white/5 border border-white/10 rounded-xl font-bold text-white placeholder-white/30 focus:ring-2 focus:ring-brand-primary/20 outline-none" 
              />
              <div className="grid grid-cols-2 gap-4">
                <input 
                  value={newUser.email} 
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                  type="email" 
                  placeholder="Email" 
                  required
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-xl font-bold text-white placeholder-white/30 focus:ring-2 focus:ring-brand-primary/20 outline-none" 
                />
                <select 
                  value={newUser.role} 
                  onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-xl font-bold text-white outline-none focus:ring-2 focus:ring-brand-primary/20"
                >
                  <option value="TECH">Técnico</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black py-4 rounded-xl uppercase text-xs tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">
                Vincular Novo Usuário
              </button>
            </form>

            <div className="space-y-3 mt-6">
              <h4 className="text-[10px] uppercase font-black text-text-dim tracking-widest ml-2">Membros Ativos</h4>
              {users.map((u: any) => (
                <div key={u.id} className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5 group">
                  <div>
                    <p className="text-sm font-black">{u.name}</p>
                    <p className="text-[10px] text-text-dim uppercase font-bold">{u.email} • {u.role}</p>
                  </div>
                  {u.email !== auth.currentUser?.email && (
                    <button 
                      onClick={() => deleteUser(u.id)}
                      className="text-text-dim hover:text-rose-400 transition-colors p-2"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
