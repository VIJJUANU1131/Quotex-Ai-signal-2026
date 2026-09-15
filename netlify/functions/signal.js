exports.handler = async function (event) {
  try {
    const API_KEY = process.env.MARKET_API_KEY;

    if (!API_KEY) {
      return response(500, {
        market: "ERROR",
        error: "MARKET_API_KEY is not configured in Netlify"
      });
    }

    // EUR/USD is confirmed working with your API key
    const symbol = "EURUSD";

    const url =
      "https://api.realmarketapi.com/api/v1/candle" +
      "?apiKey=" + encodeURIComponent(API_KEY) +
      "&symbolCode=" + encodeURIComponent(symbol) +
      "&timeFrame=M1";

    const apiResponse = await fetch(url);

    const text = await apiResponse.text();

    if (!apiResponse.ok) {
      return response(apiResponse.status, {
        market: "ERROR",
        error: "RealMarketAPI HTTP " + apiResponse.status,
        details: text
      });
    }

    const data = JSON.parse(text);

    // Accept different response structures
    const candles =
      data.items ||
      data.Items ||
      data.data ||
      data.Data ||
      data.candles ||
      data.Candles ||
      [];

    if (!Array.isArray(candles) || candles.length < 10) {
      return response(200, {
        market: "LIVE",
        signal: "WAIT",
        strength: 0,
        price: null,
        source: "RealMarketAPI",
        analysis: "Not enough live candles"
      });
    }

    function getNumber(obj, names) {
      for (const name of names) {
        if (obj[name] !== undefined && obj[name] !== null) {
          const n = Number(obj[name]);
          if (Number.isFinite(n)) return n;
        }
      }
      return null;
    }

    function getTime(obj) {
      return (
        obj.time ||
        obj.Time ||
        obj.timestamp ||
        obj.Timestamp ||
        obj.candleTime ||
        obj.CandleTime ||
        obj.date ||
        obj.Date ||
        0
      );
    }

    const list = candles
      .map(c => ({
        time: getTime(c),
        open: getNumber(c, ["open", "Open", "o"]),
        high: getNumber(c, ["high", "High", "h"]),
        low: getNumber(c, ["low", "Low", "l"]),
        close: getNumber(c, ["close", "Close", "c"])
      }))
      .filter(c =>
        c.open !== null &&
        c.high !== null &&
        c.low !== null &&
        c.close !== null
      )
      .sort((a, b) => new Date(a.time) - new Date(b.time));

    if (list.length < 10) {
      return response(200, {
        market: "LIVE",
        signal: "WAIT",
        strength: 0,
        price: null,
        source: "RealMarketAPI",
        analysis: "Invalid candle data"
      });
    }

    const current = list[list.length - 1];
    const previous = list[list.length - 2];

    const price = current.close;

    // ------------------------------------------------
    // 1M ENTRY ANALYSIS
    // ------------------------------------------------

    let buyScore = 0;
    let sellScore = 0;

    // Current candle direction
    if (current.close > current.open) buyScore += 25;
    if (current.close < current.open) sellScore += 25;

    // Previous candle direction
    if (previous.close > previous.open) buyScore += 15;
    if (previous.close < previous.open) sellScore += 15;

    // Momentum
    if (current.close > previous.close) buyScore += 20;
    if (current.close < previous.close) sellScore += 20;

    // ------------------------------------------------
    // Simple recent trend
    // ------------------------------------------------

    const recent = list.slice(-5);

    let bullish = 0;
    let bearish = 0;

    for (const c of recent) {
      if (c.close > c.open) bullish++;
      if (c.close < c.open) bearish++;
    }

    if (bullish >= 3) buyScore += 20;
    if (bearish >= 3) sellScore += 20;

    // ------------------------------------------------
    // Signal
    // ------------------------------------------------

    let signal = "WAIT";
    let strength = 0;

    if (buyScore > sellScore && buyScore >= 60) {
      signal = "BUY";
      strength = buyScore;
    } else if (sellScore > buyScore && sellScore >= 60) {
      signal = "SELL";
      strength = sellScore;
    } else {
      signal = "WAIT";
      strength = Math.max(buyScore, sellScore);
    }

    // Keep strength realistic
    strength = Math.min(95, Math.max(0, strength));

    return response(200, {
      market: "LIVE",
      symbol: symbol,
      timeframe: "M1",
      trendTimeframe: "M5",
      signal: signal,
      strength: strength,
      price: price,
      candleTime: current.time,
      source: "RealMarketAPI",
      expiry: "1 minute",
      analysis:
        signal === "BUY"
          ? "Bullish 1-minute momentum with trend confirmation"
          : signal === "SELL"
          ? "Bearish 1-minute momentum with trend confirmation"
          : "Market conditions are not strong enough"
    });

  } catch (error) {
    return response(500, {
      market: "ERROR",
      signal: "WAIT",
      strength: 0,
      error: error.message
    });
  }
};


function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type"
    },
    body: JSON.stringify(body)
  };
}
