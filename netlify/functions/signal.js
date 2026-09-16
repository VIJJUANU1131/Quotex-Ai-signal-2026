/* =====================================
   STRICT NEXT-CANDLE SIGNAL
===================================== */

let signal = "WAIT";
let nextCandle = "WAIT";
let strength = 50;

const difference =
  Math.abs(upScore - downScore);

/* Strong UP confirmation */
if (
  upScore >= 11 &&
  upScore > downScore &&
  difference >= 4 &&
  ema5 > ema13 &&
  rsi >= 50 &&
  rsi <= 70 &&
  momentum1 > 0 &&
  momentum2 > 0
) {

  signal = "BUY";
  nextCandle = "UP";

  strength = Math.min(
    95,
    75 + difference * 3
  );
}

/* Strong DOWN confirmation */
else if (
  downScore >= 11 &&
  downScore > upScore &&
  difference >= 4 &&
  ema5 < ema13 &&
  rsi >= 30 &&
  rsi <= 50 &&
  momentum1 < 0 &&
  momentum2 < 0
) {

  signal = "SELL";
  nextCandle = "DOWN";

  strength = Math.min(
    95,
    75 + difference * 3
  );
}

/* Otherwise don't force a trade */
else {

  signal = "WAIT";
  nextCandle = "WAIT";
  strength = 50;
}
