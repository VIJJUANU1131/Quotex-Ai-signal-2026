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

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Quotex AI Signal - Live 1 Minute</title>

<style>
*{
  box-sizing:border-box;
  margin:0;
  padding:0;
  font-family:Arial,sans-serif;
}

body{
  background:#07111f;
  color:white;
  padding:12px;
}

.container{
  max-width:1100px;
  margin:auto;
}

h1{
  text-align:center;
  color:#00e0ff;
  margin:10px 0 5px;
}

.sub{
  text-align:center;
  color:#9db3c8;
  margin-bottom:18px;
}

.grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(170px,1fr));
  gap:12px;
}

.card{
  background:#111c2c;
  border:1px solid #22334a;
  border-radius:14px;
  padding:16px;
}

.label{
  color:#8fa4b8;
  font-size:13px;
  margin-bottom:8px;
}

.value{
  font-size:23px;
  font-weight:bold;
}

.buy{
  color:#00ff88;
}

.sell{
  color:#ff4d67;
}

.win{
  color:#00ff88;
}

.loss{
  color:#ff4d67;
}

.rate{
  color:#00d4ff;
}

.live{
  color:#00ff88;
}

.wait{
  color:#ffd166;
}

.error{
  color:#ff6b6b;
}

select,
button{
  width:100%;
  padding:13px;
  border-radius:10px;
  border:none;
  margin-top:6px;
  font-size:16px;
}

select{
  background:#18263a;
  color:white;
}

button{
  background:#00d4ff;
  color:#001019;
  font-weight:bold;
  cursor:pointer;
}

button:disabled{
  opacity:.55;
  cursor:wait;
}

.signal-box{
  margin-top:16px;
  text-align:center;
  padding:22px;
  border-radius:14px;
  background:#101d2c;
  border:1px solid #22334a;
}

.signal{
  font-size:46px;
  font-weight:bold;
  margin:12px 0;
}

.countdown{
  font-size:40px;
  margin:8px 0 15px;
  color:#00d4ff;
  font-weight:bold;
}

.price{
  font-size:24px;
  margin:8px;
}

.strength{
  font-size:18px;
  font-weight:bold;
}

.status{
  margin:9px 0;
  font-size:14px;
}

.history-card{
  margin-top:16px;
  overflow-x:auto;
}

table{
  width:100%;
  border-collapse:collapse;
  margin-top:10px;
  min-width:700px;
}

th,
td{
  padding:9px;
  border-bottom:1px solid #26374e;
  text-align:center;
  font-size:13px;
}

th{
  color:#00d4ff;
}

.notice{
  margin-top:16px;
  padding:12px;
  border-radius:10px;
  background:#1c2636;
  color:#ffcc66;
  font-size:12px;
  line-height:1.5;
}

.badge{
  display:inline-block;
  padding:5px 10px;
  border-radius:20px;
  background:#162b3d;
  color:#00d4ff;
  font-size:12px;
}

@media(max-width:600px){

  body{
    padding:8px;
  }

  .signal{
    font-size:38px;
  }

  .countdown{
    font-size:32px;
  }

  .value{
    font-size:20px;
  }
}
</style>
</head>

<body>

<div class="container">

<h1>Quotex AI Signal</h1>

<div class="sub">
LIVE Market Analysis •
<span class="badge">1 MINUTE</span>
</div>


<!-- =========================
     WIN / LOSS DISPLAY
========================= -->

<div class="grid">

  <div class="card">

    <div class="label">
      WIN
    </div>

    <div
      class="value win"
      id="winCount">
      0
    </div>

  </div>


  <div class="card">

    <div class="label">
      LOSS
    </div>

    <div
      class="value loss"
      id="lossCount">
      0
    </div>

  </div>


  <div class="card">

    <div class="label">
      WIN RATE
    </div>

    <div
      class="value rate"
      id="winRate">
      0%
    </div>

  </div>

</div>


<!-- =========================
     MARKET INFORMATION
========================= -->

<div
  class="grid"
  style="margin-top:12px;">

  <div class="card">

    <div class="label">
      Currency Pair
    </div>

    <select id="pair">

      <option value="EURUSD">
        EUR/USD
      </option>

      <option value="GBPUSD">
        GBP/USD
      </option>

      <option value="USDJPY">
        USD/JPY
      </option>

      <option value="AUDUSD">
        AUD/USD
      </option>

      <option value="USDCAD">
        USD/CAD
      </option>

      <option value="EURJPY">
        EUR/JPY
      </option>

      <option value="GBPJPY">
        GBP/JPY
      </option>

    </select>

  </div>


  <div class="card">

    <div class="label">
      Time Frame
    </div>

    <div class="value">
      1 Minute
    </div>

  </div>


  <div class="card">

    <div class="label">
      Indian Time
    </div>

    <div
      class="value"
      id="indiaTime">
      --:--:--
    </div>

  </div>


  <div class="card">

    <div class="label">
      Market Status
    </div>

    <div
      class="value live"
      id="marketStatus">
      LIVE
    </div>

  </div>

</div>


<!-- =========================
     CURRENT SIGNAL
========================= -->

<div class="signal-box">

  <div class="label">
    CURRENT LIVE SIGNAL
  </div>


  <div
    id="signal"
    class="signal wait">
    WAIT
  </div>


  <div
    id="price"
    class="price">
    Price: --
  </div>


  <div
    id="strength"
    class="strength">
    Strength: --
  </div>


  <div
    id="status"
    class="status">
    Ready
  </div>


  <div>
    Next analysis in
  </div>


  <div
    id="countdown"
    class="countdown">
    60
  </div>


  <button
    id="signalButton"
    onclick="getLiveSignal()">

    Generate Live Signal

  </button>

</div>


<!-- =========================
     SIGNAL COUNTERS
========================= -->

<div
  class="grid"
  style="margin-top:16px;">

  <div class="card">

    <div class="label">
      Total Signals
    </div>

    <div
      class="value"
      id="totalSignals">
      0
    </div>

  </div>


  <div class="card">

    <div class="label">
      BUY Signals
    </div>

    <div
      class="value buy"
      id="buySignals">
      0
    </div>

  </div>


  <div class="card">

    <div class="label">
      SELL Signals
    </div>

    <div
      class="value sell"
      id="sellSignals">
      0
    </div>

  </div>

</div>


<!-- =========================
     HISTORY
========================= -->

<div class="card history-card">

  <div class="label">
    Live Signal History
  </div>

  <table>

    <thead>

      <tr>
        <th>Time</th>
        <th>Pair</th>
        <th>Signal</th>
        <th>Strength</th>
        <th>Price</th>
        <th>Expiry</th>
        <th>Result</th>
      </tr>

    </thead>

    <tbody id="history"></tbody>

  </table>

</div>


<div class="notice">

LIVE market data is provided by the connected market-data
backend. Signal strength is a technical-analysis score and
is not a guaranteed prediction or guaranteed profit.

WIN/LOSS should be calculated only after the 1-minute
expiry using verified market prices.

</div>

</div>


<script>

/* =========================
   SETTINGS
========================= */

const API_URL =
  "/.netlify/functions/signal";

const EXPIRY_SECONDS = 60;

let seconds =
  EXPIRY_SECONDS;

let loading = false;

let total = 0;
let buys = 0;
let sells = 0;

let wins = 0;
let losses = 0;


/* =========================
   IST CLOCK
========================= */

function updateIndiaTime(){

  const now = new Date();

  const time =
    now.toLocaleTimeString(
      "en-IN",
      {
        timeZone:"Asia/Kolkata",
        hour:"2-digit",
        minute:"2-digit",
        second:"2-digit",
        hour12:false
      }
    );

  document.getElementById(
    "indiaTime"
  ).innerText = time;

}

updateIndiaTime();

setInterval(
  updateIndiaTime,
  1000
);


/* =========================
   UPDATE WIN RATE
========================= */

function updateWinRate(){

  const completed =
    wins + losses;

  let rate = 0;

  if(completed > 0){

    rate =
      (wins / completed) * 100;

  }

  document.getElementById(
    "winCount"
  ).innerText = wins;


  document.getElementById(
    "lossCount"
  ).innerText = losses;


  document.getElementById(
    "winRate"
  ).innerText =
    rate.toFixed(1) + "%";

}


/* =========================
   SIGNAL
========================= */

async function getLiveSignal(){

  if(loading){
    return;
  }

  loading = true;

  const button =
    document.getElementById(
      "signalButton"
    );

  const signalElement =
    document.getElementById(
      "signal"
    );

  const statusElement =
    document.getElementById(
      "status"
    );

  const pair =
    document.getElementById(
      "pair"
    ).value;


  button.disabled = true;

  button.innerText =
    "Analyzing...";


  signalElement.className =
    "signal wait";

  signalElement.innerText =
    "WAIT";


  statusElement.className =
    "status";

  statusElement.innerText =
    "Getting live market data...";


  try{

    const url =
      API_URL +
      "?symbol=" +
      encodeURIComponent(pair);


    const response =
      await fetch(
        url,
        {
          method:"GET",
          cache:"no-store",
          headers:{
            "Accept":
            "application/json"
          }
        }
      );


    let data;

    try{

      data =
        await response.json();

    }catch(e){

      throw new Error(
        "Backend returned invalid JSON"
      );

    }


    if(!response.ok){

      throw new Error(
        data?.error ||
        data?.message ||
        "Backend API request failed"
      );

    }


    const signal =
      String(
        data.signal || ""
      ).toUpperCase();


    if(
      signal !== "BUY" &&
      signal !== "SELL"
    ){

      throw new Error(
        "Backend did not return BUY/SELL"
      );

    }


    /* =================
       DISPLAY SIGNAL
    ================= */

    if(signal === "BUY"){

      signalElement.className =
        "signal buy";

      signalElement.innerText =
        "BUY";

      buys++;

    }else{

      signalElement.className =
        "signal sell";

      signalElement.innerText =
        "SELL";

      sells++;

    }


    total++;


    document.getElementById(
      "totalSignals"
    ).innerText = total;


    document.getElementById(
      "buySignals"
    ).innerText = buys;


    document.getElementById(
      "sellSignals"
    ).innerText = sells;


    /* =================
       PRICE
    ================= */

    const price =
      data.price;


    document.getElementById(
      "price"
    ).innerText =
      price !== undefined
        ? "Price: " + price
        : "Price: --";


    /* =================
       STRENGTH
    ================= */

    let strength =
      Number(data.strength);


    if(Number.isFinite(strength)){

      strength =
        Math.max(
          0,
          Math.min(
            100,
            strength
          )
        );


      document.getElementById(
        "strength"
      ).innerText =
        "Strength: " +
        strength.toFixed(0) +
        "%";

    }else{

      document.getElementById(
        "strength"
      ).innerText =
        "Strength: --";

    }


    /* =================
       STATUS
    ================= */

    statusElement.className =
      "status live";

    statusElement.innerText =
      "LIVE • " +
      (
        data.source ||
        "Market API"
      );


    /* =================
       HISTORY
    ================= */

    addHistory(
      pair,
      signal,
      data.strength,
      price
    );


    playSound(signal);


    seconds =
      EXPIRY_SECONDS;

  }


  catch(error){

    console.error(
      "Signal Error:",
      error
    );


    signalElement.className =
      "signal wait";

    signalElement.innerText =
      "WAIT";


    statusElement.className =
      "status error";

    statusElement.innerText =
      "Error: " +
      error.message;

  }


  finally{

    loading = false;

    button.disabled = false;

    button.innerText =
      "Generate Live Signal";

  }

}


/* =========================
   HISTORY
========================= */

function addHistory(
  pair,
  signal,
  strength,
  price
){

  const table =
    document.getElementById(
      "history"
    );


  const row =
    document.createElement(
      "tr"
    );


  const time =
    new Date().toLocaleTimeString(
      "en-IN",
      {
        timeZone:
          "Asia/Kolkata",
        hour12:false
      }
    );


  const signalColor =
    signal === "BUY"
      ? "#00ff88"
      : "#ff4d67";


  const safeStrength =
    strength !== undefined &&
    strength !== null
      ? Number(strength).toFixed(0) + "%"
      : "--";


  const safePrice =
    price !== undefined &&
    price !== null
      ? price
      : "--";


  row.innerHTML = `

    <td>${time}</td>

    <td>
      ${pair.slice(0,3)}/${pair.slice(3)}
    </td>

    <td style="
      color:${signalColor};
      font-weight:bold;
    ">
      ${signal}
    </td>

    <td>
      ${safeStrength}
    </td>

    <td>
      ${safePrice}
    </td>

    <td>
      1 Minute
    </td>

    <td class="result">
      PENDING
    </td>

  `;


  table.prepend(row);


  /*
    Result remains PENDING until
    backend verifies the 1-minute
    expiry price.
  */

  while(
    table.rows.length > 20
  ){

    table.deleteRow(
      table.rows.length - 1
    );

  }

}


/* =========================
   COUNTDOWN
========================= */

setInterval(

  function(){

    seconds--;

    if(seconds < 0){

      seconds =
        EXPIRY_SECONDS;

    }


    document.getElementById(
      "countdown"
    ).innerText =
      seconds;


    if(
      seconds === 0 &&
      !loading
    ){

      getLiveSignal();

    }

  },

  1000

);


/* =========================
   SOUND
========================= */

function playSound(signal){

  try{

    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;


    if(!AudioContext){
      return;
    }


    const audio =
      new AudioContext();


    const oscillator =
      audio.createOscillator();


    const gain =
      audio.createGain();


    oscillator.connect(gain);

    gain.connect(
      audio.destination
    );


    oscillator.frequency.value =
      signal === "BUY"
        ? 800
        : 500;


    gain.gain.value =
      0.08;


    oscillator.start();


    oscillator.stop(
      audio.currentTime +
      0.25
    );

  }catch(error){

    console.log(
      "Sound unavailable"
    );

  }

}


/* =========================
   PAIR CHANGE
========================= */

document
  .getElementById("pair")
  .addEventListener(
    "change",
    function(){

      document.getElementById(
        "signal"
      ).className =
        "signal wait";


      document.getElementById(
        "signal"
      ).innerText =
        "WAIT";


      document.getElementById(
        "price"
      ).innerText =
        "Price: --";


      document.getElementById(
        "strength"
      ).innerText =
        "Strength: --";


      document.getElementById(
        "status"
      ).className =
        "status";


      document.getElementById(
        "status"
      ).innerText =
        "Ready for " +
        this.value;

    }
  );


/* =========================
   START
========================= */

updateWinRate();

window.addEventListener(
  "load",
  function(){

    setTimeout(
      getLiveSignal,
      1200
    );

  }
);

</script>

</body>
</html>
```
