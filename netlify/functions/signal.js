exports.handler = async function (event) {

  try {

    const params = event.queryStringParameters || {};

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
          message: "Unsupported OTC pair"
        })
      };

    }

    const backendURL =
      "https://quotex-otc-backend.onrender.com/api/v1/candles?symbol=" +
      encodeURIComponent(symbol);

    const response = await fetch(backendURL);

    const data = await response.json();

    console.log("Backend response:", data);

    if (
      !response.ok ||
      data.error === "QUOTEX_ACCESS_BLOCKED" ||
      data.connection === "NOT_CONNECTED"
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
            "Real Quotex OTC data is unavailable."
        })
      };

    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(data)
    };

  } catch (error) {

    console.error(error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        status: "ERROR",
        market: "QUOTEX_OTC",
        timeframe: "M1",
        signal: "WAIT",
        strength: 0,
        price: null,
        message: error.message
      })
    };

  }

};
