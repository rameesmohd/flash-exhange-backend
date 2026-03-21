// controllers/admin/dashboardStats.js
// Aggregates order statistics by period (today, week, month, all-time) in IST (UTC+5:30)

const orderModel = require('../../model/order');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +5:30 in milliseconds

/** Returns { start, end } as UTC Date objects for "today" in IST */
function getTodayISTRange() {
  const nowUTC = new Date();
  const nowIST = new Date(nowUTC.getTime() + IST_OFFSET_MS);

  // Midnight IST today (in IST wall time)
  const startIST = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 0, 0, 0, 0));
  const endIST   = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 23, 59, 59, 999));

  // Shift back to UTC to query MongoDB (which stores in UTC)
  return {
    start: new Date(startIST.getTime() - IST_OFFSET_MS),
    end:   new Date(endIST.getTime()   - IST_OFFSET_MS),
  };
}

/** Returns Monday–Sunday of the current IST week */
function getThisWeekISTRange() {
  const nowUTC = new Date();
  const nowIST = new Date(nowUTC.getTime() + IST_OFFSET_MS);

  const dayOfWeek = nowIST.getUTCDay(); // 0=Sun … 6=Sat
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const mondayIST = new Date(Date.UTC(
    nowIST.getUTCFullYear(), nowIST.getUTCMonth(),
    nowIST.getUTCDate() + mondayOffset, 0, 0, 0, 0
  ));
  const sundayIST = new Date(Date.UTC(
    nowIST.getUTCFullYear(), nowIST.getUTCMonth(),
    nowIST.getUTCDate() + mondayOffset + 6, 23, 59, 59, 999
  ));

  return {
    start: new Date(mondayIST.getTime() - IST_OFFSET_MS),
    end:   new Date(sundayIST.getTime() - IST_OFFSET_MS),
  };
}

/** Returns 1st–last day of the current IST month */
function getThisMonthISTRange() {
  const nowUTC = new Date();
  const nowIST = new Date(nowUTC.getTime() + IST_OFFSET_MS);

  const firstIST = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), 1, 0, 0, 0, 0));
  const lastIST  = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  return {
    start: new Date(firstIST.getTime() - IST_OFFSET_MS),
    end:   new Date(lastIST.getTime()  - IST_OFFSET_MS),
  };
}

/**
 * Single aggregation pipeline that returns stats for all periods at once.
 * Uses $facet so MongoDB does one collection scan.
 *
 * Shape returned per bucket:
 *   { pending, success, failed, dispute, totalOrders, totalFiat, totalFulfilled }
 */
async function buildStatsPipeline(todayRange, weekRange, monthRange) {
  const periodMatch = (range) => ({
    $cond: {
      if: { $and: [{ $gte: ['$createdAt', range.start] }, { $lte: ['$createdAt', range.end] }] },
      then: 1,
      else: 0,
    },
  });

  // One big $group over ALL documents — we use conditional counting per period
  const pipeline = [
    {
      $group: {
        _id: '$status',

        // ── Today ──────────────────────────────────────────────────
        todayCount:     { $sum: periodMatch(todayRange) },
        todayFiat:      { $sum: { $multiply: [periodMatch(todayRange), { $ifNull: ['$fiat', 0] }] } },
        todayFulfilled: { $sum: { $multiply: [periodMatch(todayRange), { $ifNull: ['$fulfilledFiat', 0] }] } },

        // ── This week ─────────────────────────────────────────────
        weekCount:      { $sum: periodMatch(weekRange) },
        weekFiat:       { $sum: { $multiply: [periodMatch(weekRange), { $ifNull: ['$fiat', 0] }] } },
        weekFulfilled:  { $sum: { $multiply: [periodMatch(weekRange), { $ifNull: ['$fulfilledFiat', 0] }] } },

        // ── This month ────────────────────────────────────────────
        monthCount:     { $sum: periodMatch(monthRange) },
        monthFiat:      { $sum: { $multiply: [periodMatch(monthRange), { $ifNull: ['$fiat', 0] }] } },
        monthFulfilled: { $sum: { $multiply: [periodMatch(monthRange), { $ifNull: ['$fulfilledFiat', 0] }] } },

        // ── All time ──────────────────────────────────────────────
        totalCount:     { $sum: 1 },
        totalFiat:      { $sum: { $ifNull: ['$fiat', 0] } },
        totalFulfilled: { $sum: { $ifNull: ['$fulfilledFiat', 0] } },
      },
    },
  ];

  return pipeline;
}

/** Reshapes raw agg rows into { today, week, month, total } buckets */
function reshapeStats(rows) {
  const STATUSES = ['pending', 'success', 'failed', 'dispute', 'processing'];

  const empty = () => ({
    pending: 0, success: 0, failed: 0, dispute: 0, processing: 0,
    totalOrders: 0, totalFiat: 0, totalFulfilled: 0,
  });

  const buckets = {
    today: empty(),
    week:  empty(),
    month: empty(),
    total: empty(),
  };

  for (const row of rows) {
    const status = row._id; // 'pending' | 'success' | 'failed' | 'dispute' | 'processing'
    if (!STATUSES.includes(status)) continue;

    // today
    buckets.today[status]          = (buckets.today[status] || 0) + row.todayCount;
    buckets.today.totalOrders      += row.todayCount;
    buckets.today.totalFiat        += row.todayFiat;
    buckets.today.totalFulfilled   += row.todayFulfilled;

    // week
    buckets.week[status]           = (buckets.week[status] || 0) + row.weekCount;
    buckets.week.totalOrders       += row.weekCount;
    buckets.week.totalFiat         += row.weekFiat;
    buckets.week.totalFulfilled    += row.weekFulfilled;

    // month
    buckets.month[status]          = (buckets.month[status] || 0) + row.monthCount;
    buckets.month.totalOrders      += row.monthCount;
    buckets.month.totalFiat        += row.monthFiat;
    buckets.month.totalFulfilled   += row.monthFulfilled;

    // total
    buckets.total[status]          = (buckets.total[status] || 0) + row.totalCount;
    buckets.total.totalOrders      += row.totalCount;
    buckets.total.totalFiat        += row.totalFiat;
    buckets.total.totalFulfilled   += row.totalFulfilled;
  }

  // Round all numeric values
  for (const bucket of Object.values(buckets)) {
    for (const key of Object.keys(bucket)) {
      if (typeof bucket[key] === 'number') {
        bucket[key] = Math.round(bucket[key] * 100) / 100;
      }
    }
  }

  return buckets;
}

/**
 * GET /admin/dashboard/stats
 * Returns aggregated order stats for today (IST), this week, this month, all-time.
 */
const getDashboardStats = async (req, res) => {
  try {
    const todayRange = getTodayISTRange();
    const weekRange  = getThisWeekISTRange();
    const monthRange = getThisMonthISTRange();

    const pipeline = await buildStatsPipeline(todayRange, weekRange, monthRange);
    const rows = await orderModel.aggregate(pipeline);

    const stats = reshapeStats(rows);

    // Attach IST timestamp so frontend can display "as of"
    const nowIST = new Date(Date.now() + IST_OFFSET_MS);
    stats.asOf = nowIST.toISOString().replace('Z', '+05:30');
    stats.todayRange = {
      from: todayRange.start.toISOString(),
      to:   todayRange.end.toISOString(),
    };

    return res.status(200).json({ success: true, stats });
  } catch (error) {
    console.error('getDashboardStats error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getDashboardStats };