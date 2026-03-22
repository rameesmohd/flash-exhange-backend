// controllers/admin/dashboardStats.js
const orderModel = require('../../model/order');
const fundModel  = require('../../model/fund');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getTodayISTRange() {
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const s = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 0, 0, 0, 0));
  const e = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 23, 59, 59, 999));
  return { start: new Date(s - IST_OFFSET_MS), end: new Date(e - IST_OFFSET_MS) };
}

function getThisWeekISTRange() {
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const day = nowIST.getUTCDay();
  const monOff = day === 0 ? -6 : 1 - day;
  const s = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate() + monOff, 0, 0, 0, 0));
  const e = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate() + monOff + 6, 23, 59, 59, 999));
  return { start: new Date(s - IST_OFFSET_MS), end: new Date(e - IST_OFFSET_MS) };
}

function getThisMonthISTRange() {
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const s = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), 1, 0, 0, 0, 0));
  const e = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start: new Date(s - IST_OFFSET_MS), end: new Date(e - IST_OFFSET_MS) };
}

const periodCond = (range) => ({
  $cond: {
    if: { $and: [{ $gte: ['$createdAt', range.start] }, { $lte: ['$createdAt', range.end] }] },
    then: 1, else: 0,
  },
});

/* ─── Overall stats (existing shape, unchanged) ──────────────────── */
function reshapeStats(rows) {
  const STATUSES = ['pending', 'success', 'failed', 'dispute', 'processing'];
  const empty = () => ({ pending:0, success:0, failed:0, dispute:0, processing:0, totalOrders:0, totalFiat:0, totalFulfilled:0 });
  const buckets = { today: empty(), week: empty(), month: empty(), total: empty() };

  for (const row of rows) {
    const s = row._id;
    if (!STATUSES.includes(s)) continue;

    buckets.today[s]            = (buckets.today[s] || 0) + row.todayCount;
    buckets.today.totalOrders   += row.todayCount;
    buckets.today.totalFiat     += row.todayFiat;
    buckets.today.totalFulfilled+= row.todayFulfilled;

    buckets.week[s]             = (buckets.week[s] || 0) + row.weekCount;
    buckets.week.totalOrders    += row.weekCount;
    buckets.week.totalFiat      += row.weekFiat;
    buckets.week.totalFulfilled += row.weekFulfilled;

    buckets.month[s]            = (buckets.month[s] || 0) + row.monthCount;
    buckets.month.totalOrders   += row.monthCount;
    buckets.month.totalFiat     += row.monthFiat;
    buckets.month.totalFulfilled+= row.monthFulfilled;

    buckets.total[s]            = (buckets.total[s] || 0) + row.totalCount;
    buckets.total.totalOrders   += row.totalCount;
    buckets.total.totalFiat     += row.totalFiat;
    buckets.total.totalFulfilled+= row.totalFulfilled;
  }

  for (const bucket of Object.values(buckets))
    for (const key of Object.keys(bucket))
      if (typeof bucket[key] === 'number')
        bucket[key] = Math.round(bucket[key] * 100) / 100;

  return buckets;
}

/* ─── Per-fund stats ─────────────────────────────────────────────── */
function reshapePerFund(rows) {
  // rows: [{ _id: { fund: ObjectId, status: string }, todayCount, ... }]
  const STATUSES = ['pending', 'success', 'failed', 'dispute', 'processing'];

  const fundMap = {}; // fundId → { today, week, month, total }

  const emptyBucket = () => ({
    pending:0, success:0, failed:0, dispute:0, processing:0,
    totalOrders:0, totalFiat:0, totalFulfilled:0,
  });
  const emptyFund = () => ({
    today: emptyBucket(), week: emptyBucket(),
    month: emptyBucket(), total: emptyBucket(),
  });

  for (const row of rows) {
    const fundId = String(row._id.fund);
    const status = row._id.status;
    if (!STATUSES.includes(status)) continue;

    if (!fundMap[fundId]) fundMap[fundId] = emptyFund();
    const f = fundMap[fundId];

    f.today[status]             = (f.today[status] || 0) + row.todayCount;
    f.today.totalOrders         += row.todayCount;
    f.today.totalFiat           += row.todayFiat;
    f.today.totalFulfilled      += row.todayFulfilled;

    f.week[status]              = (f.week[status] || 0) + row.weekCount;
    f.week.totalOrders          += row.weekCount;
    f.week.totalFiat            += row.weekFiat;
    f.week.totalFulfilled       += row.weekFulfilled;

    f.month[status]             = (f.month[status] || 0) + row.monthCount;
    f.month.totalOrders         += row.monthCount;
    f.month.totalFiat           += row.monthFiat;
    f.month.totalFulfilled      += row.monthFulfilled;

    f.total[status]             = (f.total[status] || 0) + row.totalCount;
    f.total.totalOrders         += row.totalCount;
    f.total.totalFiat           += row.totalFiat;
    f.total.totalFulfilled      += row.totalFulfilled;
  }

  // Round all numbers
  for (const fund of Object.values(fundMap))
    for (const bucket of Object.values(fund))
      for (const key of Object.keys(bucket))
        if (typeof bucket[key] === 'number')
          bucket[key] = Math.round(bucket[key] * 100) / 100;

  return fundMap; // { [fundId]: { today, week, month, total } }
}

/* ═══════════════════════════════════════════════════════════════════
   GET /admin/dashboard/stats
═══════════════════════════════════════════════════════════════════ */
const getDashboardStats = async (req, res) => {
  try {
    const todayRange = getTodayISTRange();
    const weekRange  = getThisWeekISTRange();
    const monthRange = getThisMonthISTRange();

    const periodFields = (prefix) => ({
      [`${prefix}Count`]:     { $sum: periodCond(prefix === 'today' ? todayRange : prefix === 'week' ? weekRange : monthRange) },
      [`${prefix}Fiat`]:      { $sum: { $multiply: [periodCond(prefix === 'today' ? todayRange : prefix === 'week' ? weekRange : monthRange), { $ifNull: ['$fiat', 0] }] } },
      [`${prefix}Fulfilled`]: { $sum: { $multiply: [periodCond(prefix === 'today' ? todayRange : prefix === 'week' ? weekRange : monthRange), { $ifNull: ['$fulfilledFiat', 0] }] } },
    });

    // Run both aggregations in parallel
    const [overallRows, perFundRows, allFunds] = await Promise.all([

      // ── 1. Overall: group by status only ──────────────────────
      orderModel.aggregate([
        {
          $group: {
            _id: '$status',
            todayCount:     { $sum: periodCond(todayRange) },
            todayFiat:      { $sum: { $multiply: [periodCond(todayRange), { $ifNull: ['$fiat', 0] }] } },
            todayFulfilled: { $sum: { $multiply: [periodCond(todayRange), { $ifNull: ['$fulfilledFiat', 0] }] } },
            weekCount:      { $sum: periodCond(weekRange) },
            weekFiat:       { $sum: { $multiply: [periodCond(weekRange), { $ifNull: ['$fiat', 0] }] } },
            weekFulfilled:  { $sum: { $multiply: [periodCond(weekRange), { $ifNull: ['$fulfilledFiat', 0] }] } },
            monthCount:     { $sum: periodCond(monthRange) },
            monthFiat:      { $sum: { $multiply: [periodCond(monthRange), { $ifNull: ['$fiat', 0] }] } },
            monthFulfilled: { $sum: { $multiply: [periodCond(monthRange), { $ifNull: ['$fulfilledFiat', 0] }] } },
            totalCount:     { $sum: 1 },
            totalFiat:      { $sum: { $ifNull: ['$fiat', 0] } },
            totalFulfilled: { $sum: { $ifNull: ['$fulfilledFiat', 0] } },
          },
        },
      ]),

      // ── 2. Per-fund: group by { fund, status } ────────────────
      orderModel.aggregate([
        {
          $group: {
            _id: { fund: '$fund', status: '$status' },
            todayCount:     { $sum: periodCond(todayRange) },
            todayFiat:      { $sum: { $multiply: [periodCond(todayRange), { $ifNull: ['$fiat', 0] }] } },
            todayFulfilled: { $sum: { $multiply: [periodCond(todayRange), { $ifNull: ['$fulfilledFiat', 0] }] } },
            weekCount:      { $sum: periodCond(weekRange) },
            weekFiat:       { $sum: { $multiply: [periodCond(weekRange), { $ifNull: ['$fiat', 0] }] } },
            weekFulfilled:  { $sum: { $multiply: [periodCond(weekRange), { $ifNull: ['$fulfilledFiat', 0] }] } },
            monthCount:     { $sum: periodCond(monthRange) },
            monthFiat:      { $sum: { $multiply: [periodCond(monthRange), { $ifNull: ['$fiat', 0] }] } },
            monthFulfilled: { $sum: { $multiply: [periodCond(monthRange), { $ifNull: ['$fulfilledFiat', 0] }] } },
            totalCount:     { $sum: 1 },
            totalFiat:      { $sum: { $ifNull: ['$fiat', 0] } },
            totalFulfilled: { $sum: { $ifNull: ['$fulfilledFiat', 0] } },
          },
        },
      ]),

      // ── 3. All funds (for code/type/fundType labels) ──────────
      fundModel
        .find({})
        .select('type code fundType status sortOrder')
        .sort({ sortOrder: 1 })
        .lean(),
    ]);

    const overall = reshapeStats(overallRows);
    const perFundMap = reshapePerFund(perFundRows);

    // Attach fund metadata to each entry in perFundMap
    const byFund = allFunds.map((f) => ({
      fundId:   String(f._id),
      type:     f.type,
      code:     f.code,
      fundType: f.fundType,
      status:   f.status,
      stats:    perFundMap[String(f._id)] || {
        today: { pending:0,success:0,failed:0,dispute:0,totalOrders:0,totalFiat:0,totalFulfilled:0 },
        week:  { pending:0,success:0,failed:0,dispute:0,totalOrders:0,totalFiat:0,totalFulfilled:0 },
        month: { pending:0,success:0,failed:0,dispute:0,totalOrders:0,totalFiat:0,totalFulfilled:0 },
        total: { pending:0,success:0,failed:0,dispute:0,totalOrders:0,totalFiat:0,totalFulfilled:0 },
      },
    }));

    const nowIST = new Date(Date.now() + IST_OFFSET_MS);
    overall.asOf = nowIST.toISOString().replace('Z', '+05:30');
    overall.todayRange = { from: todayRange.start.toISOString(), to: todayRange.end.toISOString() };

    return res.status(200).json({
      success: true,
      stats: {
        ...overall,  // today, week, month, total, asOf, todayRange  (existing shape)
        byFund,      // NEW: array of per-fund breakdowns
      },
    });
  } catch (error) {
    console.error('getDashboardStats error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getDashboardStats };