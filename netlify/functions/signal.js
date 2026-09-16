const API_BASE = "https://api.realmarketapi.com";

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};

  const symbol = (params.symbol || "EURUSD")
    .replace("/", "")
    .toUpperCase();

  const timeframe = (params.timeframe || "M1").toUpperCase();

  const apiKey = process.env.MARKET_API_KEY;

  if (!apiKey) {
    return response(500, {
      status: "ERROR",
      message: "MARKET_API_KEY is not configured"
    });
  }

  try {
    const url =
      `${API_BASE}/api/v1/candle` +
      `?apiKey=${encodeURIComponent(apiKey)}` +
      `&symbolCode=${encodeURIComponent(symbol)}` +
      `&timeFrame=${encodeURIComponent(timeframe)}`;

    const apiResponse = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    const text = await apiResponse.text();

    if (!apiResponse.ok) {
      return response(apiResponse.status, {
        status: "ERROR",
        market: "REAL",
        source: "RealMarketAPI",
        symbol,
        timeframe,
        message: `RealMarketAPI HTTP ${apiResponse.status}`,
        details: text
      });
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return response(500, {
        status: "ERROR",
        message: "Invalid JSON received from RealMarketAPI"
      });
    }

    const raw =
      data.items ||
      data.Items ||
      data.data ||
      data.Data ||
      [];

    if (!Array.isArray(raw) || raw.length < 15) {
      return response(200, {
        status: "WAIT",
        market: "REAL",
        source: "RealMarketAPI",
        symbol,
        timeframe,
        message: "Not enough candles for analysis"
      });
    }

    const candles = raw
      .map(c => ({
        time:
          c.time ??
          c.Time ??
          c.timestamp ??
          c.Timestamp,

        open: Number(
          c.openPrice ??
          c.OpenPrice ??
          c.open ??
          c.Open
        ),

        high: Number(
          c.highPrice ??
          c.HighPrice ??
          c.high ??
          c.High
        ),

        low: Number(
          c.lowPrice ??
          c.LowPrice ??
          c.low ??
          c.Low
        ),

        close: Number(
          c.closePrice ??
          c.ClosePrice ??
          c.close ??
          c.Close
        )
      }))
      .filter(c =>
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close)
      )
      .sort((a, b) => {
        const ta = new Date(a.time).getTime();
        const tb = new Date(b.time).getTime();
        return ta - tb;
      });

    if (candles.length < 15) {
      return response(200, {
        status: "WAIT",
        market: "REAL",
        source: "RealMarketAPI",
        symbol,
        timeframe,
        message: "Not enough valid candles"
      });
    }

    // ----------------------------------------
    // EMA
    // ----------------------------------------

    function calculateEMA(values, period) {
      if (values.length < period) {
        return null;
      }

      const multiplier = 2 / (period + 1);

      let ema = 0;

      for (let i = 0; i < period; i++) {
        ema += values[i];
      }

      ema = ema / period;

      for (let i = period; i < values.length; i++) {
        ema =
          (values[i] - ema) * multiplier +
          ema;
      }

      return ema;
    }

    // ----------------------------------------
    // RSI
    // ----------------------------------------

    function calculateRSI(values, period = 14) {
      if (values.length <= period) {
        return null;
      }

      let gains = 0;
      let losses = 0;

      for (let i = 1; i <= period; i++) {
        const change =
          values[i] - values[i - 1];

        if (change > 0) {
          gains += change;
        } else {
          losses += Math.abs(change);
        }
      }

      let averageGain = gains / period;
      let averageLoss = losses / period;

      for (
        let i = period + 1;
        i < values.length;
        i++
      ) {
        const change =
          values[i] - values[i - 1];

        const gain =
          change > 0 ? change : 0;

        const loss =
          change < 0 ? Math.abs(change) : 0;

        averageGain =
          ((averageGain * (period - 1)) + gain) /
          period;

        averageLoss =
          ((averageLoss * (period - 1)) + loss) /
          period;
      }

      if (averageLoss === 0) {
        return 100;
      }

      const rs =
        averageGain / averageLoss;

      return 100 - (100 / (1 + rs));
    }

    const closes =
      candles.map(c => c.close);

    const ema5 =
      calculateEMA(closes, 5);

    const ema13 =
      calculateEMA(closes, 13);

    const rsi =
      calculateRSI(closes, 14);

    const current =
      candles[candles.length - 1];

    const previous =
      candles[candles.length - 2];

    const previous2 =
      candles[candles.length - 3];

    // ----------------------------------------
    // Candle calculations
    // ----------------------------------------

    const currentBull =
      current.close > current.open;

    const currentBear =
      current.close < current.open;

    const previousBull =
      previous.close > previous.open;

    const previousBear =
      previous.close < previous.open;

    const body =
      Math.abs(
        current.close - current.open
      );

    const range =
      current.high - current.low;

    const bodyRatio =
      range > 0
        ? body / range
        : 0;

    const momentum =
      current.close - previous.close;

    const previousMomentum =
      previous.close - previous2.close;

    // ----------------------------------------
    // Scoring
    // ----------------------------------------

    let buyScore = 0;
    let sellScore = 0;

    // EMA trend
    if (ema5 !== null && ema13 !== null) {

      if (ema5 > ema13) {
        buyScore += 3;
      }

      if (ema5 < ema13) {
        sellScore += 3;
      }
    }

    // Price vs EMA
    if (ema5 !== null) {

      if (current.close > ema5) {
        buyScore += 1;
      }

      if (current.close < ema5) {
        sellScore += 1;
      }
    }

    // RSI
    if (rsi !== null) {

      if (rsi >= 52 && rsi <= 68) {
        buyScore += 2;
      }

      if (rsi <= 48 && rsi >= 32) {
        sellScore += 2;
      }

      // Avoid chasing extreme conditions
      if (rsi > 72) {
        sellScore += 1;
      }

      if (rsi < 28) {
        buyScore += 1;
      }
    }

    // Current candle
    if (currentBull) {
      buyScore += 2;
    }

    if (currentBear) {
      sellScore += 2;
    }

    // Previous candle confirmation
    if (previousBull) {
      buyScore += 1;
    }

    if (previousBear) {
      sellScore += 1;
    }

    // Momentum
    if (momentum > 0) {
      buyScore += 2;
    }

    if (momentum < 0) {
      sellScore += 2;
    }

    // Momentum continuation
    if (
      momentum > 0 &&
      previousMomentum > 0
    ) {
      buyScore += 1;
    }

    if (
      momentum < 0 &&
      previousMomentum < 0
    ) {
      sellScore += 1;
    }

    // Strong candle body
    if (bodyRatio >= 0.55) {

      if (currentBull) {
        buyScore += 1;
      }

      if (currentBear) {
        sellScore += 1;
      }
    }

    // ----------------------------------------
    // Final signal
    // ----------------------------------------

    let signal = "WAIT";
    let strength = 50;

    const difference =
      Math.abs(
        buyScore - sellScore
      );

    if (
      buyScore >= 7 &&
      buyScore > sellScore &&
      difference >= 2
    ) {

      signal = "BUY";

      strength =
        Math.min(
          95,
          70 + difference * 4
        );
    }

    else if (
      sellScore >= 7 &&
      sellScore > buyScore &&
      difference >= 2
    ) {

      signal = "SELL";

      strength =
        Math.min(
          95,
          70 + difference * 4
        );
    }

    return response(200, {

      status: "success",

      market: "REAL",

      source: "RealMarketAPI",

      symbol,

      timeframe,

      signal,

      strength,

      price: current.close,

      candleTime: current.time,

      indicators: {
        ema5:
          Number(ema5?.toFixed(6)),

        ema13:
          Number(ema13?.toFixed(6)),

        rsi:
          Number(rsi?.toFixed(2)),

        buyScore,

        sellScore,

        candleDirection:
          currentBull
            ? "BULLISH"
            : currentBear
              ? "BEARISH"
              : "NEUTRAL"
      },

      analysis:
        "Live market candle analysis using EMA, RSI, momentum and candle confirmation"

    });

  } catch (error) {

    return response(500, {

      status: "ERROR",

      market: "REAL",

      source: "RealMarketAPI",

      symbol,

      timeframe,

      message: error.message

    });
  }
};


// ----------------------------------------
// RESPONSE
// ----------------------------------------

function response(statusCode, body) {

  return {

    statusCode,

    headers: {

      "Content-Type":
        "application/json",

      "Access-Control-Allow-Origin":
        "*",

      "Access-Control-Allow-Methods":
        "GET, OPTIONS",

      "Access-Control-Allow-Headers":
        "Content-Type",

      "Cache-Control":
        "no-store, no-cache, must-revalidate"

    },

    body:
      JSON.stringify(body)

  };
}
