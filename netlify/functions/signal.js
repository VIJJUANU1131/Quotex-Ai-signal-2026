const API_BASE = "https://api.realmarketapi.com";

exports.handler = async function (event) {
  try {
    const API_KEY = process.env.MARKET_API_KEY;

    if (!API_KEY) {
      return jsonResponse(500, {
        market: "ERROR",
        error: "MARKET_API_KEY is not configured in Netlify"
      });
    }

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

    const allowedSymbols = [
      "EURUSD",
      "GBPUSD",
      "USDJPY",
      "AUDUSD",
      "USDCAD",
      "EURJPY",
      "GBPJPY",
      "XAUUSD",
      "BTCUSD"
    ];

    if (!allowedSymbols.includes(symbol)) {
      return jsonResponse(400, {
        market: "ERROR",
        error: "Symbol not supported by website",
        symbol: symbol,
        supportedSymbols: allowedSymbols
      });
    }

    // =========================
    // REAL MARKET INSIGHT API
    // =========================

    const url = new URL(
      "/api/v1/insight/next",
      API_BASE
    );

    url.searchParams.set("apiKey", API_KEY);
    url.searchParams.set("SymbolCode", symbol);
    url.searchParams.set("TimeFrame", timeframe);

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

    // =========================
    // API ERROR
    // =========================

    if (!response.ok) {
      return jsonResponse(response.status, {
        market: "ERROR",
        source: "RealMarketAPI",
        symbol: symbol,
        timeframe: timeframe,
        error:
          `RealMarketAPI HTTP ${response.status}`,
        details:
          text.substring(0, 1000)
      });
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
        source: "RealMarketAPI",
        error: "Invalid JSON response",
        details: text.substring(0, 500)
      });
    }

    // =========================
    // READ API VALUES
    // =========================

    const price = Number(
      data.price ?? 0
    );

    const ema21 = Number(
      data.ema21 ?? 0
    );

    const ema50 = Number(
      data.ema50 ?? 0
    );

    const rsi = Number(
      data.rsi ?? 0
    );

    const atr = Number(
      data.atr ?? 0
    );

    const volume = Number(
      data.volume ?? 0
    );

    const avgVolume = Number(
      data.avgVolume ?? 0
    );

    const support = Number(
      data.support ?? 0
    );

    const resistance = Number(
      data.resistance ?? 0
    );

    const bullScore = Number(
      data.bullScore ?? 0
    );

    const bearScore = Number(
      data.bearScore ?? 0
    );

    const bias =
      data.bias || "Neutral";

    // =========================
    // SIGNAL ENGINE
    // =========================

    let buyScore = bullScore;
    let sellScore = bearScore;

    // EMA trend confirmation
    if (
      price > ema21 &&
      ema21 > ema50
    ) {
      buyScore += 1;
    }

    if (
      price < ema21 &&
      ema21 < ema50
    ) {
      sellScore += 1;
    }

    // RSI confirmation
    if (
      rsi >= 50 &&
      rsi < 70
    ) {
      buyScore += 1;
    }

    if (
      rsi <= 50 &&
      rsi > 30
    ) {
      sellScore += 1;
    }

    // Volume confirmation
    if (
      avgVolume > 0 &&
      volume > avgVolume
    ) {
      if (buyScore > sellScore) {
        buyScore += 1;
      }

      if (sellScore > buyScore) {
        sellScore += 1;
      }
    }

    // Support / resistance
    if (
      support > 0 &&
      price > support &&
      price < resistance
    ) {
      if (bias === "Bullish") {
        buyScore += 1;
      }

      if (bias === "Bearish") {
        sellScore += 1;
      }
    }

    // =========================
    // FINAL SIGNAL
    // =========================

    let signal = "WAIT";

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

    const maxScore =
      Math.max(
        buyScore,
        sellScore
      );

    const totalScore =
      buyScore + sellScore;

    let strength = 0;

    if (signal !== "WAIT") {
      strength = Math.round(
        (
          maxScore /
          Math.max(totalScore, 1)
        ) * 100
      );
    }

    strength = Math.max(
      0,
      Math.min(100, strength)
    );

    // =========================
    // ANALYSIS TEXT
    // =========================

    let analysis =
      "Waiting for stronger confirmation";

    if (signal === "BUY") {
      analysis =
        "Bullish trend confirmed by market insight, EMA and momentum";
    }

    if (signal === "SELL") {
      analysis =
        "Bearish trend confirmed by market insight, EMA and momentum";
    }

    // =========================
    // RESPONSE
    // =========================

    return jsonResponse(200, {

      market: "LIVE",

      source:
        "RealMarketAPI Insight",

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

      ema21:
        ema21,

      ema50:
        ema50,

      rsi:
        rsi,

      atr:
        atr,

      volume:
        volume,

      avgVolume:
        avgVolume,

      support:
        support,

      resistance:
        resistance,

      bias:
        bias,

      bullScore:
        bullScore,

      bearScore:
        bearScore,

      calculatedAt:
        data.calculatedAt || null,

      targetUp:
        data.targetUp ?? null,

      targetDown:
        data.targetDown ?? null,

      expiry:
        "1 Minute",

      analysis:
        analysis,

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
        "no-store, no-cache, must-revalidate, proxy-revalidate"
    },

    body:
      JSON.stringify(data)
  };
}
