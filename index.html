<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Quotex OTC Signal</title>

<style>
*{
  box-sizing:border-box;
}

body{
  margin:0;
  font-family:Arial,sans-serif;
  background:#111;
  color:white;
}

.container{
  max-width:600px;
  margin:auto;
  padding:20px;
}

h1{
  text-align:center;
  margin-bottom:20px;
}

.card{
  background:#1d1d1d;
  border-radius:15px;
  padding:20px;
  margin-bottom:15px;
}

label{
  display:block;
  margin-bottom:8px;
  font-size:16px;
  font-weight:bold;
}

select{
  width:100%;
  padding:15px;
  border-radius:10px;
  border:1px solid #555;
  background:#292929;
  color:white;
  font-size:17px;
}

button{
  width:100%;
  padding:15px;
  margin-top:15px;
  border:none;
  border-radius:10px;
  background:#1683ff;
  color:white;
  font-size:18px;
  font-weight:bold;
}

.signal{
  text-align:center;
  font-size:38px;
  font-weight:bold;
  margin:20px 0;
}

.info{
  display:flex;
  justify-content:space-between;
  padding:10px 0;
  border-bottom:1px solid #333;
}

.wait{
  color:#ffb000;
}

.buy{
  color:#00c853;
}

.sell{
  color:#ff4747;
}
</style>
</head>

<body>

<div class="container">

<h1>Quotex OTC Signal</h1>

<div class="card">

<label>Select OTC Trade Pair</label>

<select id="pair">

  <option value="AUDNZD_otc">
    AUD/NZD (OTC)
  </option>

  <option value="GBPNZD_otc">
    GBP/NZD (OTC)
  </option>

  <option value="NZDCAD_otc">
    NZD/CAD (OTC)
  </option>

  <option value="NZDUSD_otc">
    NZD/USD (OTC)
  </option>

  <option value="USDBRL_otc">
    USD/BRL (OTC)
  </option>

  <option value="USDDZD_otc">
    USD/DZD (OTC)
  </option>

  <option value="USDEGP_otc">
    USD/EGP (OTC)
  </option>

  <option value="USDNGN_otc">
    USD/NGN (OTC)
  </option>

  <option value="USDCOP_otc">
    USD/COP (OTC)
  </option>

  <option value="USDBDT_otc">
    USD/BDT (OTC)
  </option>

  <option value="USDPHP_otc">
    USD/PHP (OTC)
  </option>

</select>

<button onclick="generateSignal()">
  Generate Live Signal
</button>

</div>


<div class="card">

<div class="info">
<span>Market</span>
<strong id="market">QUOTEX OTC</strong>
</div>

<div class="info">
<span>Timeframe</span>
<strong>M1 / 1 Minute</strong>
</div>

<div class="info">
<span>Selected Pair</span>
<strong id="selectedPair">AUD/NZD (OTC)</strong>
</div>

<div class="info">
<span>Status</span>
<strong id="status">READY</strong>
</div>

<div class="signal wait" id="signal">
WAIT
</div>

<div class="info">
<span>Price</span>
<strong id="price">--</strong>
</div>

<div class="info">
<span>Strength</span>
<strong id="strength">--</strong>
</div>

</div>

</div>


<script>

const pairNames = {

  AUDNZD_otc: "AUD/NZD (OTC)",

  GBPNZD_otc: "GBP/NZD (OTC)",

  NZDCAD_otc: "NZD/CAD (OTC)",

  NZDUSD_otc: "NZD/USD (OTC)",

  USDBRL_otc: "USD/BRL (OTC)",

  USDDZD_otc: "USD/DZD (OTC)",

  USDEGP_otc: "USD/EGP (OTC)",

  USDNGN_otc: "USD/NGN (OTC)",

  USDCOP_otc: "USD/COP (OTC)",

  USDBDT_otc: "USD/BDT (OTC)",

  USDPHP_otc: "USD/PHP (OTC)"

};


const pairSelect = document.getElementById("pair");

pairSelect.addEventListener("change", function(){

  const pair = this.value;

  document.getElementById("selectedPair").textContent =
    pairNames[pair] || pair;

});


async function generateSignal(){

  const pair = pairSelect.value;

  document.getElementById("selectedPair").textContent =
    pairNames[pair];

  document.getElementById("status").textContent =
    "LOADING";

  document.getElementById("signal").textContent =
    "WAIT";

  document.getElementById("signal").className =
    "signal wait";

  try{

    const url =
      "/.netlify/functions/signal?symbol=" +
      encodeURIComponent(pair);

    const response = await fetch(url);

    const data = await response.json();

    console.log("API:", data);

    document.getElementById("status").textContent =
      data.status || "UNKNOWN";

    document.getElementById("price").textContent =
      data.price ?? "--";

    document.getElementById("strength").textContent =
      data.strength
        ? data.strength + "%"
        : "--";

    const signal =
      data.signal || "WAIT";

    document.getElementById("signal").textContent =
      signal;

    if(signal === "BUY"){

      document.getElementById("signal").className =
        "signal buy";

    }

    else if(signal === "SELL"){

      document.getElementById("signal").className =
        "signal sell";

    }

    else{

      document.getElementById("signal").className =
        "signal wait";

    }

  }

  catch(error){

    console.error(error);

    document.getElementById("status").textContent =
      "ERROR";

    document.getElementById("signal").textContent =
      "WAIT";

    document.getElementById("signal").className =
      "signal wait";

    document.getElementById("price").textContent =
      "--";

    document.getElementById("strength").textContent =
      "--";

  }

}

</script>

</body>
</html>
