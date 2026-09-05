'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import {
  fetchAdminFinancialSummary,
  fetchAdminFinancialTransactions,
  fetchAdminFinancialTransactionDetail,
  fetchAdminCommissionSetting,
  updateAdminCommissionSetting,
  type AdminFinancialSummary,
  type AdminFinancialTransaction,
  type AdminFinancialTransactionDetail,
  type AdminCommissionSetting,
  type AdminFinancialPeriod,
} from '@/lib/panel-api';
import { persianPaymentStatus } from '@/lib/persian-status';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice } from '@/lib/utils';

export default function AdminFinancePage() {
  // Periods
  const [period, setPeriod] = useState<AdminFinancialPeriod>('all_time');
  const [summary, setSummary] = useState<AdminFinancialSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Transactions list & filters
  const [transactions, setTransactions] = useState<AdminFinancialTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [providerFilter, setProviderFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);

  // Transaction Detail Modal / Drawer
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [selectedTxDetail, setSelectedTxDetail] = useState<AdminFinancialTransactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Commission Settings
  const [commissionSetting, setCommissionSetting] = useState<AdminCommissionSetting | null>(null);
  const [newRateInput, setNewRateInput] = useState<string>('10');
  const [settingSaving, setSettingSaving] = useState(false);
  const [settingMsg, setSettingMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load summary
  const loadSummary = useCallback(async (p: AdminFinancialPeriod) => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await fetchAdminFinancialSummary(p);
      setSummary(data);
    } catch (e) {
      setSummaryError(friendlyApiError(e));
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Load transactions
  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    setTxError(null);
    try {
      const data = await fetchAdminFinancialTransactions({
        page,
        limit: 15,
        status: statusFilter || undefined,
        provider: providerFilter || undefined,
        search: searchQuery.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortBy,
        sortOrder,
      });
      setTransactions(data.items);
      setTotalPages(data.meta.totalPages || 1);
      setTotalCount(data.meta.total || 0);
    } catch (e) {
      setTxError(friendlyApiError(e));
    } finally {
      setTxLoading(false);
    }
  }, [page, statusFilter, providerFilter, searchQuery, startDate, endDate, sortBy, sortOrder]);

  // Load commission setting
  const loadCommissionSetting = useCallback(async () => {
    try {
      const res = await fetchAdminCommissionSetting();
      setCommissionSetting(res);
      setNewRateInput(String(res.rate));
    } catch (e) {
      // Non-blocking fallback
      console.warn('Could not load commission setting:', e);
    }
  }, []);

  useEffect(() => {
    loadSummary(period);
  }, [period, loadSummary]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    loadCommissionSetting();
  }, [loadCommissionSetting]);

  // View detail
  const handleOpenDetail = async (id: string) => {
    setSelectedTxId(id);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await fetchAdminFinancialTransactionDetail(id);
      setSelectedTxDetail(detail);
    } catch (e) {
      setDetailError(friendlyApiError(e));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedTxId(null);
    setSelectedTxDetail(null);
  };

  // Update commission rate
  const handleSaveCommissionRate = async () => {
    const rateNum = parseFloat(newRateInput);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      setSettingMsg({ type: 'error', text: 'لطفاً درصد معتبری بین ۰ تا ۱۰۰ وارد نمایید.' });
      return;
    }
    setSettingSaving(true);
    setSettingMsg(null);
    try {
      const res = await updateAdminCommissionSetting(rateNum);
      setCommissionSetting((prev) =>
        prev
          ? { ...prev, rate: res.rate, updatedAt: res.updatedAt }
          : { key: 'platform_commission_rate', rate: res.rate, defaultRate: 10, updatedAt: res.updatedAt, notice: res.notice },
      );
      setSettingMsg({ type: 'success', text: `نرخ کارمزد با موفقیت به ${res.rate}٪ تغییر یافت و در لاگ سیستم ثبت گردید.` });
      // Reload summary to reflect future
      loadSummary(period);
    } catch (e) {
      setSettingMsg({ type: 'error', text: friendlyApiError(e) });
    } finally {
      setSettingSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">موفق و تسویه‌شده</span>;
      case 'processing':
        return <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">در حال پردازش</span>;
      case 'failed':
        return <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">ناموفق</span>;
      case 'refunded':
        return <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">مسترد شده</span>;
      case 'cancelled':
        return <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">لغو شده</span>;
      default:
        return <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">{persianPaymentStatus(status)}</span>;
    }
  };

  return (
    <div id="admin-finance-container" className="space-y-8 pb-12">
      {/* Header & Notice */}
      <div className="flex flex-col justify-between gap-4 border-b border-gray-100 pb-5 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-dark">مدیریت مالی و گزارشات درآمدی</h1>
          <p className="mt-1 text-sm text-gray">
            محاسبه دقیق جریان نقدینگی، کارمزد پلتفرم، سهم زیباگران و گزارش شفاف تراکنش‌ها
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-600"></span>
            درگاه پرداخت: تستی (Mock Provider)
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 ring-1 ring-inset ring-blue-600/20">
            استرداد وجه: در دست توسعه
          </span>
        </div>
      </div>

      {/* Period Selector & Financial KPI Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-dark">شاخص‌های مالی عملکرد</h2>
          <div className="flex rounded-lg bg-gray-100 p-1 text-xs">
            <button
              id="btn-period-today"
              onClick={() => setPeriod('today')}
              className={`rounded-md px-3 py-1.5 font-medium transition-all ${
                period === 'today' ? 'bg-white text-dark shadow-sm' : 'text-gray hover:text-dark'
              }`}
            >
              امروز
            </button>
            <button
              id="btn-period-month"
              onClick={() => setPeriod('this_month')}
              className={`rounded-md px-3 py-1.5 font-medium transition-all ${
                period === 'this_month' ? 'bg-white text-dark shadow-sm' : 'text-gray hover:text-dark'
              }`}
            >
              این ماه
            </button>
            <button
              id="btn-period-all"
              onClick={() => setPeriod('all_time')}
              className={`rounded-md px-3 py-1.5 font-medium transition-all ${
                period === 'all_time' ? 'bg-white text-dark shadow-sm' : 'text-gray hover:text-dark'
              }`}
            >
              کل دوره
            </button>
          </div>
        </div>

        {summaryLoading ? (
          <PanelLoading />
        ) : summaryError ? (
          <PanelError message={summaryError} onRetry={() => loadSummary(period)} />
        ) : summary ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="flex flex-col justify-between p-5">
              <span className="text-xs font-medium text-gray">گردش مالی ناخالص (Gross Revenue)</span>
              <div className="my-2 text-2xl font-bold text-dark">{formatPrice(summary.grossRevenue)}</div>
              <div className="text-xs text-gray">مجموع مبالغ پرداخت‌های موفق</div>
            </Card>

            <Card className="flex flex-col justify-between p-5 border-emerald-100 bg-emerald-50/20">
              <span className="text-xs font-medium text-emerald-800">درآمد خالص پلتفرم (Platform Commission)</span>
              <div className="my-2 text-2xl font-bold text-emerald-700">{formatPrice(summary.platformCommission)}</div>
              <div className="text-xs text-emerald-600">سهم دریافتی سیستم از تراکنش‌ها</div>
            </Card>

            <Card className="flex flex-col justify-between p-5 border-blue-100 bg-blue-50/20">
              <span className="text-xs font-medium text-blue-800">سهم ناخالص زیباگران (Professional Net)</span>
              <div className="my-2 text-2xl font-bold text-blue-700">{formatPrice(summary.professionalNet)}</div>
              <div className="text-xs text-blue-600">قابل تسویه با سالن‌ها و متخصصین</div>
            </Card>

            <Card className="flex flex-col justify-between p-5">
              <span className="text-xs font-medium text-gray">تعداد تراکنش‌های موفق</span>
              <div className="my-2 text-2xl font-bold text-dark">{summary.transactions.paid.toLocaleString('fa-IR')}</div>
              <div className="flex gap-2 text-xs text-gray">
                <span>ناموفق: {summary.transactions.failed.toLocaleString('fa-IR')}</span>
                <span>•</span>
                <span>در انتظار: {summary.transactions.pending.toLocaleString('fa-IR')}</span>
              </div>
            </Card>
          </div>
        ) : null}
      </div>

      {/* Commission Configuration Section */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-dark">تنظیم نرخ کارمزد پیش‌فرض پلتفرم</h3>
            <p className="mt-1 text-xs text-gray">
              درصد کارمزد پلتفرم از هر تراکنش موفق. با تغییر این نرخ، محاسبات تراکنش‌های آینده طبق درصد جدید انجام شده و
              تراکنش‌های قبلی با نرخ ثبت‌شده در زمان پرداخت (Snapshot) محفوظ می‌مانند.
            </p>
            {commissionSetting?.updatedAt && (
              <p className="mt-1 text-[11px] text-gray">
                آخرین تغییر: {new Date(commissionSetting.updatedAt).toLocaleString('fa-IR')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Input
                id="input-commission-rate"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={newRateInput}
                onChange={(e) => setNewRateInput(e.target.value)}
                className="w-24 text-center font-bold"
              />
              <span className="text-sm font-medium text-gray">درصد (٪)</span>
            </div>
            <Button
              id="btn-save-commission"
              onClick={handleSaveCommissionRate}
              disabled={settingSaving}
              className="bg-coral text-white hover:bg-coral/90"
            >
              {settingSaving ? 'در حال ذخیره...' : 'به‌روزرسانی کارمزد'}
            </Button>
          </div>
        </div>
        {settingMsg && (
          <div
            className={`mt-4 rounded-md p-3 text-xs ${
              settingMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
            }`}
          >
            {settingMsg.text}
          </div>
        )}
      </Card>

      {/* Transactions Table & Filters */}
      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-base font-semibold text-dark">فهرست تراکنش‌های پرداخت</h2>
            <p className="text-xs text-gray">مجموع {totalCount.toLocaleString('fa-IR')} تراکنش ثبت شده</p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <Card className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 md:grid-cols-5 text-xs">
          <div>
            <label className="mb-1 block font-medium text-gray">وضعیت تراکنش</label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-gray-200 bg-white p-2 text-xs focus:border-coral focus:outline-none"
            >
              <option value="">همه وضعیت‌ها</option>
              <option value="paid">موفق (paid)</option>
              <option value="pending">در انتظار (pending)</option>
              <option value="processing">در حال پردازش (processing)</option>
              <option value="failed">ناموفق (failed)</option>
              <option value="refunded">مسترد شده (refunded)</option>
              <option value="cancelled">لغو شده (cancelled)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-medium text-gray">درگاه پرداخت</label>
            <select
              id="filter-provider"
              value={providerFilter}
              onChange={(e) => {
                setProviderFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-gray-200 bg-white p-2 text-xs focus:border-coral focus:outline-none"
            >
              <option value="">همه درگاه‌ها</option>
              <option value="mock">آزمایشی (mock)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-medium text-gray">از تاریخ</label>
            <input
              id="filter-start-date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-gray-200 bg-white p-2 text-xs focus:border-coral focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-gray">تا تاریخ</label>
            <input
              id="filter-end-date"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-gray-200 bg-white p-2 text-xs focus:border-coral focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-gray">جستجوی شناسه / مشتری</label>
            <input
              id="filter-search"
              type="text"
              placeholder="کد پیگیری، نام یا شماره..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-gray-200 bg-white p-2 text-xs focus:border-coral focus:outline-none"
            />
          </div>
        </Card>

        {/* Transactions Table */}
        {txLoading ? (
          <PanelLoading />
        ) : txError ? (
          <PanelError message={txError} onRetry={loadTransactions} />
        ) : transactions.length === 0 ? (
          <PanelEmpty title="هیچ تراکنشی مطابق فیلترهای انتخابی یافت نشد" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-gray-100 bg-gray-50/75 text-gray">
                <tr>
                  <th className="px-4 py-3 font-medium">شناسه / زمان</th>
                  <th className="px-4 py-3 font-medium">مشتری</th>
                  <th className="px-4 py-3 font-medium">زیباگر</th>
                  <th className="px-4 py-3 font-medium">مبلغ ناخالص</th>
                  <th className="px-4 py-3 font-medium">کارمزد پلتفرم</th>
                  <th className="px-4 py-3 font-medium">سهم زیباگر</th>
                  <th className="px-4 py-3 font-medium">وضعیت</th>
                  <th className="px-4 py-3 font-medium text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => {
                  const commRate = tx.platformCommissionRate != null ? Number(tx.platformCommissionRate) : 10;
                  const commAmount =
                    tx.platformCommissionAmount != null
                      ? tx.platformCommissionAmount
                      : Math.round((tx.amount * commRate) / 100);
                  const netAmount =
                    tx.professionalNetAmount != null ? tx.professionalNetAmount : tx.amount - commAmount;

                  return (
                    <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-mono text-[11px] font-semibold text-dark" dir="ltr">
                          {tx.id.slice(0, 8)}…
                        </div>
                        <div className="text-[10px] text-gray" dir="ltr">
                          {new Date(tx.createdAt).toLocaleString('fa-IR')}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-dark">
                          {tx.booking?.customer?.profile?.displayName || 'مشتری پلتفرم'}
                        </div>
                        <div className="text-[11px] text-gray" dir="ltr">
                          {tx.booking?.customer?.phone}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-dark">
                          {tx.booking?.professional?.title || 'نامشخص'}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-dark">{formatPrice(tx.amount)}</td>
                      <td className="px-4 py-3 text-emerald-700 font-medium">
                        {tx.status === 'paid' ? formatPrice(commAmount) : '—'}
                        {tx.status === 'paid' && (
                          <span className="mr-1 text-[10px] text-gray">({commRate}٪)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-blue-700 font-medium">
                        {tx.status === 'paid' ? formatPrice(netAmount) : '—'}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(tx.status)}</td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          id={`btn-view-tx-${tx.id.slice(0, 8)}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDetail(tx.id)}
                          className="h-7 text-xs text-coral hover:bg-coral-soft hover:text-coral"
                        >
                          جزئیات
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray">
                <div>
                  صفحه {page.toLocaleString('fa-IR')} از {totalPages.toLocaleString('fa-IR')}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-7 px-3 text-xs"
                  >
                    قبلی
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-7 px-3 text-xs"
                  >
                    بعدی
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transaction Detail Modal / Drawer */}
      {selectedTxId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-base font-bold text-dark">جزئیات کامل تراکنش مالی</h3>
              <button
                onClick={handleCloseDetail}
                className="rounded-full p-1 text-gray hover:bg-gray-100 hover:text-dark"
              >
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div className="py-8">
                <PanelLoading />
              </div>
            ) : detailError ? (
              <div className="py-4">
                <PanelError message={detailError} onRetry={() => handleOpenDetail(selectedTxId)} />
              </div>
            ) : selectedTxDetail ? (
              <div className="mt-4 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3">
                  <div>
                    <span className="text-gray block text-[11px]">شناسه تراکنش:</span>
                    <span className="font-mono text-dark" dir="ltr">
                      {selectedTxDetail.id}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray block text-[11px]">وضعیت:</span>
                    <div className="mt-0.5">{getStatusBadge(selectedTxDetail.status)}</div>
                  </div>
                  <div>
                    <span className="text-gray block text-[11px]">کد پیگیری درگاه:</span>
                    <span className="font-mono text-dark" dir="ltr">
                      {selectedTxDetail.providerRef || 'ثبت نشده'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray block text-[11px]">درگاه پرداخت:</span>
                    <span className="text-dark font-medium">{selectedTxDetail.provider}</span>
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="rounded-lg border border-gray-100 p-4 space-y-2">
                  <div className="font-semibold text-dark text-sm border-b border-gray-100 pb-2">
                    تفکیک و تسویه مالی
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray">مبلغ پرداختی مشتری (ناخالص):</span>
                    <span className="font-bold text-dark">{formatPrice(selectedTxDetail.amount)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-emerald-700">
                    <span>
                      کارمزد سهم پلتفرم (
                      {selectedTxDetail.platformCommissionRate != null
                        ? `${selectedTxDetail.platformCommissionRate}٪`
                        : '۱۰٪'}
                      ):
                    </span>
                    <span className="font-semibold">
                      {formatPrice(
                        selectedTxDetail.platformCommissionAmount != null
                          ? selectedTxDetail.platformCommissionAmount
                          : Math.round((selectedTxDetail.amount * 10) / 100),
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-blue-700">
                    <span>سهم خالص زیباگر:</span>
                    <span className="font-semibold">
                      {formatPrice(
                        selectedTxDetail.professionalNetAmount != null
                          ? selectedTxDetail.professionalNetAmount
                          : selectedTxDetail.amount - Math.round((selectedTxDetail.amount * 10) / 100),
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-gray text-[11px]">
                    <span>کارمزد درگاه بانکی:</span>
                    <span>۰ تومان (پوشش توسط پلتفرم)</span>
                  </div>
                </div>

                {/* Booking & Parties info */}
                <div className="space-y-2 rounded-lg border border-gray-100 p-4">
                  <div className="font-semibold text-dark text-sm border-b border-gray-100 pb-2">
                    اطلاعات رزرو و طرفین
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray">مشتری:</span>
                    <span className="text-dark">
                      {selectedTxDetail.booking?.customer?.profile?.displayName || 'نامشخص'} (
                      {selectedTxDetail.booking?.customer?.phone})
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray">زیباگر / سالن:</span>
                    <span className="text-dark">
                      {selectedTxDetail.booking?.professional?.title || 'نامشخص'}
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray">زمان پرداخت:</span>
                    <span className="text-dark" dir="ltr">
                      {selectedTxDetail.paidAt
                        ? new Date(selectedTxDetail.paidAt).toLocaleString('fa-IR')
                        : 'پرداخت نشده'}
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray">وضعیت استرداد (Refund):</span>
                    <span className="text-amber-700 font-medium">پشتیبانی نشده در سیستم</span>
                  </div>
                </div>

                <div className="pt-2 text-right">
                  <Button variant="outline" size="sm" onClick={handleCloseDetail} className="w-full">
                    بستن
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
