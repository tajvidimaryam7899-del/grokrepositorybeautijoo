'use client';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { fetchAdminUsers, type AdminUser } from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';

export default function AdminUsersPage() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems((await fetchAdminUsers(1, 50)).items); }
    catch (e) { setError(friendlyApiError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={load} />;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">کاربران</h1>
        <p className="mt-1 text-sm text-gray">لیست از /admin/users</p></div>
      {items.length === 0 ? <PanelEmpty title="کاربری یافت نشد" /> : (
        <ul className="space-y-2">{items.map((u) => (
          <li key={u.id}><Card className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <p className="font-semibold">{u.profile?.displayName || u.phone || u.id}</p>
              <p className="text-xs text-gray" dir="ltr">{u.phone || '—'} · {(u.roles || []).join(', ')}</p>
            </div>
            <span className="rounded-full bg-gray-light px-3 py-1 text-xs">{u.status || '—'}</span>
          </Card></li>
        ))}</ul>
      )}
    </div>
  );
}
