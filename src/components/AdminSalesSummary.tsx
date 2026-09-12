import React, { useMemo } from 'react';
import {
  TrendingUp,
  Calendar,
  CheckCircle2,
  XCircle,
  IndianRupee,
  ShoppingBag,
  RotateCcw,
  ArrowRight,
  BarChart3,
  Receipt,
  Calculator,
  Plus,
} from 'lucide-react';
import { Order, DailyExpense } from '../types';
import {
  getLocalDateString,
  calculateDateSalesMetrics,
  aggregateDailySales,
  formatDateLabel,
  formatCalendarDate,
} from '../utils/orderUtils';

interface AdminSalesSummaryProps {
  orders: Order[];
  expenses?: DailyExpense[];
  selectedDate: string;
  todayDate?: string;
  onSelectDate: (dateYMD: string) => void;
  onViewDateInHistory?: (dateYMD: string) => void;
  onAddExpense?: () => void;
}

export const AdminSalesSummary: React.FC<AdminSalesSummaryProps> = ({
  orders,
  expenses = [],
  selectedDate,
  todayDate,
  onSelectDate,
  onViewDateInHistory,
  onAddExpense,
}) => {
  // Use todayDate if provided from parent timer, or compute current date dynamically
  const todayYMD = todayDate || getLocalDateString();
  const isSelectedToday = selectedDate === todayYMD;

  // Calculate expense for selected date
  const selectedDateExpense = useMemo(() => {
    return expenses
      .filter((e) => e.date === selectedDate)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses, selectedDate]);

  // Selected date metrics (computed dynamically from real database orders and expenses)
  const selectedMetrics = useMemo(() => {
    return calculateDateSalesMetrics(orders, selectedDate, selectedDateExpense, todayYMD);
  }, [orders, selectedDate, selectedDateExpense, todayYMD]);

  // Daily sales metrics for the chart (past days with data + today)
  const dailyChartData = useMemo(() => {
    return aggregateDailySales(orders, 10);
  }, [orders]);

  // Find max sales amount for chart bar scaling
  const maxSalesInChart = useMemo(() => {
    const highest = Math.max(...dailyChartData.map((d) => d.totalSales), 1);
    return highest;
  }, [dailyChartData]);

  // All distinct dates with orders for quick-pick buttons
  const availableDates = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.createdAt) {
        set.add(getLocalDateString(o.createdAt));
      }
    });
    // Ensure today is in set
    set.add(todayYMD);
    return Array.from(set).sort().reverse();
  }, [orders, todayYMD]);

  return (
    <div className="bg-[#0b2416] border-2 border-[#1e4e30] rounded-2xl p-4 sm:p-5 shadow-xl space-y-5">
      {/* Top Header & Date Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#1b432a]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#123620] border border-[#dfb64c]/60 flex items-center justify-center text-[#dfb64c] shadow shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-[#fcfaf6]">
                {isSelectedToday ? "Today's Sales & Orders Summary" : 'Daily Sales & Orders Summary'}
              </h2>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border font-mono ${
                  isSelectedToday
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}
              >
                {isSelectedToday ? `TODAY • ${formatCalendarDate(todayYMD)}` : `DATE • ${formatCalendarDate(selectedDate)}`}
              </span>
            </div>
            <p className="text-xs text-[#8ea896] mt-0.5">
              Live business summary calculated directly from real database orders. Only valid orders are counted.
            </p>
          </div>
        </div>

        {/* Date Selector & Reset */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-1.5 bg-[#081a10] border border-[#245937] rounded-xl px-2.5 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-[#dfb64c]" />
            <span className="text-[#8ea896] font-medium hidden sm:inline">Select Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  onSelectDate(e.target.value);
                }
              }}
              className="bg-transparent text-[#fcfaf6] font-mono text-xs focus:outline-none cursor-pointer"
              title="Select date to inspect sales and orders"
            />
          </div>

          {!isSelectedToday && (
            <button
              onClick={() => onSelectDate(todayYMD)}
              className="bg-[#123620] hover:bg-[#184428] border border-[#245937] text-[#dfb64c] text-xs font-semibold px-2.5 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition-all"
              title="Reset view back to Today's sales"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Back to Today</span>
            </button>
          )}
        </div>
      </div>

      {/* Date Context Indicator Banner (if looking at another date) */}
      {!isSelectedToday && (
        <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Viewing totals for: <strong className="text-white font-mono">{formatCalendarDate(selectedDate)}</strong>
            </span>
          </div>
          {onViewDateInHistory && (
            <button
              onClick={() => onViewDateInHistory(selectedDate)}
              className="text-[11px] font-bold text-amber-300 hover:text-white underline flex items-center gap-1 cursor-pointer"
            >
              <span>View Orders</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* 5 Primary Summary Cards (Requirement 4: Total Orders, Business/Sales, Payment/Collection, Expense, Net Amount) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-3.5">
        {/* Card 1: Total Orders */}
        <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl p-3.5 sm:p-4 shadow flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[#8ea896] uppercase tracking-wide">
              {isSelectedToday ? "Today's Total Orders" : 'Total Orders'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#153e26] text-[#dfb64c] flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#fcfaf6]">
              {selectedMetrics.totalOrders}
            </div>
            <div className="text-[11px] text-[#8ea896] mt-1 flex items-center gap-1.5 flex-wrap">
              {selectedMetrics.rejectedOrders > 0 ? (
                <span className="text-stone-400">
                  {selectedMetrics.totalOrders} valid ({selectedMetrics.rejectedOrders} rejected excluded)
                </span>
              ) : (
                <span>Valid orders received</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Total Business / Sales */}
        <div className="bg-gradient-to-br from-[#123821] to-[#0f2d1c] border-2 border-[#dfb64c]/70 rounded-2xl p-3.5 sm:p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#dfb64c] uppercase tracking-wide flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>{isSelectedToday ? "Today's Total Business" : 'Total Business'}</span>
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#0a1f13] text-[#dfb64c] border border-[#dfb64c]/40 font-bold">
              SALES
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#dfb64c]">
              ₹{selectedMetrics.totalBusiness.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-emerald-300/90 mt-1 flex items-center gap-1">
              <span>Total value of valid orders</span>
            </div>
          </div>
        </div>

        {/* Card 3: Total Payment / Collection */}
        <div className="bg-[#0f2d1c] border border-emerald-500/40 rounded-2xl p-3.5 sm:p-4 shadow flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wide flex items-center gap-1">
              <IndianRupee className="w-3 h-3" />
              <span>{isSelectedToday ? "Today's Total Payment" : 'Total Payment'}</span>
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400">
              ₹{selectedMetrics.totalPayment.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-[#8ea896] mt-1">
              {selectedMetrics.pendingCollection > 0 ? (
                <span className="text-amber-300 font-mono text-[10px]">
                  ₹{selectedMetrics.pendingCollection.toLocaleString('en-IN')} pending delivery
                </span>
              ) : (
                <span>Collected payment amount</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 4: Expense */}
        <div className="bg-[#0f2d1c] border border-[#235836] rounded-2xl p-3.5 sm:p-4 shadow flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[#8ea896] uppercase tracking-wide flex items-center gap-1">
              <Receipt className="w-3 h-3" />
              <span>{isSelectedToday ? "Today's Expense" : 'Daily Expense'}</span>
            </span>
            {onAddExpense && (
              <button
                type="button"
                onClick={onAddExpense}
                className="w-6 h-6 rounded-lg bg-[#143d25] hover:bg-[#1a4e30] text-[#dfb64c] border border-[#28603b] flex items-center justify-center cursor-pointer transition-all"
                title="Add expense record"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#fcfaf6]">
              ₹{selectedMetrics.totalExpense.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-[#8ea896] mt-1 flex items-center justify-between">
              <span>Operational expenses</span>
              {onAddExpense && (
                <button
                  type="button"
                  onClick={onAddExpense}
                  className="text-[10px] text-[#dfb64c] hover:underline cursor-pointer font-semibold"
                >
                  + Record
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Card 5: Net Amount (Total Payment - Expense) */}
        <div className="bg-[#0f2d1c] border border-cyan-500/40 rounded-2xl p-3.5 sm:p-4 shadow flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-cyan-300 uppercase tracking-wide flex items-center gap-1">
              <Calculator className="w-3 h-3" />
              <span>{isSelectedToday ? "Today's Net Amount" : 'Net Amount'}</span>
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold">
              NET
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-cyan-300">
              ₹{selectedMetrics.netAmount.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-[#8ea896] mt-1">
              <span>Payment (₹{selectedMetrics.totalPayment.toLocaleString('en-IN')}) − Expense (₹{selectedMetrics.totalExpense.toLocaleString('en-IN')})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Order Status Breakdown Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
        <div className="bg-[#091a10] border border-[#1d462b] p-2.5 rounded-xl flex items-center justify-between">
          <span className="text-[#8ea896]">In Kitchen / Active:</span>
          <span className="font-mono font-bold text-amber-300">{selectedMetrics.acceptedOrders}</span>
        </div>
        <div className="bg-[#091a10] border border-[#1d462b] p-2.5 rounded-xl flex items-center justify-between">
          <span className="text-[#8ea896]">Delivered & Done:</span>
          <span className="font-mono font-bold text-emerald-400">{selectedMetrics.deliveredOrders}</span>
        </div>
        <div className="bg-[#091a10] border border-[#1d462b] p-2.5 rounded-xl flex items-center justify-between">
          <span className="text-[#8ea896]">Pending New Action:</span>
          <span className={`font-mono font-bold ${selectedMetrics.newOrders > 0 ? 'text-red-400' : 'text-[#8ea896]'}`}>
            {selectedMetrics.newOrders}
          </span>
        </div>
        <div className="bg-[#091a10] border border-[#1d462b] p-2.5 rounded-xl flex items-center justify-between">
          <span className="text-[#8ea896]">Rejected (Excluded):</span>
          <span className="font-mono font-bold text-stone-400">{selectedMetrics.rejectedOrders}</span>
        </div>
      </div>

      {/* DAILY SALES CHART SECTION */}
      <div className="pt-3 border-t border-[#1b432a]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#dfb64c]" />
            <h3 className="text-xs sm:text-sm font-bold text-[#fcfaf6]">
              Daily Sales Trend (Revenue & Order Counts)
            </h3>
          </div>
          <span className="text-[11px] text-[#8ea896]">
            Click any bar to inspect that day&apos;s totals
          </span>
        </div>

        {/* Chart Visualization */}
        <div className="bg-[#081a10] border border-[#1d462b] rounded-xl p-3 sm:p-4">
          <div className="grid grid-flow-col auto-cols-fr gap-2 sm:gap-3 items-end min-h-[140px] pt-6 pb-2">
            {dailyChartData.map((day) => {
              const isBarSelected = day.dateYMD === selectedDate;
              const isTodayBar = day.isToday;

              // Height percentage based on max sales
              const heightPct =
                maxSalesInChart > 0
                  ? Math.max(Math.round((day.totalSales / maxSalesInChart) * 85), day.totalOrders > 0 ? 15 : 6)
                  : 8;

              const dateLabelParts = day.dateYMD.split('-');
              const shortDateLabel = `${dateLabelParts[2]}/${dateLabelParts[1]}`;

              return (
                <button
                  key={day.dateYMD}
                  type="button"
                  onClick={() => onSelectDate(day.dateYMD)}
                  className={`group flex flex-col items-center justify-end h-full rounded-xl p-1.5 transition-all cursor-pointer relative ${
                    isBarSelected
                      ? 'bg-[#153e26] border-2 border-[#dfb64c] shadow-lg ring-2 ring-[#dfb64c]/30'
                      : 'hover:bg-[#11311e] border border-transparent'
                  }`}
                  title={`${day.formattedDate}: ₹${day.totalSales} (${day.totalOrders} orders, ${day.acceptedOrders} accepted, ${day.rejectedOrders} rejected)`}
                >
                  {/* Amount tooltip/label on top of bar */}
                  <div className="mb-1 text-center">
                    <span
                      className={`text-[10px] sm:text-[11px] font-mono font-bold block leading-tight ${
                        isBarSelected ? 'text-[#dfb64c]' : 'text-[#c9dcce] group-hover:text-white'
                      }`}
                    >
                      {day.totalSales > 0 ? `₹${day.totalSales}` : '₹0'}
                    </span>
                    <span className="text-[9px] text-[#8ea896] block font-mono">
                      {day.totalOrders} {day.totalOrders === 1 ? 'ord' : 'ords'}
                    </span>
                  </div>

                  {/* Vertical bar pill */}
                  <div className="w-full max-w-[42px] bg-[#0f2d1c] rounded-t-lg h-24 sm:h-28 flex flex-col justify-end p-0.5 border border-[#1e4e30]">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        isBarSelected
                          ? 'bg-gradient-to-t from-[#dfb64c] to-[#f8df93]'
                          : day.totalSales > 0
                          ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 group-hover:from-emerald-500 group-hover:to-emerald-300'
                          : 'bg-stone-800'
                      }`}
                    />
                  </div>

                  {/* Date label at bottom */}
                  <div className="mt-2 text-center">
                    <span
                      className={`text-[10px] font-mono font-bold block ${
                        isBarSelected ? 'text-[#dfb64c]' : 'text-[#8ea896] group-hover:text-white'
                      }`}
                    >
                      {shortDateLabel}
                    </span>
                    {isTodayBar && (
                      <span className="text-[8px] font-extrabold uppercase px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 block mt-0.5">
                        TODAY
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Date Chips */}
          <div className="mt-3 pt-3 border-t border-[#1a442b] flex items-center justify-between gap-2 flex-wrap text-xs">
            <span className="text-[11px] text-[#8ea896] font-medium">Quick Select Date:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {availableDates.map((dateYMD) => {
                const isSelected = dateYMD === selectedDate;
                const isToday = dateYMD === todayYMD;
                const label = isToday ? 'Today' : dateYMD;
                return (
                  <button
                    key={dateYMD}
                    type="button"
                    onClick={() => onSelectDate(dateYMD)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#dfb64c] text-[#0a1f13] font-bold shadow'
                        : 'bg-[#123620] text-[#a6bfae] hover:text-white border border-[#245937]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
