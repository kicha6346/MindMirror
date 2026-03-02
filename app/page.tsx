'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line, ReferenceLine, Label
} from 'recharts';

// ─── Icon components ──────────────────────────────────────
const IconHome = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);
const IconSettings = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconPlugs = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);
const IconLogout = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

// Reusable formatter to turn raw seconds into 1h 15m format
const formatTime = (seconds: number) => {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

// ─── Reusable custom tooltip ────────────────────────────────
const DarkTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 rounded-xl shadow-2xl space-y-2" style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}>
        <p className="text-slate-300 text-xs font-semibold mb-2">{label}</p>
        {payload.map((entry: any, index: number) => {
          let displayValue = entry.value;
          
          // If the key explicitly tracks seconds, run the time formatter
          if (entry.dataKey && entry.dataKey.endsWith('_seconds')) {
            displayValue = formatTime(entry.value);
          } else if (entry.payload && entry.payload.name === entry.name && typeof entry.value === 'number') {
            // Also format the pie chart values which inject raw seconds into value
            if (entry.name !== 'No Activity' && entry.value > 1) { // 1 is the fallback value
              displayValue = formatTime(entry.value);
            }
          }

          return (
            <div key={index} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-400 capitalize">{entry.name}:</span>
              <span className="text-slate-100 font-bold">{displayValue}</span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [insightLoading, setInsightLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isMockAuth, setIsMockAuth] = useState(false);
  const [hasCalendarSynced, setHasCalendarSynced] = useState(false);
  const [blocklist, setBlocklist] = useState<any[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [blocklistLoading, setBlocklistLoading] = useState(false);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'integrations' | 'performance'>('overview');
  
  const [githubUser, setGithubUser] = useState('');
  const [leetcodeUser, setLeetcodeUser] = useState('');
  const [githubLoading, setGithubLoading] = useState(false);
  const [leetcodeLoading, setLeetcodeLoading] = useState(false);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [performanceLoading, setPerformanceLoading] = useState(false);

  // Custom Categories State
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [newCustomDomain, setNewCustomDomain] = useState('');
  const [newCustomChoice, setNewCustomChoice] = useState('work');
  const [customCategoryLoading, setCustomCategoryLoading] = useState(false);

  useEffect(() => {
    // Force wipe any old mock tokens from hackathon fallback
    localStorage.removeItem('sb-mock-auth-token');

    // Handle Calendar Sync Alerts
    if (window.location.search.includes('sync=calendar_success')) {
      alert("✅ Google Calendar synced successfully for the past 7 days!");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (window.location.search.includes('error=calendar')) {
      alert("❌ Failed to sync calendar. Ensure your Google Cloud credentials are set in .env.local!");
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Standard Supabase Auth
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push('/auth');
      } else {
        // Enforce public.users existence
        const { data: dbUser, error } = await supabase
          .from('users')
          .select('id')
          .eq('id', session.user.id)
          .single();
          
        if (!dbUser || error) {
           console.log("No public user found for this auth session. Forcing logout.");
           await supabase.auth.signOut();
           router.push('/auth');
        } else {
           setUser(session.user);
        }
      }
    });
  }, [router]);

  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      try {
        const res = await fetch(`/api/score?userId=${user.id}`);
        const json = await res.json();
        if (json.success) setData(json);

        // Check if calendar data exists
        const { count } = await supabase
          .from('calendar_activity')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        
        if (count && count > 0) {
          setHasCalendarSynced(true);
        }
        
        // Fetch Blocklist
        const blRes = await fetch(`/api/blocklist?userId=${user.id}`);
        const blJson = await blRes.json();
        if (blJson.success && blJson.blocklist) {
          setBlocklist(blJson.blocklist);
        }

        // Fetch Custom Categories
        const ccRes = await fetch(`/api/categories?userId=${user.id}`);
        const ccJson = await ccRes.json();
        if (ccJson.success && ccJson.mappings) {
          setCustomCategories(ccJson.mappings);
        }

        // Fetch User Integrations
        const { data: intData } = await supabase
          .from('user_integrations')
          .select('github_username, leetcode_username')
          .eq('user_id', user.id)
          .single();
          
        if (intData) {
          setGithubUser(intData.github_username || '');
          setLeetcodeUser(intData.leetcode_username || '');
        }
        
        // Fetch AI insight in background
        setInsightLoading(true);
        const insightRes = await fetch('/api/insights', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }) 
        });
        const insightJson = await insightRes.json();
        if (insightJson.insight) setInsight(insightJson.insight);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
        setInsightLoading(false);
      }
    }
    fetchData();
  }, [user]);

  // Continuous background polling for Integrations (runs every 5 minutes if accounts exist)
  useEffect(() => {
    if (!githubUser && !leetcodeUser) return;
    
    // Auto-sync immediately on load if a username exists
    fetch('/api/cron/sync-integrations').catch(e => console.error("Auto-sync failed", e));
    
    const interval = setInterval(() => {
      fetch('/api/cron/sync-integrations').catch(e => console.error("Poll failed", e));
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(interval);
  }, [githubUser, leetcodeUser]);

  // Phase 21: Fetch 30-day Performance History when Performance tab is opened
  useEffect(() => {
    if (activeTab !== 'performance' || !user || performanceData.length > 0) return;
    setPerformanceLoading(true);
    fetch(`/api/performance?userId=${user.id}&days=30`)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.history) {
          setPerformanceData(json.history.map((d: any) => ({
            date: d.date.slice(5), // Display as MM-DD
            score: d.score,
            work: d.work_intensity,
            recovery: d.recovery_deficit,
            distraction: d.distraction_penalty,
            night: d.night_activity,
            sleepDebt: d.sleep_debt_penalty,
            work_seconds: d.work_seconds || 0,
            social_seconds: d.social_seconds || 0,
            entertainment_seconds: d.entertainment_seconds || 0,
            other_seconds: d.other_seconds || 0
          })));
        }
      })
      .catch(e => console.error('Performance fetch failed', e))
      .finally(() => setPerformanceLoading(false));
  }, [activeTab, user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  if (!user || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <span className="text-xl">🧠</span>
            </div>
            <span className="text-xl font-bold text-slate-100">MindMirror</span>
          </div>
          <div className="flex items-center gap-2 justify-center text-slate-400">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm shimmer px-6 py-1 rounded-full">Analyzing behavior patterns...</span>
          </div>
        </div>
      </div>
    );
  }

  const score = data?.current?.score || 0;
  
  // Dynamic Data from the new Scoring Engine Algorithm (Real seconds per category)
  // Ensure we display minutes / hours instead of abstract scores
  const dist = data?.current?.distribution || { work: 0, social: 0, entertainment: 0, other: 0 };
  
  // Only show categories that have > 0 seconds spent to keep chart clean
  const categoryData = [
    { name: 'Work / Learning', value: dist.work, color: '#818cf8' },
    { name: 'Social Media', value: dist.social, color: '#f59e0b' },
    { name: 'Entertainment', value: dist.entertainment, color: '#ef4444' },
    { name: 'Other', value: dist.other, color: '#8b5cf6' }
  ].filter(cat => cat.value > 0);

  // Fallback if no data
  if (categoryData.length === 0) {
    categoryData.push({ name: 'No Activity', value: 1, color: '#334155' });
  }

  // Map the 7-day weekly array correctly to the chart
  const barData = data?.weekly && data.weekly.length > 0 ? [...data.weekly].reverse().map((day: any) => ({
    name: day.date,
    work: day.work,
    distraction: day.distraction,
    recovery: day.recovery,
    night: day.night
  })) : [];

  const getRiskColor = (score: number) => {
    if (score < 40) return '#34d399'; // emerald
    if (score < 75) return '#fbbf24'; // amber
    return '#f87171'; // rose
  };

  const getRiskLabel = (score: number) => {
    if (score < 40) return { text: 'Sustainable pace', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' };
    if (score < 75) return { text: 'Approaching limits', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25' };
    return { text: 'High burnout risk', badge: 'bg-rose-500/15 text-rose-400 border-rose-500/25' };
  };

  const statusText = score < 40 ? 'Sustainable pace' : score < 75 ? 'Approaching limits' : 'High burnout risk';
  const riskInfo = getRiskLabel(score);
  const riskColor = getRiskColor(score);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim() || !user) return;
    setBlocklistLoading(true);
    
    try {
      const res = await fetch('/api/blocklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, domain: newDomain })
      });
      const json = await res.json();
      if (json.success && json.item) {
        setBlocklist([json.item, ...blocklist]);
        setNewDomain('');
      } else {
        alert(json.error || 'Failed to add domain');
      }
    } catch (err) {
      alert('An error occurred');
    } finally {
      setBlocklistLoading(false);
    }
  };

  const handleDeleteDomain = async (id: string) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/blocklist?id=${id}&userId=${user.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setBlocklist(blocklist.filter(b => b.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSyncGithub = async () => {
    if (!githubUser.trim() || !user) return;
    setGithubLoading(true);
    try {
      const res = await fetch('/api/integrations/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, username: githubUser })
      });
      const json = await res.json();
      if (json.success) alert(json.message);
      else alert(json.error || 'Failed to sync GitHub');
    } catch (err) {
      alert('An error occurred while syncing GitHub');
    } finally {
      setGithubLoading(false);
    }
  };

  const handleSyncLeetcode = async () => {
    if (!leetcodeUser.trim() || !user) return;
    setLeetcodeLoading(true);
    try {
      const res = await fetch('/api/integrations/leetcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, username: leetcodeUser })
      });
      const json = await res.json();
      if (json.success) alert(json.message);
      else alert(json.error || 'Failed to sync LeetCode');
    } catch (err) {
      alert('An error occurred while syncing LeetCode');
    } finally {
      setLeetcodeLoading(false);
    }
  };

  const handleAddCustomCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomDomain.trim() || !user) return;
    setCustomCategoryLoading(true);
    
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, domain: newCustomDomain, category: newCustomChoice })
      });
      const json = await res.json();
      if (json.success && json.item) {
        // Replace if exists, else append
        setCustomCategories(prev => {
           const exists = prev.find(p => p.domain === json.item.domain);
           if (exists) return prev.map(p => p.domain === json.item.domain ? json.item : p);
           return [json.item, ...prev];
        });
        setNewCustomDomain('');
      } else {
        alert(json.error || 'Failed to add custom mapping');
      }
    } catch (err) {
      alert('An error occurred');
    } finally {
      setCustomCategoryLoading(false);
    }
  };

  const handleDeleteCustomCategory = async (id: string) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/categories?id=${id}&userId=${user.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setCustomCategories(customCategories.filter(c => c.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: <IconHome /> },
    { id: 'performance', label: 'Performance', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> },
    { id: 'settings', label: 'Settings', icon: <IconSettings /> },
    { id: 'integrations', label: 'Integrations', icon: <IconPlugs /> },
  ] as const;

  return (
    <div className="flex h-screen overflow-hidden">
      
      {/* ── SIDEBAR ──────────────────────────────── */}
      <aside
        className="hidden md:flex w-64 flex-col justify-between flex-shrink-0"
        style={{
          background: 'rgba(8, 12, 20, 0.85)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* Logo */}
        <div>
          <div className="px-6 pt-7 pb-6">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', boxShadow: '0 0 16px rgba(99,102,241,0.4)' }}
              >
                <span className="text-base">🧠</span>
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-100 tracking-tight">MindMirror</h1>
                <p className="text-[10px] text-slate-500 tracking-wide uppercase">Burnout Intelligence</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="px-3 space-y-1">
            {navItems.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                  style={isActive ? {
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.12))',
                    color: '#a5b4fc',
                    borderLeft: '2px solid #6366f1',
                    paddingLeft: '10px',
                    boxShadow: 'inset 0 0 0 1px rgba(99,102,241,0.2)',
                  } : {
                    color: '#64748b',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}
                >
                  <span style={{ color: isActive ? '#818cf8' : 'inherit' }}>{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Score preview pill */}
          <div className="mx-4 mt-6 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Current Risk</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-extrabold" style={{ color: riskColor }}>{score}</span>
              <span className="text-slate-500 text-sm mb-0.5">/ 100</span>
            </div>
            <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${riskInfo.badge}`}>
              {statusText}
            </span>
          </div>
        </div>

        {/* User area */}
        <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              {user.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 transition-all"
            style={{ background: 'transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(248,113,113,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = '#f87171'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}
          >
            <IconLogout /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ──────────────────────────── */}
      <main className="flex-1 overflow-y-auto" style={{ background: 'transparent' }}>
        <div className="p-6 md:p-8 max-w-6xl mx-auto">

          {/* Mobile header */}
          <div className="md:hidden flex items-center justify-between mb-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                <span>🧠</span>
              </div>
              <span className="font-bold text-slate-100">MindMirror</span>
            </div>
            <button onClick={handleLogout} className="text-sm text-rose-400 font-medium">Sign Out</button>
          </div>

          {/* ── SETTINGS TAB ────────────────────── */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl space-y-6 fade-up">
              <div>
                <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Settings</h2>
                <p className="text-slate-500 text-sm mt-1">Manage your focus rules and blocklist</p>
              </div>

              <div className="card">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100">Pomodoro Blocklist</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Sites blocked during focus sessions</p>
                  </div>
                </div>
                <p className="text-sm text-slate-400 mb-5 leading-relaxed">
                  Add websites that distract you (e.g., instagram.com, twitter.com). MindMirror will aggressively block them and kill your focus score if you visit them during Pomodoro mode.
                </p>

                <form onSubmit={handleAddDomain} className="flex gap-2 mb-5">
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="e.g. reddit.com"
                    className="input-dark flex-1"
                  />
                  <button
                    type="submit"
                    disabled={blocklistLoading || !newDomain.trim()}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 whitespace-nowrap"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }}
                  >
                    {blocklistLoading ? 'Adding…' : '+ Add Domain'}
                  </button>
                </form>

                <div className="space-y-2">
                  {blocklist.length === 0 ? (
                    <div className="text-center py-8 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
                      <p className="text-slate-500 text-sm">Blocklist is empty — add a domain above.</p>
                    </div>
                  ) : (
                    blocklist.map(item => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center px-4 py-3 rounded-xl transition-all"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                          <span className="font-mono text-sm text-slate-300">{item.domain}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteDomain(item.id)}
                          className="text-slate-600 hover:text-rose-400 transition-colors p-1 rounded-lg"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Custom Website Categories */}
              <div className="card">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100">Custom Website Categories</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Override default time tracking tags</p>
                  </div>
                </div>
                <p className="text-sm text-slate-400 mb-5 leading-relaxed">
                  Map specific websites to custom categories (Work, Social, Entertainment, Other) to ensure your Focus Distribution pie chart is perfectly accurate.
                </p>

                <div className="p-4 rounded-xl space-y-4 shadow-inner" style={{ background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <form onSubmit={handleAddCustomCategory} className="flex flex-col md:flex-row gap-2">
                    <input
                      type="text"
                      value={newCustomDomain}
                      onChange={(e) => setNewCustomDomain(e.target.value)}
                      placeholder="e.g. reddit.com"
                      className="input-dark flex-1"
                    />
                    <select 
                      value={newCustomChoice}
                      onChange={(e) => setNewCustomChoice(e.target.value)}
                      className="input-dark bg-slate-800 text-slate-200 w-full md:w-auto flex-shrink-0"
                      style={{ width: 'auto' }}
                    >
                      <option value="work" className="text-slate-900 bg-white">Work / Learning</option>
                      <option value="social" className="text-slate-900 bg-white">Social Media</option>
                      <option value="entertainment" className="text-slate-900 bg-white">Entertainment</option>
                      <option value="other" className="text-slate-900 bg-white">Other</option>
                    </select>
                    <button
                      type="submit"
                      disabled={customCategoryLoading || !newCustomDomain.trim()}
                      className="px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 whitespace-nowrap flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 12px rgba(245,158,11,0.25)' }}
                    >
                      {customCategoryLoading ? 'Saving…' : '+ Add Mapping'}
                    </button>
                  </form>

                  <div className="space-y-2 mt-4 pt-2 border-t border-slate-700/50">
                    {customCategories.length === 0 ? (
                      <div className="text-center py-6 rounded-xl text-slate-500 text-sm">
                        No custom categories set. Defaults will be used.
                      </div>
                    ) : (
                      customCategories.map(item => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center px-4 py-3 rounded-xl transition-all"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          <div className="flex items-center gap-4">
                            <span className="font-mono text-sm font-semibold text-slate-200 w-32 truncate">{item.domain}</span>
                            <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              {item.category}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteCustomCategory(item.id)}
                            className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                            title="Remove"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ── INTEGRATIONS TAB ────────────────── */}
          {activeTab === 'integrations' && (
            <div className="max-w-2xl space-y-6 fade-up">
              <div>
                <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Integrations</h2>
                <p className="text-slate-500 text-sm mt-1">Connect your tools for smarter burnout analysis</p>
              </div>

              {/* Google Calendar */}
              <div className="card">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(66,133,244,0.15)', border: '1px solid rgba(66,133,244,0.2)' }}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#4285F4">
                      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-100 mb-1">Google Calendar</h3>
                    <p className="text-sm text-slate-400 leading-relaxed mb-4">
                      Connect to automatically pull meeting schedules and detect deep work hours vs weekend overtime.
                    </p>
                    {hasCalendarSynced ? (
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', borderColor: 'rgba(52,211,153,0.25)' }}>
                          <span className="relative flex w-2 h-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-flex"></span>
                          </span>
                          Connected
                        </div>
                        <button
                          onClick={() => { window.location.href = `/api/calendar/auth?userId=${user.id}`; }}
                          className="px-4 py-1.5 rounded-lg text-sm font-semibold text-slate-300 transition-all"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                          Resync Latest Events
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { window.location.href = `/api/calendar/auth?userId=${user.id}`; }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
                        style={{ background: 'linear-gradient(135deg, #4285F4, #1a73e8)', boxShadow: '0 4px 12px rgba(66,133,244,0.35)' }}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z" />
                        </svg>
                        Connect Google Calendar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Developer Integrations */}
              <div className="card">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100">Developer Integrations</h3>
                    <p className="text-xs text-slate-500 mt-0.5">GitHub & LeetCode activity tracking</p>
                  </div>
                </div>
                <p className="text-sm text-slate-400 mb-5 leading-relaxed">
                  Connect your public GitHub and LeetCode profiles to track off-hours coding activity and factor it into your Burnout Risk score.
                </p>

                <div className="space-y-3">
                  {/* GitHub */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">GitHub</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={githubUser}
                        onChange={(e) => setGithubUser(e.target.value)}
                        placeholder="GitHub Username"
                        className="input-dark flex-1"
                      />
                      <button
                        onClick={handleSyncGithub}
                        disabled={githubLoading || !githubUser.trim()}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 whitespace-nowrap"
                        style={{ background: '#24292e', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        {githubLoading ? 'Syncing…' : '⬡ Sync GitHub'}
                      </button>
                    </div>
                  </div>

                  {/* LeetCode */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">LeetCode</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={leetcodeUser}
                        onChange={(e) => setLeetcodeUser(e.target.value)}
                        placeholder="LeetCode Username"
                        className="input-dark flex-1"
                      />
                      <button
                        onClick={handleSyncLeetcode}
                        disabled={leetcodeLoading || !leetcodeUser.trim()}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 whitespace-nowrap"
                        style={{ background: 'linear-gradient(135deg, #f89f1b, #e38e00)' }}
                      >
                        {leetcodeLoading ? 'Syncing…' : '⚡ Sync LeetCode'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── OVERVIEW TAB ─────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="fade-up">
                <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Dashboard</h2>
                <p className="text-slate-500 text-sm mt-1">Real-time burnout analysis</p>
              </div>

              {/* Row 1: Risk Gauge + Pie Chart */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 fade-up fade-up-1">
                
                {/* Risk Gauge */}
                <div className="card flex flex-col items-center justify-center min-h-72 relative overflow-hidden">
                  {/* Ambient glow */}
                  <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 60%, ${riskColor}14 0%, transparent 70%)` }} />
                  
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-5">Burnout Risk</p>

                  {/* SVG ring */}
                  <div className="relative w-44 h-44">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      {/* Track */}
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="2.8"
                      />
                      {/* Fill */}
                      <path
                        className="score-ring"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={riskColor}
                        strokeWidth="2.8"
                        strokeDasharray={`${score}, 100`}
                        strokeLinecap="round"
                        style={{ filter: `drop-shadow(0 0 6px ${riskColor}80)` }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-extrabold tabular-nums" style={{ color: riskColor }}>{score}</span>
                      <span className="text-xs text-slate-600 mt-0.5">/ 100</span>
                    </div>
                  </div>

                  <span className={`mt-4 px-3 py-1 rounded-full text-xs font-bold border ${riskInfo.badge}`}>
                    {statusText}
                  </span>
                </div>

                {/* Focus Distribution Pie */}
                <div className="card col-span-1 md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Focus Distribution</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          innerRadius={62}
                          outerRadius={92}
                          paddingAngle={4}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} style={{ filter: `drop-shadow(0 0 4px ${entry.color}60)` }} />
                          ))}
                        </Pie>
                        <Tooltip content={<DarkTooltip />} />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Row 2: Bar chart + AI Insight */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 fade-up fade-up-2">

                {/* 7-Day Chart */}
                <div className="card">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">7-Day Burnout Factors</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11 }} />
                        <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          formatter={(value) => <span style={{ color: '#64748b', fontSize: 11 }}>{value}</span>}
                        />
                        <Bar dataKey="work" stackId="a" fill="#818cf8" radius={[0, 0, 3, 3]} />
                        <Bar dataKey="distraction" stackId="a" fill="#f59e0b" />
                        <Bar dataKey="recovery" stackId="a" fill="#ef4444" />
                        <Bar dataKey="night" stackId="a" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* AI Insight */}
                <div className="card flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Mirror Mode — AI Insight</p>
                  </div>

                  <div className="flex-1 flex flex-col justify-center items-center text-center p-4 rounded-xl min-h-52" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)' }}>
                    {insightLoading ? (
                      <div className="space-y-2 w-full">
                        <div className="h-3 shimmer rounded-full mx-auto w-4/5" />
                        <div className="h-3 shimmer rounded-full mx-auto w-3/5" />
                        <div className="h-3 shimmer rounded-full mx-auto w-4/5" />
                        <div className="h-3 shimmer rounded-full mx-auto w-2/5" />
                      </div>
                    ) : (
                      <>
                        <div className="text-3xl mb-3">
                          {score < 40 ? '🌿' : score < 75 ? '⚡' : '🔥'}
                        </div>
                        <p className="text-slate-300 text-sm font-medium leading-relaxed">
                          {insight || (score < 40
                            ? "You've maintained a great balance. Your consistent recovery periods are protecting your productivity during focus blocks."
                            : score < 75
                            ? "You've been in high-intensity mode for a few days. Consider adding an isolation-free evening to keep resilience high."
                            : "Warning: Your late-night work intensely correlates with recovery deficits. Rest is productive right now."
                          )}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Interventions */}
              {data?.current?.actions && (
                <div className="card fade-up fade-up-3">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
                      <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">MindMirror Interventions</p>
                  </div>

                  <div className="space-y-2">
                    {data.current.actions.length === 0 ? (
                      <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.15)' }}>
                        <span className="text-emerald-400">✅</span>
                        <p className="text-sm text-emerald-400 font-medium">No active interventions. Your schedule looks healthy.</p>
                      </div>
                    ) : (
                      data.current.actions.map((action: string, idx: number) => {
                        const isPositive = action.includes('🟢');
                        return (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-4 rounded-xl"
                            style={{
                              background: isPositive ? 'rgba(52,211,153,0.06)' : 'rgba(248,113,113,0.06)',
                              border: `1px solid ${isPositive ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)'}`,
                            }}
                          >
                            <p className={`text-sm font-semibold leading-relaxed ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {action}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── PERFORMANCE TAB ──────────────────────────── */}
        {activeTab === 'performance' && (
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-6xl mx-auto space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-100 mb-1">30-Day Performance</h2>
                <p className="text-sm text-slate-500">Your historical Burnout Risk Score over the last 30 days, saved daily.</p>
              </div>

              {performanceLoading ? (
                <div className="text-center py-20 text-slate-500 animate-pulse">Loading performance history...</div>
              ) : performanceData.length === 0 ? (
                <div className="text-center py-20 text-slate-500">No historical data yet. Visit the dashboard daily to build your trendline!</div>
              ) : (
                <>
                  {/* Summary Stats */}
                  {(() => {
                    const scores = performanceData.map(d => d.score);
                    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                    const peak = Math.max(...scores);
                    const latest = scores[scores.length - 1];
                    const trend = latest > avg ? '📈 Worsening' : '📉 Improving';
                    const trendColor = latest > avg ? 'text-rose-400' : 'text-emerald-400';

                    return (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: 'Average Score', value: `${avg}/100`, color: 'text-indigo-400' },
                          { label: 'Peak Score', value: `${peak}/100`, color: 'text-rose-400' },
                          { label: 'Latest Score', value: `${latest}/100`, color: 'text-amber-400' },
                          { label: 'Trend', value: trend, color: trendColor },
                        ].map(stat => (
                          <div key={stat.label} className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{stat.label}</p>
                            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* 30-Day Burnout LineChart */}
                  <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">Burnout Score Trendline</h3>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={performanceData} margin={{ top: 10, right: 10, left: -20, bottom: 15 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#64748b', fontSize: 11, dy: 10 }} 
                            interval="preserveStartEnd"
                            tickFormatter={(val) => {
                              if (!val) return '';
                              const parts = val.split('-');
                              if (parts.length !== 3) return val;
                              return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            }}
                          >
                            <Label value="Recording Date (Last 30 Days)" offset={-15} position="insideBottom" fill="#94a3b8" fontSize={11} fontWeight="600" />
                          </XAxis>
                          <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                          <Tooltip content={<DarkTooltip />} />
                          <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'High Risk', fill: '#ef4444', fontSize: 11 }} />
                          <ReferenceLine y={40} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Safe Zone', fill: '#10b981', fontSize: 11 }} />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="url(#scoreGradient)"
                            strokeWidth={2.5}
                            dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }}
                            activeDot={{ r: 6, fill: '#818cf8' }}
                            name="Burnout Score"
                          />
                          <defs>
                            <linearGradient id="scoreGradient" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#6366f1" />
                              <stop offset="100%" stopColor="#ec4899" />
                            </linearGradient>
                          </defs>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Factor Breakdown BarChart */}
                  <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">Daily Factor Breakdown</h3>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={performanceData} margin={{ top: 5, right: 10, left: -20, bottom: 15 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#64748b', fontSize: 11, dy: 10 }} 
                            interval="preserveStartEnd"
                            tickFormatter={(val) => {
                              if (!val) return '';
                              const parts = val.split('-');
                              if (parts.length !== 3) return val;
                              return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            }}
                          >
                            <Label value="Recording Date (Last 30 Days)" offset={-15} position="insideBottom" fill="#94a3b8" fontSize={11} fontWeight="600" />
                          </XAxis>
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                          <Tooltip content={<DarkTooltip />} />
                          <Legend wrapperStyle={{ paddingTop: '10px' }} />
                          <Bar dataKey="work" stackId="a" name="Work" fill="#818cf8" radius={[0, 0, 4, 4]} />
                          <Bar dataKey="distraction" stackId="a" name="Distraction" fill="#f59e0b" />
                          <Bar dataKey="recovery" stackId="a" name="Recovery Deficit" fill="#ef4444" />
                          <Bar dataKey="night" stackId="a" name="Night Activity" fill="#8b5cf6" />
                          <Bar dataKey="sleepDebt" stackId="a" name="Sleep Debt" fill="#ec4899" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* 30-Day Categories Breakdown Chart */}
                  <div className="rounded-2xl p-6 fade-up fade-up-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/20 border border-emerald-500/30">
                        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">30-Day Focus Distribution</h3>
                        <p className="text-xs text-slate-600 mt-0.5">Raw time spent per category</p>
                      </div>
                    </div>
                    
                    <div className="h-72 mt-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={performanceData} margin={{ top: 5, right: 10, left: -20, bottom: 15 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#64748b', fontSize: 11, dy: 10 }} 
                            interval="preserveStartEnd"
                            tickFormatter={(val) => {
                              if (!val) return '';
                              const parts = val.split('-');
                              if (parts.length !== 3) return val;
                              return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            }}
                          >
                            <Label value="Recording Date (Last 30 Days)" offset={-15} position="insideBottom" fill="#94a3b8" fontSize={11} fontWeight="600" />
                          </XAxis>
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            tickFormatter={(sec) => {
                              if (sec === 0) return '0h';
                              const h = Math.floor(sec / 3600);
                              return `${h}h`;
                            }}
                          />
                          <Tooltip content={<DarkTooltip />} />
                          <Legend wrapperStyle={{ paddingTop: '10px' }} />
                          <Bar dataKey="work_seconds" stackId="b" name="Work / Learning" fill="#818cf8" radius={[0, 0, 4, 4]} />
                          <Bar dataKey="social_seconds" stackId="b" name="Social Media" fill="#ec4899" />
                          <Bar dataKey="entertainment_seconds" stackId="b" name="Entertainment" fill="#10b981" />
                          <Bar dataKey="other_seconds" stackId="b" name="Other" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
