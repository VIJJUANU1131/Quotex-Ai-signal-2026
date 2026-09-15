exports.handler = async function (event) {
  try {
    const params = event.queryStringParameters || {};

    // User selected pair
    const symbol = params.symbol || "AUDNZD_otc";

    const allowedPairs = [
      "AUDNZD_otc",
      "GBPNZD_otc",
      "NZDCAD_otc",
      "NZDUSD_otc",
      "USDBRL_otc",
      "USDDZD_otc",
      "USDEGP_otc",
      "USDNGN_otc",
      "USDCOP_otc",
      "USDBDT_otc",
      "USDPHP_otc"
    ];

    // Prevent unsupported symbols
    if (!allowedPairs.includes(symbol)) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          status: "ERROR",
          market: "QUOTEX_OTC",
          symbol: symbol,
          timeframe: "M1",
          signal: "WAIT",
          strength: 0,
          price: null,
          message: "This OTC pair is not in the current configured list."
        })
      };
    }

    const apiUrl =
      "https://quotex-otc-backend.onrender.com/api/v1/candles?symbol=" +
      encodeURIComponent(symbol);

    const response = await fetch(apiUrl);

    const data = await response.json();

    // Backend says Quotex access is blocked
    if (
      !response.ok ||
      data.error === "QUOTEX_ACCESS_BLOCKED"
    ) {
      return {
        statusCode: 503,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          status: "OFFLINE",
          market: "QUOTEX_OTC",
          symbol: symbol,
          timeframe: "M1",
          signal: "WAIT",
          strength: 0,
          price: null,
          message:
            "Quotex OTC live data is unavailable. No fake signal generated."
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        ...data,
        symbol: symbol,
        market: "QUOTEX_OTC",
        timeframe: "M1"
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
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
