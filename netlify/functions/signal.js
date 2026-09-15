const API_BASE = "https://api.realmarketapi.com";

exports.handler = async function (event) {
  try {
    const API_KEY = process.env.MARKET_API_KEY;

    if (!API_KEY) {
      return jsonResponse(500, {
        market: "ERROR",
        error: "MARKET_API_KEY is not configured"
      });
    }

    const params = event.queryStringParameters || {};

    const symbol = (
      params.symbol || "EURUSD"
    )
      .replace("/", "")
      .replace(" ", "")
      .toUpperCase();

    const timeframe = (
      params.timeframe || "M1"
    ).toUpperCase();

    // Free plan supported symbols may be limited.
    // Start with symbols your API key actually accepts.
    const allowedSymbols = [
      "EURUSD",
      "XAUUSD",
      "BTCUSD"
    ];

    if (!allowedSymbols.includes(symbol)) {
      return jsonResponse(400, {
        market: "ERROR",
        error: "This symbol is not enabled for the current API key",
        symbol: symbol,
        supportedSymbols: allowedSymbols
      });
    }

    // =========================
    // FREE REST CANDLE API
    // =========================

    const url = new URL(
      "/api/v1/candle",
      API_BASE
    );

    url.searchParams.set("apiKey", API_KEY);
    url.searchParams.set("symbolCode", symbol);
    url.searchParams.set("timeFrame", timeframe);

    const response = await fetch(
      url.toString(),
      {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      }
    );

    const text = await response.text();

    if (!response.ok) {
      return jsonResponse(response.status, {
        market: "ERROR",
        source: "RealMarketAPI",
        symbol: symbol,
        timeframe: timeframe,
        error:
          `RealMarketAPI HTTP ${response.status}`,
        details: text.substring(0, 1000)
      });
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch (error) {
      return jsonResponse(500, {
        market: "ERROR",
        error: "Invalid JSON from market API",
        details: text.substring(0, 500)
      });
    }

    const raw =
      data.items ||
      data.Items ||
      data.data ||
      data.Data ||
      data.candles ||
      data.Candles ||
      [];

    if (!Array.isArray(raw) || raw.length < 10) {
      return jsonResponse(200, {
        market: "WAIT",
        source: "RealMarketAPI",
        symbol: symbol,
        timeframe: timeframe,
        signal: "WAIT",
        strength: 0,
        message: "Not enough candle data"
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

    if (candles.length < 10) {
      return jsonResponse(200, {
        market: "WAIT",
        symbol: symbol,
        timeframe: timeframe,
        signal: "WAIT",
        strength: 0,
        message: "Not enough valid candles"
      });
    }

    // OLD -> NEW
    candles.sort(function (a, b) {
      return (
        new Date(a.time || 0).getTime() -
        new Date(b.time || 0).getTime()
      );
    });

    // =========================
    // PRICE
    // =========================

    const last =
      candles[candles.length - 1];

    const previous =
      candles[candles.length - 2];

    const price = last.close;

    // =========================
    // EMA
    // =========================

    function calculateEMA(period) {
      if (candles.length < period) {
        return price;
      }

      const k = 2 / (period + 1);

      let ema =
        candles[0].close;

      for (
        let i = 1;
        i < candles.length;
        i++
      ) {
        ema =
          candles[i].close * k +
          ema * (1 - k);
      }

      return ema;
    }

    const ema9 =
      calculateEMA(9);

    const ema21 =
      calculateEMA(21);

    // =========================
    // RSI
    // =========================

    function calculateRSI(period) {
      if (candles.length <= period) {
        return 50;
      }

      let gains = 0;
      let losses = 0;

      for (
        let i = candles.length - period;
        i < candles.length;
        i++
      ) {
        if (i <= 0) continue;

        const change =
          candles[i].close -
          candles[i - 1].close;

        if (change > 0) {
          gains += change;
        } else {
          losses += Math.abs(change);
        }
      }

      if (losses === 0) {
        return 100;
      }

      const rs =
        gains / losses;

      return 100 -
        (100 / (1 + rs));
    }

    const rsi =
      calculateRSI(14);

    // =========================
    // MOMENTUM
    // =========================

    let buyScore = 0;
    let sellScore = 0;

    if (price > ema9) {
      buyScore += 1;
    } else {
      sellScore += 1;
    }

    if (ema9 > ema21) {
      buyScore += 1;
    } else {
      sellScore += 1;
    }

    if (last.close > last.open) {
      buyScore += 1;
    }

    if (last.close < last.open) {
      sellScore += 1;
    }

    if (last.close > previous.close) {
      buyScore += 1;
    }

    if (last.close < previous.close) {
      sellScore += 1;
    }

    // RSI
    if (rsi >= 52 && rsi < 70) {
      buyScore += 1;
    }

    if (rsi <= 48 && rsi > 30) {
      sellScore += 1;
    }

    // =========================
    // FINAL SIGNAL
    // =========================

    let signal = "WAIT";

    if (
      buyScore >= 4 &&
      buyScore > sellScore
    ) {
      signal = "BUY";
    }

    if (
      sellScore >= 4 &&
      sellScore > buyScore
    ) {
      signal = "SELL";
    }

    const maxScore =
      Math.max(
        buyScore,
        sellScore
      );

    let strength =
      Math.round(
        (maxScore / 6) * 100
      );

    strength =
      Math.max(
        0,
        Math.min(100, strength)
      );

    if (signal === "WAIT") {
      strength = 0;
    }

    return jsonResponse(200, {
      market: "LIVE",

      source:
        "RealMarketAPI Candle API",

      symbol:
        symbol,

      timeframe:
        timeframe,

      signal:
        signal,

      strength:
        strength,

      price:
        price,

      ema9:
        Number(ema9.toFixed(6)),

      ema21:
        Number(ema21.toFixed(6)),

      rsi:
        Number(rsi.toFixed(2)),

      buyScore:
        buyScore,

      sellScore:
        sellScore,

      candleTime:
        last.time || null,

      expiry:
        "1 Minute",

      analysis:
        "EMA + RSI + candle momentum",

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
// JSON RESPONSE
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
        "no-store"
    },

    body:
      JSON.stringify(data)
  };
}
