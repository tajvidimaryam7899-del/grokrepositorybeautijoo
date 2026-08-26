'use client';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { fetchAuditLogs, type AuditLogItem } from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';

export default function AdminAuditPage() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems((await fetchAuditLogs(1, 50)).items); }
    catch (e) { setError(friendlyApiError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={load} />;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">لاگ‌های ممیزی</h1>
        <p className="mt-1 text-sm text-gray">از /admin/audit-logs</p></div>
      {items.length === 0 ? <PanelEmpty title="لاگی یافت نشد" /> : (
        <ul className="space-y-2">{items.map((log) => (
          <li key={log.id}><Card className="space-y-1 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-semibold">{log.action || '—'}{log.entity ? ` · ${log.entity}` : ''}</span>
              <span className="text-xs text-gray" dir="ltr">{new Date(log.createdAt).toLocaleString('fa-IR')}</span>
            </div>
            {log.entityId && <p className="text-xs text-gray" dir="ltr">entity: {log.entityId}</p>}
            {log.actorId && <p className="text-xs text-gray" dir="ltr">actor: {log.actorId}</p>}
          </Card></li>
        ))}</ul>
      )}
    </div>
  );
}
