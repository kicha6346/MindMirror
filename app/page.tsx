'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [insightLoading, setInsightLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isMockAuth, setIsMockAuth] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function initUser() {
      // Standard Supabase Auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
      } else {
        setUser(session.user);
      }
    }
    initUser();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      try {
        const res = await fetch(`/api/score?userId=${user.id}`);
        const json = await res.json();
        if (json.success) setData(json);
        
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  if (!user || loading) {
    return <div className="text-center py-20 text-slate-500 animate-pulse">Analyzing behavior patterns...</div>;
  }

  const score = data?.current?.score || 0;
  
  // Basic mock data if no db records yet to show UI layout
  const categoryData = [
    { name: 'Work', value: Math.max(data?.current?.workIntensity || 40, 10), color: '#818cf8' },
    { name: 'Learning', value: 20, color: '#a78bfa' },
    { name: 'Social', value: Math.max(data?.current?.socialIsolation || 15, 5), color: '#f472b6' },
    { name: 'Entertainment', value: data?.current?.recoveryDeficit ? 100 - data.current.recoveryDeficit : 25, color: '#34d399' }
  ];

  const barData = [
    { name: 'Mon', work: 6, recovery: 2 },
    { name: 'Tue', work: 7, recovery: 1.5 },
    { name: 'Wed', work: 8, recovery: 1 },
    { name: 'Thu', work: 7.5, recovery: 2 },
    { name: 'Fri', work: 6, recovery: 3 },
    { name: 'Sat', work: 2, recovery: 6 },
    { name: 'Sun', work: 1, recovery: 7 },
  ];

  const getRiskColor = (score: number) => {
    if (score < 40) return 'text-emerald-500';
    if (score < 75) return 'text-amber-500';
    return 'text-rose-500';
  };

  const statusText = score < 40 ? 'Sustainable pace' : score < 75 ? 'Approaching limits' : 'High burnout risk';

  return (
    <div className="space-y-6">
      
      {/* Top row: Gauge & Insight */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Risk Gauge */}
        <div className="card flex flex-col items-center justify-center relative">
          <button 
            onClick={handleLogout} 
            className="absolute top-4 right-4 text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors"
          >
            Logout
          </button>
          <h2 className="text-slate-500 text-sm font-medium mb-4 uppercase tracking-wider">Burnout Risk</h2>
          <div className="relative w-40 h-40 flex items-center justify-center">
            <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
              <path
                className="text-slate-100"
                strokeWidth="3"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={`${score < 40 ? 'text-emerald-400' : score < 75 ? 'text-amber-400' : 'text-rose-400'} transition-all duration-1000 ease-out`}
                strokeWidth="3"
                strokeDasharray={`${score}, 100`}
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-bold ${getRiskColor(score)}`}>{score}</span>
              <span className="text-xs text-slate-400">/ 100</span>
            </div>
          </div>
          <p className="mt-4 text-sm font-medium text-slate-600">{statusText}</p>
        </div>

        {/* Categories Pie */}
        <div className="card col-span-1 md:col-span-2">
           <h2 className="text-slate-500 text-sm font-medium mb-4 uppercase tracking-wider">Focus Distribution</h2>
           <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={categoryData}
                   innerRadius={60}
                   outerRadius={90}
                   paddingAngle={5}
                   dataKey="value"
                 >
                   {categoryData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={entry.color} />
                   ))}
                 </Pie>
                 <Tooltip 
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                 />
                 <Legend verticalAlign="bottom" height={36}/>
               </PieChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* Bottom row: Bar charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-slate-500 text-sm font-medium mb-4 uppercase tracking-wider">Work vs Recovery (Hours)</h2>
          <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none' }}/>
                <Legend />
                <Bar dataKey="work" stackId="a" fill="#818cf8" radius={[0, 0, 4, 4]} />
                <Bar dataKey="recovery" stackId="a" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="text-slate-500 text-sm font-medium mb-4 uppercase tracking-wider">Mirror Mode Insights</h2>
          <div className="h-64 flex flex-col justify-center items-center text-center p-6 bg-slate-50 rounded-xl border border-slate-100">
             {insightLoading ? (
               <p className="text-slate-500 animate-pulse font-medium">Generating personalized insight...</p>
             ) : (
               <p className="text-slate-700 mb-4 font-medium leading-relaxed max-w-sm">
                 {insight || (score < 40 
                   ? "You've maintained a great balance. Your consistent recovery periods are protecting your productivity during focus blocks."
                   : score < 75 
                   ? "You've been in high-intensity mode for a few days. Consider adding an isolation-free evening to keep resilience high."
                   : "Warning: Your late-night work intensely correlates with recovery deficits. Rest is productive right now."
                 )}
               </p>
             )}
          </div>
        </div>
      </div>

    </div>
  );
}
