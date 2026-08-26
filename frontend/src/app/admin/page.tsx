'use client';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
import { fetchAdminStats, type AdminStats } from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let c = false;
    (async () => {
      try { const s = await fetchAdminStats(); if (!c) setStats(s); }
      catch (e) { if (!c) setError(friendlyApiError(e)); }
      finally { if (!c) setLoading(false); }
    })();
    return () => { c = true; };
  }, []);
  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} />;
  const entries = stats ? Object.entries(stats).filter(([, v]) => typeof v === 'number' || typeof v === 'string') : [];
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">پنل ادمین</h1>
        <p className="mt-1 text-sm text-gray">آمار کلی پلتفرم از /admin/stats</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(([key, value]) => (
          <Card key={key} className="space-y-1">
            <p className="text-xs text-gray">{key}</p>
            <p className="text-2xl font-bold text-coral">{String(value)}</p>
          </Card>
        ))}
        {entries.length === 0 && <Card><p className="text-sm text-gray">داده‌ای برنگشت</p></Card>}
      </div>
    </div>
  );
}
