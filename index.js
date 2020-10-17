const stateEnum = {
  idle: 0,
  recording: 1,
  playing: 2,
};
let state = stateEnum.idle;

let messages = [];
let buffer = [];
const refreshMs = 100;
let acl = new Accelerometer({ frequency: refreshMs });

function check_acc() {
  var fieldNameElement = document.getElementById("losdivos");

  let summed = (acl.x + acl.y + acl.z) / 3.0;

  buffer.push(summed);

  let z_smoothed = smoothed_z_score(buffer, null);
  if (
    z_smoothed.length > 15 &&
    z_smoothed.slice(z_smoothed.length - 15).every((item) => item === 0)
  ) {
    acl.stop();
    messages.push(z_smoothed);
    state = stateEnum.idle;
    setTimeout(main, 10);
    return;
  }
  if (buffer.length * refreshMs > 5000) {
    acl.stop();
    state = stateEnum.idle;
    setTimeout(main, 10);
    return;
  } else {
    fieldNameElement.innerHTML = `${buffer.length}`;
  }
};


function processMessages(messages) {
  var fieldNameElement = document.getElementById("losdivos");

  let buffer = messages.pop();
  let vibration_buffer = [0]
  var i;
  let last_value = 0;
  let last_index = 0
  let total = 0
  for (i = 1; i < buffer.length; i++) {
      const val = Math.abs(buffer[i])
      if (val != last_value){
          let periods = i - last_index;
          let multiplier = last_value ? 3:2
          vibration_buffer.push(periods * refreshMs * multiplier)
          total += periods * refreshMs * multiplier
          last_index = i;      
      }
      last_value = val;
  }
  fieldNameElement.innerHTML = `${vibration_buffer}`;

  setTimeout(stopVibration, total + 1000);

  navigator.vibrate(vibration_buffer);


}

function stopVibration() {
    navigator.vibrate(0);
    state = stateEnum.idle;
    setTimeout(main, 10);
}
function start() {
    acl.addEventListener("reading", check_acc);
    main()
}
function main() {
  var fieldNameElement = document.getElementById("losdivos");
  var indicator = document.getElementById('indicator');

  if (state == stateEnum.idle) {
    if (messages.length > 0) {
      fieldNameElement.innerHTML = `playing`;
      indicator.style['background-color'] = 'yellow';


      state = stateEnum.playing;
      processMessages(messages);
      messages = [];
      return;
    } else {
        buffer = [];
      fieldNameElement.innerHTML = `recording`;
      indicator.style['background-color'] = 'red';


      state = stateEnum.recording;
      acl.start();
      return;
    }
  }
  indicator.style['background-color'] = 'green';

  fieldNameElement.innerHTML = `idling`;
}


// javascript port of: https://stackoverflow.com/questions/22583391/peak-signal-detection-in-realtime-timeseries-data/48895639#48895639

function sum(a) {
  return a.reduce((acc, val) => acc + val);
}

function mean(a) {
  return sum(a) / a.length;
}

function stddev(arr) {
  const arr_mean = mean(arr);
  const r = function (acc, val) {
    return acc + (val - arr_mean) * (val - arr_mean);
  };
  return Math.sqrt(arr.reduce(r, 0.0) / arr.length);
}

function smoothed_z_score(y, params) {
  var p = params || {};
  // init cooefficients
  const lag = p.lag || 5;
  const threshold = p.threshold || 3.5;
  const influence = p.influence || 0.5;

  if (y === undefined || y.length < lag + 2) {
    throw ` ## y data array to short(${y.length}) for given lag of ${lag}`;
  }
  //console.log(`lag, threshold, influence: ${lag}, ${threshold}, ${influence}`)

  // init variables
  var signals = Array(y.length).fill(0);
  var filteredY = y.slice(0);
  const lead_in = y.slice(0, lag);
  //console.log("1: " + lead_in.toString())
  var avgFilter = [];
  avgFilter[lag - 1] = mean(lead_in);
  var stdFilter = [];
  stdFilter[lag - 1] = stddev(lead_in);
  //console.log("2: " + stdFilter.toString())

  for (var i = lag; i < y.length; i++) {
    //console.log(`${y[i]}, ${avgFilter[i-1]}, ${threshold}, ${stdFilter[i-1]}`)
    if (Math.abs(y[i] - avgFilter[i - 1]) > threshold * stdFilter[i - 1]) {
      if (y[i] > avgFilter[i - 1]) {
        signals[i] = +1; // positive signal
      } else {
        signals[i] = -1; // negative signal
      }
      // make influence lower
      filteredY[i] = influence * y[i] + (1 - influence) * filteredY[i - 1];
    } else {
      signals[i] = 0; // no signal
      filteredY[i] = y[i];
    }

    // adjust the filters
    const y_lag = filteredY.slice(i - lag, i);
    avgFilter[i] = mean(y_lag);
    stdFilter[i] = stddev(y_lag);
  }

  return signals;
}
