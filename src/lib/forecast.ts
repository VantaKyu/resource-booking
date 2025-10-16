import {
  type Booking,
  type BusyDayForecast,
  type BusyDayForecastPoint,
  type BusyDayLabel,
} from "./api";

interface ForecastOptions {
  horizonDays?: number;
  smoothWindow?: number;
  smoothingFactor?: number;
}

function isoDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, val) => acc + val, 0) / values.length;
}

function standardDeviation(values: number[], avg: number): number {
  if (values.length === 0) return 0;
  const variance =
    values.reduce((acc, val) => acc + (val - avg) * (val - avg), 0) / values.length;
  return Math.sqrt(variance);
}

function exponentialMovingAverage(values: number[], alpha: number): number[] {
  if (values.length === 0) return [];
  const safeAlpha = Math.max(0, Math.min(1, alpha)); // Clamp alpha between 0 and 1
  const results: number[] = [];
  let ema = values[0]; // Initialize EMA with first value
  results.push(ema);
  for (let i = 1; i < values.length; i += 1) {
    ema = safeAlpha * values[i] + (1 - safeAlpha) * ema;
    results.push(ema);
  }
  return results;
}

function getWeekdayAverages(counts: Map<string, number>): number[] {
  const totals = new Array<number>(7).fill(0);
  const occurrences = new Array<number>(7).fill(0);
  for (const [dateString, count] of counts.entries()) {
    const parsed = new Date(`${dateString}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) continue;
    const weekday = parsed.getUTCDay();
    totals[weekday] += count;
    occurrences[weekday] += 1;
  }
  return totals.map((total, idx) => (occurrences[idx] > 0 ? total / occurrences[idx] : NaN));
}

export function generateBusyDayForecast(
  bookings: Booking[],
  options: ForecastOptions = {}
): BusyDayForecast {
  const horizonDays = options.horizonDays ?? 14;
  const smoothWindow = options.smoothWindow ?? 3;
  const smoothingFactor = options.smoothingFactor ?? 0.3;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const countsByDay = new Map<string, number>();

  for (const booking of bookings) {
    if (!booking?.start_dt) continue;
    if (booking.status === "CANCEL") continue;
    const start = new Date(booking.start_dt);
    if (Number.isNaN(start.getTime())) continue;
    if (start.getTime() > today.getTime()) continue; // Only learn from history

    const dayKey = isoDateOnly(start);
    const increment = typeof booking.quantity === "number" && booking.quantity > 0 ? booking.quantity : 1;
    countsByDay.set(dayKey, (countsByDay.get(dayKey) ?? 0) + increment);
  }

  const historicalCounts = Array.from(countsByDay.values());
  const overallMean = mean(historicalCounts);
  const overallStd = standardDeviation(historicalCounts, overallMean);
  const weekdayAverage = getWeekdayAverages(countsByDay);

  const sortedHistoricalDates = Array.from(countsByDay.keys()).sort();
  const sortedCounts = sortedHistoricalDates.map((date) => countsByDay.get(date) ?? 0);
  const smoothedCounts = exponentialMovingAverage(sortedCounts, smoothingFactor);
  const smoothedByDate = new Map<string, number>();
  sortedHistoricalDates.forEach((date, index) => {
    smoothedByDate.set(date, smoothedCounts[index]);
  });

  const points: BusyDayForecastPoint[] = [];
  for (let i = 1; i <= horizonDays; i += 1) {
    const future = new Date(today);
    future.setUTCDate(today.getUTCDate() + i);
    const key = isoDateOnly(future);
    const weekday = future.getUTCDay();

    const weekdayMean = weekdayAverage[weekday];
    let baseline = Number.isFinite(weekdayMean) ? weekdayMean : overallMean;

    if (smoothedByDate.size > 0) {
      const lookbackKey = isoDateOnly(new Date(future.getTime() - 7 * 24 * 60 * 60 * 1000));
      const smoothed = smoothedByDate.get(lookbackKey);
      if (typeof smoothed === "number") {
        baseline = baseline * 0.4 + smoothed * 0.6;
      }
    }

    const expectedBookings = Number.isFinite(baseline) ? baseline : 0;

    const threshold = overallMean + overallStd * 0.5;
    let busyProbability: number;
    if (overallStd === 0) {
      busyProbability = expectedBookings > overallMean ? 0.65 : overallMean === 0 && expectedBookings === 0 ? 0.2 : 0.45;
    } else {
      const zScore = (expectedBookings - threshold) / (overallStd || 1);
      busyProbability = 1 / (1 + Math.exp(-zScore));
    }

    const clippedProbability = Math.max(0, Math.min(1, busyProbability));
    let label: BusyDayLabel = "NORMAL";
    if (clippedProbability >= 0.6) {
      label = "BUSY";
    } else if (clippedProbability <= 0.4) {
      label = "QUIET";
    }

    points.push({
      date: key,
      expectedBookings: Number(expectedBookings.toFixed(2)),
      busyProbability: Number(clippedProbability.toFixed(3)),
      label,
    });
  }

  return {
    generated_at: new Date().toISOString(),
    horizon_days: horizonDays,
    model: "weekday-ema",
    points,
    notes: "Generated locally from booking history via exponential moving averages.",
    usingFallback: true,
  };
}
