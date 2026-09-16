const API_BASE = "https://api.realmarketapi.com";

exports.handler = async (event) => {

  const params = event.queryStringParameters || {};

  const symbol = (params.symbol || "EURUSD")
    .replace("/", "")
    .toUpperCase();

  const timeframe = (params.timeframe || "M1")
    .toUpperCase();

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

    if (!Array.isArray(raw) || raw.length < 20) {

      return response(200, {
        status: "WAIT",
        market: "REAL",
        source: "RealMarketAPI",
        symbol,
        timeframe,
        message: "Not enough candles"
      });
    }

    /* ===============================
       CANDLE DATA
    =============================== */

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

        return new Date(a.time).getTime() -
               new Date(b.time).getTime();

      });


    if (candles.length < 20) {

      return response(200, {
        status: "WAIT",
        message: "Not enough valid candles"
      });

    }


    /* ===============================
       EMA
    =============================== */

    function EMA(values, period) {

      if (values.length < period) {
        return null;
      }

      const multiplier =
        2 / (period + 1);

      let ema = 0;

      for (let i = 0; i < period; i++) {
        ema += values[i];
      }

      ema /= period;

      for (let i = period; i < values.length; i++) {

        ema =
          (values[i] - ema) *
          multiplier +
          ema;

      }

      return ema;
    }


    /* ===============================
       RSI
    =============================== */

    function RSI(values, period = 14) {

      if (values.length <= period) {
        return null;
      }

      let gain = 0;
      let loss = 0;

      for (let i = 1; i <= period; i++) {

        const change =
          values[i] - values[i - 1];

        if (change > 0) {
          gain += change;
        } else {
          loss += Math.abs(change);
        }

      }

      let avgGain =
        gain / period;

      let avgLoss =
        loss / period;


      for (
        let i = period + 1;
        i < values.length;
        i++
      ) {

        const change =
          values[i] - values[i - 1];

        const currentGain =
          change > 0 ? change : 0;

        const currentLoss =
          change < 0
            ? Math.abs(change)
            : 0;

        avgGain =
          ((avgGain * (period - 1)) +
            currentGain) / period;

        avgLoss =
          ((avgLoss * (period - 1)) +
            currentLoss) / period;

      }


      if (avgLoss === 0) {
        return 100;
      }

      const rs =
        avgGain / avgLoss;

      return 100 -
        (100 / (1 + rs));

    }


    /* ===============================
       LAST CLOSED CANDLES
    =============================== */

    const last =
      candles[candles.length - 1];

    const prev =
      candles[candles.length - 2];

    const prev2 =
      candles[candles.length - 3];

    const prev3 =
      candles[candles.length - 4];


    const closes =
      candles.map(c => c.close);


    const ema5 =
      EMA(closes, 5);

    const ema13 =
      EMA(closes, 13);

    const rsi =
      RSI(closes, 14);


    /* ===============================
       CANDLE DIRECTION
    =============================== */

    const lastBull =
      last.close > last.open;

    const lastBear =
      last.close < last.open;

    const prevBull =
      prev.close > prev.open;

    const prevBear =
      prev.close < prev.open;

    const prev2Bull =
      prev2.close > prev2.open;

    const prev2Bear =
      prev2.close < prev2.open;


    /* ===============================
       MOMENTUM
    =============================== */

    const momentum1 =
      last.close - prev.close;

    const momentum2 =
      prev.close - prev2.close;

    const momentum3 =
      prev2.close - prev3.close;


    /* ===============================
       BODY STRENGTH
    =============================== */

    const range =
      last.high - last.low;

    const body =
      Math.abs(
        last.close -
        last.open
      );

    const bodyRatio =
      range > 0
        ? body / range
        : 0;


    /* ===============================
       NEXT CANDLE ANALYSIS
    =============================== */

    let upScore = 0;
    let downScore = 0;


    /* EMA TREND */

    if (
      ema5 !== null &&
      ema13 !== null
    ) {

      if (ema5 > ema13) {
        upScore += 3;
      }

      if (ema5 < ema13) {
        downScore += 3;
      }

    }


    /* PRICE vs EMA */

    if (ema5 !== null) {

      if (last.close > ema5) {
        upScore += 2;
      }

      if (last.close < ema5) {
        downScore += 2;
      }

    }


    /* RSI */

    if (rsi !== null) {

      if (
        rsi >= 52 &&
        rsi <= 68
      ) {
        upScore += 2;
      }

      if (
        rsi >= 32 &&
        rsi <= 48
      ) {
        downScore += 2;
      }

      /*
        Strong extreme conditions
      */

      if (rsi < 30) {
        upScore += 1;
      }

      if (rsi > 70) {
        downScore += 1;
      }

    }


    /* CANDLE CONFIRMATION */

    if (lastBull) {
      upScore += 2;
    }

    if (lastBear) {
      downScore += 2;
    }


    if (prevBull) {
      upScore += 1;
    }

    if (prevBear) {
      downScore += 1;
    }


    /* TWO CANDLE CONFIRMATION */

    if (
      lastBull &&
      prevBull
    ) {
      upScore += 2;
    }

    if (
      lastBear &&
      prevBear
    ) {
      downScore += 2;
    }


    /* MOMENTUM */

    if (momentum1 > 0) {
      upScore += 2;
    }

    if (momentum1 < 0) {
      downScore += 2;
    }


    if (
      momentum1 > 0 &&
      momentum2 > 0
    ) {
      upScore += 2;
    }

    if (
      momentum1 < 0 &&
      momentum2 < 0
    ) {
      downScore += 2;
    }


    if (
      momentum1 > 0 &&
      momentum2 > 0 &&
      momentum3 > 0
    ) {
      upScore += 1;
    }

    if (
      momentum1 < 0 &&
      momentum2 < 0 &&
      momentum3 < 0
    ) {
      downScore += 1;
    }


    /* STRONG CANDLE */

    if (bodyRatio >= 0.55) {

      if (lastBull) {
        upScore += 1;
      }

      if (lastBear) {
        downScore += 1;
      }

    }


    /* ===============================
       FINAL NEXT CANDLE PREDICTION
    =============================== */

    let signal =
      "WAIT";

    let nextCandle =
      "WAIT";

    let strength =
      50;


    const difference =
      Math.abs(
        upScore -
        downScore
      );


    /*
      Only signal when
      confirmation is strong.
    */

    if (
      upScore >= 8 &&
      upScore > downScore &&
      difference >= 3
    ) {

      signal =
        "BUY";

      nextCandle =
        "UP";

      strength =
        Math.min(
          95,
          70 + difference * 3
        );

    }

    else if (
      downScore >= 8 &&
      downScore > upScore &&
      difference >= 3
    ) {

      signal =
        "SELL";

      nextCandle =
        "DOWN";

      strength =
        Math.min(
          95,
          70 + difference * 3
        );

    }


    /* ===============================
       RESPONSE
    =============================== */

    return response(200, {

      status:
        "success",

      market:
        "REAL",

      source:
        "RealMarketAPI",

      symbol,

      timeframe,

      signal,

      nextCandle,

      strength,

      price:
        last.close,

      candleTime:
        last.time,

      indicators: {

        ema5:
          Number(
            ema5?.toFixed(6)
          ),

        ema13:
          Number(
            ema13?.toFixed(6)
          ),

        rsi:
          Number(
            rsi?.toFixed(2)
          ),

        upScore,

        downScore,

        difference,

        candleDirection:
          lastBull
            ? "UP"
            : lastBear
              ? "DOWN"
              : "NEUTRAL"

      },

      analysis:
        "Next 1-minute candle direction analyzed using EMA, RSI, momentum and candle confirmation"

    });


  } catch (error) {

    return response(500, {

      status:
        "ERROR",

      market:
        "REAL",

      source:
        "RealMarketAPI",

      symbol,

      timeframe,

      message:
        error.message

    });

  }

};


/* ===============================
   RESPONSE
=============================== */

function response(
  statusCode,
  body
) {

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
