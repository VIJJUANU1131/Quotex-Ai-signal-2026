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

    const res = await fetch(url);

    const text = await res.text();

    if (!res.ok) {
      return response(res.status, {
        status: "ERROR",
        market: "REAL",
        source: "RealMarketAPI",
        symbol,
        timeframe,
        message: `RealMarketAPI HTTP ${res.status}`,
        details: text
      });
    }

    const data = JSON.parse(text);

    const raw =
      data.items ||
      data.Items ||
      data.data ||
      data.Data ||
      [];

    if (!Array.isArray(raw) || raw.length < 3) {
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
        time: c.time || c.Time || c.timestamp || c.Timestamp,
        open: Number(c.openPrice ?? c.OpenPrice ?? c.open ?? c.Open),
        high: Number(c.highPrice ?? c.HighPrice ?? c.high ?? c.High),
        low: Number(c.lowPrice ?? c.LowPrice ?? c.low ?? c.Low),
        close: Number(c.closePrice ?? c.ClosePrice ?? c.close ?? c.Close)
      }))
      .filter(c =>
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close)
      )
      .sort((a, b) =>
        new Date(a.time) - new Date(b.time)
      );

    if (candles.length < 3) {
      return response(200, {
        status: "WAIT",
        market: "REAL",
        source: "RealMarketAPI",
        symbol,
        timeframe,
        message: "Not enough valid candles"
      });
    }

    const current = candles[candles.length - 1];
    const previous = candles[candles.length - 2];

    let buyScore = 0;
    let sellScore = 0;

    // Current candle direction
    if (current.close > current.open) {
      buyScore += 2;
    } else if (current.close < current.open) {
      sellScore += 2;
    }

    // Previous candle confirmation
    if (previous.close > previous.open) {
      buyScore += 1;
    } else if (previous.close < previous.open) {
      sellScore += 1;
    }

    // Momentum
    const priceChange = current.close - previous.close;

    if (priceChange > 0) {
      buyScore += 2;
    } else if (priceChange < 0) {
      sellScore += 2;
    }

    let signal = "WAIT";
    let strength = 50;

    if (buyScore >= 4 && buyScore > sellScore) {
      signal = "BUY";
      strength = Math.min(95, 70 + buyScore * 5);
    }

    if (sellScore >= 4 && sellScore > buyScore) {
      signal = "SELL";
      strength = Math.min(95, 70 + sellScore * 5);
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
      analysis: "Live candle momentum analysis"
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

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}
