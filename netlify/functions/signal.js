const API_BASE = "https://api.realmarketapi.com";

exports.handler = async function (event) {
  try {
    // =========================
    // API KEY
    // =========================

    const API_KEY = process.env.MARKET_API_KEY;

    if (!API_KEY) {
      return jsonResponse(500, {
        market: "ERROR",
        error: "MARKET_API_KEY is not configured in Netlify"
      });
    }

    // =========================
    // PARAMETERS
    // =========================

    const params = event.queryStringParameters || {};

    let symbol = (
      params.symbol || "EURUSD"
    )
      .replace("/", "")
      .replace(" ", "")
      .toUpperCase();

    const timeframe = (
      params.timeframe || "M1"
    ).toUpperCase();

    // Supported pairs
    const allowedSymbols = [
      "EURUSD",
      "GBPUSD",
      "USDJPY",
      "AUDUSD",
      "USDCAD",
      "EURJPY",
      "GBPJPY"
    ];

    if (!allowedSymbols.includes(symbol)) {
      return jsonResponse(400, {
        market: "ERROR",
        error: "Symbol not supported",
        symbol: symbol,
        supportedSymbols: allowedSymbols
      });
    }

    // =========================
    // MARKET API REQUEST
    // =========================

    const url = new URL(
      "/api/v1/candle",
      API_BASE
    );

    url.searchParams.set(
      "apiKey",
      API_KEY
    );

    url.searchParams.set(
      "symbolCode",
      symbol
    );

    url.searchParams.set(
      "timeFrame",
      timeframe
    );

    const response = await fetch(
      url.toString(),
      {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      }
    );

    const text =
      await response.text();

    // =========================
    // API ERROR
    // =========================

    if (!response.ok) {
      return jsonResponse(
        response.status,
        {
          market: "ERROR",
          source: "RealMarketAPI",
          error:
            `RealMarketAPI HTTP ${response.status}`,
          details:
            text.substring(0, 500)
        }
      );
    }

    // =========================
    // PARSE JSON
    // =========================

    let data;

    try {
      data = JSON.parse(text);
    } catch (error) {
      return jsonResponse(500, {
        market: "ERROR",
        error:
          "Invalid JSON response from market API",
        details:
          text.substring(0, 300)
      });
    }

    // =========================
    // FIND CANDLES
    // =========================

    const raw =
      data.items ||
      data.Items ||
      data.data ||
      data.Data ||
      data.candles ||
      data.Candles ||
      [];

    if (
      !Array.isArray(raw) ||
      raw.length < 3
    ) {
      return jsonResponse(200, {
        market: "WAIT",
        source: "RealMarketAPI",
        symbol: symbol,
        timeframe: timeframe,
        signal: "WAIT",
        strength: 0,
        message:
          "Not enough live candles"
      });
    }

    // =========================
    // NORMALIZE CANDLES
    // =========================

    const candles = raw
      .map(function (c) {

        return {
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
          ),

          time:
            c.openTime ??
            c.OpenTime ??
            c.time ??
            c.Time
        };

      })
      .filter(function (c) {

        return (
          Number.isFinite(c.open) &&
          Number.isFinite(c.high) &&
          Number.isFinite(c.low) &&
          Number.isFinite(c.close)
        );

      });

    if (candles.length < 3) {
      return jsonResponse(200, {
        market: "WAIT",
        source: "RealMarketAPI",
        symbol: symbol,
        timeframe: timeframe,
        signal: "WAIT",
        strength: 0,
        message:
          "Live candle data unavailable"
      });
    }

    // =========================
    // SORT OLD → NEW
    // =========================

    candles.sort(function (a, b) {

      const ta =
        new Date(a.time || 0).getTime();

      const tb =
        new Date(b.time || 0).getTime();

      return ta - tb;

    });

    // =========================
    // USE LAST 3 CANDLES
    // =========================

    const c1 =
      candles[candles.length - 3];

    const c2 =
      candles[candles.length - 2];

    const c3 =
      candles[candles.length - 1];

    // =========================
    // SCORE SYSTEM
    // =========================

    let buyScore = 0;
    let sellScore = 0;

    // Candle 1
    if (c1.close > c1.open) {
      buyScore += 1;
    }

    if (c1.close < c1.open) {
      sellScore += 1;
    }

    // Candle 2
    if (c2.close > c2.open) {
      buyScore += 1;
    }

    if (c2.close < c2.open) {
      sellScore += 1;
    }

    // Candle 3
    if (c3.close > c3.open) {
      buyScore += 2;
    }

    if (c3.close < c3.open) {
      sellScore += 2;
    }

    // =========================
    // MOMENTUM
    // =========================

    if (c3.close > c2.close) {
      buyScore += 1;
    }

    if (c3.close < c2.close) {
      sellScore += 1;
    }

    // =========================
    // HIGHER-HIGH / LOWER-LOW
    // =========================

    if (
      c3.high > c2.high &&
      c3.low >= c2.low
    ) {
      buyScore += 1;
    }

    if (
      c3.low < c2.low &&
      c3.high <= c2.high
    ) {
      sellScore += 1;
    }

    // =========================
    // BODY STRENGTH
    // =========================

    const body =
      Math.abs(
        c3.close - c3.open
      );

    const range =
      c3.high - c3.low;

    if (range > 0) {

      const bodyPercent =
        (body / range) * 100;

      if (
        bodyPercent >= 60 &&
        c3.close > c3.open
      ) {
        buyScore += 1;
      }

      if (
        bodyPercent >= 60 &&
        c3.close < c3.open
      ) {
        sellScore += 1;
      }
    }

    // =========================
    // FINAL SIGNAL
    // =========================

    let signal = "WAIT";

    const maxScore =
      Math.max(
        buyScore,
        sellScore
      );

    // Need minimum confirmation
    if (
      buyScore >= 5 &&
      buyScore > sellScore
    ) {
      signal = "BUY";
    }

    if (
      sellScore >= 5 &&
      sellScore > buyScore
    ) {
      signal = "SELL";
    }

    // =========================
    // STRENGTH
    // =========================

    const maxPossibleScore = 9;

    let strength =
      Math.round(
        (maxScore /
          maxPossibleScore) *
        100
      );

    strength =
      Math.max(
        0,
        Math.min(
          100,
          strength
        )
      );

    // Don't show fake high strength
    if (signal === "WAIT") {
      strength = 0;
    }

    // =========================
    // RESULT
    // =========================

    return jsonResponse(200, {

      market: "LIVE",

      source:
        "RealMarketAPI",

      symbol:
        symbol,

      timeframe:
        timeframe,

      signal:
        signal,

      strength:
        strength,

      price:
        c3.close,

      candleTime:
        c3.time || null,

      candlesUsed:
        candles.length,

      buyScore:
        buyScore,

      sellScore:
        sellScore,

      expiry:
        "1 Minute",

      analysis:
        "Live candle momentum and price-action analysis",

      message:
        signal === "WAIT"
          ? "Waiting for stronger confirmation"
          : `${signal} signal generated`

    });

  } catch (error) {

    console.error(
      "Signal function error:",
      error
    );

    return jsonResponse(500, {
      market: "ERROR",
      error:
        error.message ||
        "Unknown server error"
    });

  }
};


// =========================
// JSON RESPONSE HELPER
// =========================

function jsonResponse(
  statusCode,
  data
) {

  return {
    statusCode: statusCode,

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
        "no-store, no-cache, must-revalidate, proxy-revalidate"
    },

    body:
      JSON.stringify(data)

  };

}
