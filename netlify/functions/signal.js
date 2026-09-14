const API_BASE = "https://api.realmarketapi.com";

exports.handler = async function (event) {
  try {
    const API_KEY = process.env.MARKET_API_KEY;

    if (!API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          market: "ERROR",
          error: "MARKET_API_KEY is not configured in Netlify"
        })
      };
    }

    const params = event.queryStringParameters || {};

    const symbol = (params.symbol || "EURUSD")
      .replace("/", "")
      .toUpperCase();

    const timeframe = (params.timeframe || "M1").toUpperCase();

    // Get recent market candles
    const url = new URL("/api/v1/candle", API_BASE);

    url.searchParams.set("apiKey", API_KEY);
    url.searchParams.set("symbolCode", symbol);
    url.searchParams.set("timeFrame", timeframe);

    const response = await fetch(url);

    const text = await response.text();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({
          market: "ERROR",
          error: `RealMarketAPI HTTP ${response.status}`,
          details: text.substring(0, 500)
        })
      };
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return {
        statusCode: 500,
        body: JSON.stringify({
          market: "ERROR",
          error: "Invalid response from market API"
        })
      };
    }

    const raw =
      data.items ||
      data.Items ||
      data.data ||
      data.Data ||
      [];

    if (!Array.isArray(raw) || raw.length < 3) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          market: "WAIT",
          source: "RealMarketAPI",
          symbol: symbol,
          timeframe: timeframe,
          signal: "WAIT",
          message: "Not enough live candles"
        })
      };
    }

    const candles = raw
      .map(c => ({
        open: Number(c.openPrice ?? c.OpenPrice ?? c.open ?? c.Open),
        high: Number(c.highPrice ?? c.HighPrice ?? c.high ?? c.High),
        low: Number(c.lowPrice ?? c.LowPrice ?? c.low ?? c.Low),
        close: Number(c.closePrice ?? c.ClosePrice ?? c.close ?? c.Close),
        time: c.openTime ?? c.OpenTime ?? c.time ?? c.Time
      }))
      .filter(c =>
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close)
      );

    if (candles.length < 3) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          market: "WAIT",
          source: "RealMarketAPI",
          symbol,
          timeframe,
          signal: "WAIT",
          message: "Live candle data unavailable"
        })
      };
    }

    // API may return newest first
    candles.sort((a, b) =>
      new Date(a.time || 0) - new Date(b.time || 0)
    );

    const previous = candles[candles.length - 2];
    const current = candles[candles.length - 1];

    let buyScore = 0;
    let sellScore = 0;

    // Candle direction
    if (current.close > current.open) {
      buyScore++;
    }

    if (current.close < current.open) {
      sellScore++;
    }

    // Previous candle confirmation
    if (previous.close > previous.open &&
        current.close > current.open) {
      buyScore++;
    }

    if (previous.close < previous.open &&
        current.close < current.open) {
      sellScore++;
    }

    // Momentum
    if (current.close > previous.close) {
      buyScore++;
    }

    if (current.close < previous.close) {
      sellScore++;
    }

    let signal = "WAIT";

    if (buyScore >= 2 && buyScore > sellScore) {
      signal = "BUY";
    }

    if (sellScore >= 2 && sellScore > buyScore) {
      signal = "SELL";
    }

    const strength =
      Math.round(
        (Math.max(buyScore, sellScore) / 3) * 100
      );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        market: "LIVE",
        source: "RealMarketAPI",
        symbol: symbol,
        timeframe: timeframe,
        signal: signal,
        strength: strength,
        price: current.close,
        candleTime: current.time || null,
        analysis: "Live market candle analysis"
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        market: "ERROR",
        error: error.message
      })
    };
  }
};
