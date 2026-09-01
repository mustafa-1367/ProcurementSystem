import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DashboardChartsProps {
  tenders: any[];
  bids: any[];
  contracts: any[];
  blockchainRecords: any[];
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];

export function DashboardCharts({ tenders, bids, contracts, blockchainRecords }: DashboardChartsProps) {
  // Tender status distribution
  const statusCounts: Record<string, number> = {};
  tenders.forEach(t => {
    const s = t.status || 'unknown';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Category budget breakdown
  const categoryBudget: Record<string, number> = {};
  tenders.forEach(t => {
    const cat = t.category || 'Other';
    const b = Number(String(t.budget).replace(/,/g, ''));
    categoryBudget[cat] = (categoryBudget[cat] || 0) + (isNaN(b) ? 0 : b);
  });
  const budgetData = Object.entries(categoryBudget)
    .map(([name, budget]) => ({ name, budget: Math.round(budget / 1000) }))
    .sort((a, b) => b.budget - a.budget);

  // Blockchain activity over time (last 7 days)
  const now = Date.now();
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    days.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
  }
  const activityData = days.map((day, i) => {
    const dayStart = now - (6 - i) * 86400000;
    const dayEnd = dayStart + 86400000;
    const count = blockchainRecords.filter(r => {
      const t = new Date(r.timestamp).getTime();
      return t >= dayStart && t < dayEnd;
    }).length;
    return { day, records: count };
  });

  // Bids per tender
  const bidsPerTender: Record<string, number> = {};
  bids.forEach(b => {
    const tid = b.tenderId || 'unknown';
    bidsPerTender[tid] = (bidsPerTender[tid] || 0) + 1;
  });
  const bidsData = tenders.slice(0, 6).map(t => ({
    name: (t.title || t.id || '').substring(0, 15),
    bids: bidsPerTender[t.id] || 0,
  }));

  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 14, border: '1px solid rgba(11,11,11,0.08)',
    padding: '20px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };
  const titleStyle: React.CSSProperties = {
    margin: '0 0 16px', fontWeight: 700, fontSize: 16, color: '#0b0b0b', letterSpacing: '-0.01em',
  };

  if (tenders.length === 0) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
      {/* Tender Status Pie */}
      <div style={cardStyle}>
        <h3 style={titleStyle}>Tender Status</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
              {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Budget by Category Bar */}
      <div style={cardStyle}>
        <h3 style={titleStyle}>Budget by Category (K AFN)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={budgetData} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0efec" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
            <Tooltip formatter={(v: number) => `${v.toLocaleString()}K AFN`} />
            <Bar dataKey="budget" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Blockchain Activity Line */}
      <div style={cardStyle}>
        <h3 style={titleStyle}>Blockchain Activity (7 days)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={activityData} margin={{ left: 0, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0efec" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="records" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bids Per Tender Bar */}
      <div style={cardStyle}>
        <h3 style={titleStyle}>Bids per Tender</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={bidsData} margin={{ left: 0, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0efec" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="bids" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
