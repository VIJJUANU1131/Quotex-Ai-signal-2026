exports.handler = async function () {
  try {
    const response = await fetch(
      "https://quotex-otc-backend.onrender.com/api/v1/candles?symbol=EURUSD_otc"
    );

    const data = await response.json();

    if (!response.ok || data.error === "QUOTEX_ACCESS_BLOCKED") {
      return {
        statusCode: 503,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: "OFFLINE",
          market: "QUOTEX_OTC",
          symbol: "EURUSD_otc",
          timeframe: "M1",
          signal: "WAIT",
          strength: 0,
          price: null,
          message: "Quotex OTC live data is currently unavailable."
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status: "ERROR",
        market: "QUOTEX_OTC",
        signal: "WAIT",
        strength: 0,
        price: null,
        message: error.message
      })
    };
  }
};
