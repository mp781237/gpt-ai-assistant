const TRADING_DAYS_1M = 21;
const TRADING_DAYS_3M = 63;
const TRADING_DAYS_6M = 126;
const TRADING_DAYS_12M = 252;

const toNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const extractCloses = (chartResponse) => {
  const result = chartResponse?.data?.chart?.result?.[0];
  if (!result) return [];

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];

  return timestamps
    .map((timestamp, index) => ({
      date: new Date(timestamp * 1000).toISOString().split('T')[0],
      close: toNumber(closes[index]),
    }))
    .filter(({ close }) => close !== null);
};

const calculateReturn = (closes, days) => {
  if (closes.length <= days) return null;
  const latest = closes[closes.length - 1].close;
  const base = closes[closes.length - 1 - days].close;
  if (!base) return null;
  return ((latest / base) - 1) * 100;
};

const calculateMomentum = (closes) => {
  const r1m = calculateReturn(closes, TRADING_DAYS_1M);
  const r3m = calculateReturn(closes, TRADING_DAYS_3M);
  const r6m = calculateReturn(closes, TRADING_DAYS_6M);
  const r12m = calculateReturn(closes, TRADING_DAYS_12M);

  const acceleration = r1m !== null && r6m !== null ? r1m - r6m : null;

  return {
    r1m,
    r3m,
    r6m,
    r12m,
    acceleration,
    absoluteMomentum: r12m !== null ? r12m > 0 : null,
  };
};

const roundValue = (value, digits = 2) => (
  typeof value === 'number' && Number.isFinite(value)
    ? Number(value.toFixed(digits))
    : null
);

const summarizeMomentum = ({
  symbol,
  closes,
  benchmarkR12m,
}) => {
  const momentum = calculateMomentum(closes);
  const latest = closes[closes.length - 1]?.close || null;
  const relativeMomentum = momentum.r12m !== null && benchmarkR12m !== null
    ? momentum.r12m - benchmarkR12m
    : null;

  return {
    symbol,
    latestClose: roundValue(latest, 4),
    asOf: closes[closes.length - 1]?.date || null,
    momentum: {
      r1m: roundValue(momentum.r1m),
      r3m: roundValue(momentum.r3m),
      r6m: roundValue(momentum.r6m),
      r12m: roundValue(momentum.r12m),
      acceleration: roundValue(momentum.acceleration),
      relative12mVsBenchmark: roundValue(relativeMomentum),
      absoluteMomentum: momentum.absoluteMomentum,
      relativeMomentum: relativeMomentum !== null ? relativeMomentum > 0 : null,
      dualMomentum: momentum.absoluteMomentum && relativeMomentum > 0,
    },
  };
};

export {
  TRADING_DAYS_1M,
  TRADING_DAYS_3M,
  TRADING_DAYS_6M,
  TRADING_DAYS_12M,
  extractCloses,
  calculateReturn,
  calculateMomentum,
  summarizeMomentum,
};
