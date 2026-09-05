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
  fetchAdminFailedTransactionsAlert,
  updateAdminFailedTransactionsThreshold,
  type AdminFinancialSummary,
  type AdminFinancialTransaction,
  type AdminFinancialTransactionDetail,
  type AdminCommissionSetting,
  type AdminFinancialPeriod,
  type HourlyFailedAlert,
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

  // Hourly Failed Alert
  const [alertData, setAlertData] = useState<HourlyFailedAlert | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [thresholdInput, setThresholdInput] = useState('3');
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [thresholdFeedback, setThresholdFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showRecentFailedDrawer, setShowRecentFailedDrawer] = useState(false);
  const [simulationActive, setSimulationActive] = useState(false);

  // Load summary
  const loadSummary = useCallback(async (p: AdminFinancialPeriod) => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await fetchAdminFinancialSummary(p);
      setSummary(data);
      if (data.hourlyFailedAlert) {
        setAlertData(data.hourlyFailedAlert);
        setThresholdInput(String(data.hourlyFailedAlert.threshold));
      }
    } catch (e) {
      setSummaryError(friendlyApiError(e));
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Refresh alert data
  const refreshAlertData = useCallback(async () => {
    try {
      const alert = await fetchAdminFailedTransactionsAlert();
      setAlertData(alert);
      setThresholdInput(String(alert.threshold));
    } catch (e) {
      console.warn('Could not refresh alert data:', e);
    }
  }, []);

  const handleFilterFailedTransactions = () => {
    setStatusFilter('failed');
    setPage(1);
    const txSection = document.getElementById('transactions-section');
    if (txSection) {
      txSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSaveThreshold = async () => {
    const val = parseInt(thresholdInput, 10);
    if (isNaN(val) || val < 1) {
      setThresholdFeedback({ type: 'error', text: 'لطفاً عددی معتبر و بزرگتر از صفر برای آستانه وارد نمایید.' });
      return;
    }
    setThresholdSaving(true);
    setThresholdFeedback(null);
    try {
      await updateAdminFailedTransactionsThreshold(val);
      await refreshAlertData();
      setThresholdFeedback({ type: 'success', text: `حد آستانه با موفقیت به ${val} تراکنش در ساعت تغییر یافت.` });
      setTimeout(() => {
        setShowThresholdModal(false);
        setThresholdFeedback(null);
      }, 1400);
    } catch (e) {
      setThresholdFeedback({ type: 'error', text: friendlyApiError(e) });
    } finally {
      setThresholdSaving(false);
    }
  };

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

  const isAlertTriggered = Boolean(
    alertData?.isTriggered ||
    (alertData && alertData.failedCount >= alertData.threshold) ||
    simulationActive
  );
  const displayFailedCount = simulationActive
    ? Math.max(alertData?.failedCount ?? 0, (alertData?.threshold ?? 3) + 2)
    : alertData?.failedCount ?? 0;
  const displayThreshold = alertData?.threshold ?? 3;

  return (
    <div id="admin-finance-container" className="space-y-8 pb-12">
      {/* Failed Transactions Hourly Alert Banner */}
      {isAlertTriggered && !alertDismissed && (
        <div
          id="failed-transactions-alert-banner"
          role="alert"
          className="relative overflow-hidden rounded-2xl border-2 border-rose-400 bg-gradient-to-r from-rose-50 via-amber-50/60 to-orange-50 p-5 shadow-sm transition-all"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3.5">
              {/* Pulsing Beacon & Icon */}
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-md shadow-rose-200">
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-rose-600"></span>
                </span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-rose-950">
                    هشدار امنیتی درگاه: افزایش غیرعادی تراکنش‌های ناموفق در یک ساعت اخیر
                  </h2>
                  <span className="inline-flex items-center rounded-full bg-rose-200/80 px-2.5 py-0.5 text-xs font-bold text-rose-900">
                    {displayFailedCount} تراکنش ناموفق (حد مجاز: {displayThreshold})
                  </span>
                  {simulationActive && (
                    <span className="inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                      حالت شبیه‌سازی تست
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-rose-900/90">
                  در ۶۰ دقیقه گذشته، تعداد <strong className="font-bold text-rose-950">{displayFailedCount}</strong> تراکنش با وضعیت ناموفق به ثبت رسیده که فراتر از سقف آستانه بحرانی (<strong className="font-bold text-rose-950">{displayThreshold}</strong> خطا) است. پیشنهاد می‌شود وضعیت ارتباط شبکه شاپرک و درگاه بانکی را سریعاً بازبینی نمایید.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
              <button
                id="btn-view-failed-tx"
                onClick={handleFilterFailedTransactions}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow hover:bg-rose-700 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                مشاهده و پالایش تراکنش‌های ناموفق
              </button>

              {alertData?.recentFailed && alertData.recentFailed.length > 0 && (
                <button
                  id="btn-toggle-peek-failed"
                  onClick={() => setShowRecentFailedDrawer(!showRecentFailedDrawer)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-medium text-rose-900 shadow-sm hover:bg-rose-50 transition-colors"
                >
                  <svg className="h-4 w-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {showRecentFailedDrawer ? 'بستن ریز خطاها' : `بررسی سریع خطاها (${alertData.recentFailed.length})`}
                </button>
              )}

              <button
                id="btn-open-threshold-modal"
                onClick={() => setShowThresholdModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
              >
                <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                تنظیم آستانه ({displayThreshold})
              </button>

              <button
                id="btn-dismiss-alert"
                onClick={() => setAlertDismissed(true)}
                className="rounded-lg p-2 text-rose-600 hover:bg-rose-100 transition-colors"
                title="بستن موقت اعلان"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Quick Peek Drawer for Recent Failed Transactions */}
          {showRecentFailedDrawer && alertData?.recentFailed && alertData.recentFailed.length > 0 && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-white/95 p-4 shadow-inner">
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-rose-950">
                <span>آخرین تراکنش‌های ناموفق ثبت‌شده در ۶۰ دقیقه اخیر:</span>
                <span className="text-gray-500 font-normal">کلیک روی هر سطر جهت مشاهده جزئیات پرداخت</span>
              </div>
              <div className="divide-y divide-rose-100 overflow-x-auto text-xs">
                {alertData.recentFailed.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2 text-right">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-gray-500">{item.id.slice(0, 8)}...</span>
                      <span className="font-semibold text-rose-700">{formatPrice(item.amount)}</span>
                      <span className="text-gray-600">مشتری: {item.customerName}</span>
                      {item.professionalTitle && (
                        <span className="text-gray-500 hidden sm:inline">زیباگر: {item.professionalTitle}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-[11px]" dir="ltr">
                        {new Date(item.failedAt).toLocaleTimeString('fa-IR')}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => handleOpenDetail(item.id)}
                      >
                        جزئیات
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dismissed Alert Restorer Bar */}
      {isAlertTriggered && alertDismissed && (
        <div className="flex items-center justify-between rounded-xl border border-rose-300 bg-rose-50/80 px-4 py-2.5 text-xs text-rose-900 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-600"></span>
            </span>
            <span>
              هشدار فعال درگاه: <strong>{displayFailedCount}</strong> تراکنش ناموفق در یک ساعت گذشته (آستانه: {displayThreshold})
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleFilterFailedTransactions}
              className="font-semibold text-rose-700 underline hover:text-rose-950"
            >
              فیلتر تراکنش‌های ناموفق
            </button>
            <button
              onClick={() => setAlertDismissed(false)}
              className="rounded bg-rose-200 px-2 py-1 font-medium text-rose-900 hover:bg-rose-300"
            >
              نمایش مجدد بنر
            </button>
          </div>
        </div>
      )}

      {/* Header & Notice */}
      <div className="flex flex-col justify-between gap-4 border-b border-gray-100 pb-5 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-dark">مدیریت مالی و گزارشات درآمدی</h1>
          <p className="mt-1 text-sm text-gray">
            محاسبه دقیق جریان نقدینگی، کارمزد پلتفرم، سهم زیباگران و گزارش شفاف تراکنش‌ها
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAlertTriggered ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 ring-1 ring-inset ring-rose-600/30">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
              </span>
              هشدار فعال درگاه: {displayFailedCount} خطا در ۱ ساعت اخیر
            </span>
          ) : (
            <button
              onClick={() => setShowThresholdModal(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/20 hover:bg-emerald-100 transition-colors"
              title="تنظیم آستانه هشدار درگاه"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
              سلامت درگاه: عادی ({displayFailedCount} خطا در ۱ ساعت اخیر / آستانه: {displayThreshold})
            </button>
          )}

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
      <div id="transactions-section" className="space-y-4 pt-2">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-semibold text-dark">فهرست تراکنش‌های پرداخت</h2>
              {alertData && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    isAlertTriggered
                      ? 'bg-rose-100 text-rose-800 font-semibold'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  خطاهای ۱ ساعت اخیر: {displayFailedCount} (آستانه: {displayThreshold})
                </span>
              )}
            </div>
            <p className="text-xs text-gray">مجموع {totalCount.toLocaleString('fa-IR')} تراکنش ثبت شده</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowThresholdModal(true)}
              className="text-xs h-8 border-gray-200 hover:bg-gray-50"
            >
              تنظیم آستانه هشدار خطاها
            </Button>
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

      {/* Threshold Configuration Modal */}
      {showThresholdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-dark">تنظیم آستانه هشدار تراکنش‌های ناموفق</h3>
              <button
                onClick={() => setShowThresholdModal(false)}
                className="text-gray-400 hover:text-dark text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <p className="text-gray leading-relaxed">
                در صورتی که تعداد تراکنش‌های ناموفق ثبت‌شده در ۶۰ دقیقه اخیر به این عدد یا بیشتر برسد، یک اعلان و بنر بصری هشدار امنیتی در بالای صفحه مدیریت مالی برای مدیران ارشد به نمایش درخواهد آمد.
              </p>

              <div>
                <label className="block font-semibold text-dark mb-1">
                  حداکثر تراکنش ناموفق مجاز در هر ساعت (سقف آستانه):
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    className="w-28 text-center font-bold"
                  />
                  <span className="text-gray">تراکنش در ۶۰ دقیقه</span>
                </div>
                <div className="mt-1 text-[11px] text-gray-500">
                  مقدار پیش‌فرض سیستم: ۳ خطا در ساعت. جهت نظارت حساس‌تر در ساعات شلوغی می‌توانید این رقم را به ۱ یا ۲ کاهش دهید.
                </div>
              </div>

              {/* Simulation preview toggle */}
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/70 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-dark">شبیه‌سازی و تست نمایش اعلان</div>
                    <div className="text-[11px] text-gray mt-0.5 leading-relaxed">
                      پیش‌نمایش فوری وضعیت اعلان در بالای صفحه جهت بررسی بصری حتی زمانی که خطای زنده وجود ندارد.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    id="toggle-simulation"
                    checked={simulationActive}
                    onChange={(e) => {
                      setSimulationActive(e.target.checked);
                      if (e.target.checked) setAlertDismissed(false);
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-coral focus:ring-coral cursor-pointer shrink-0"
                  />
                </div>
              </div>

              {thresholdFeedback && (
                <div
                  className={`rounded-lg p-2.5 text-xs font-medium ${
                    thresholdFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-rose-50 text-rose-800'
                  }`}
                >
                  {thresholdFeedback.text}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowThresholdModal(false)}
                disabled={thresholdSaving}
              >
                انصراف
              </Button>
              <Button
                size="sm"
                onClick={handleSaveThreshold}
                disabled={thresholdSaving}
                className="bg-coral text-white hover:bg-coral/90"
              >
                {thresholdSaving ? 'در حال ذخیره...' : 'ذخیره آستانه'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
