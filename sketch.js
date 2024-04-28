
//min pixel value to trigger circles
let sensitivity = 252;
//probability of triggering a circle
let probability = 0.993;
//number of audio instances
let audioInstances = 6;

let loopInstances = 16;

// show the player line
let showPlayer = false;
let calibrate = false;
let showBlobs = false;
let mute = false;

let circles = [];
let blobs = [];
let rblobs = [];
let cam;

// the shader variable
let camShader;

// we will need at least two layers for this effect
let shaderLayer;

// how many past frames should we store at once
// the more you store, the further back in time you can go
// however it's pretty memory intensive so don't push it too hard
let numLayers = 90;

// an array where we will store the past camera frames
let layers = [];

// three indices representing a given momeny in time
// index1 is current
// index2 is 30 frames behind
// index3 is 60 frames behind
let index1 = 0;
let index2 = numLayers/3; // 30
let index3 = numLayers/3 * 2; // 60

// Classifier Variable
let classifier;
// Model URL
let imageModelURL = 'res/model/';
// To store the classification
let label = "";
let confidence = [];
//first call to classify
let classifyStart = false;

let audio = [];
let loops = [];

let colors;
let reds;
let trackingData;
let trackingDataRed;

let camRatio = {w: 0, h: 0};

let playerY = 0;
let bpm = 120;
let playerSpeed;

let minSize = { w: 1000, h: 1000};
let maxSize = { w: 0, h: 0};


function preload(){
  // load the shader
  camShader = loadShader('glsl/effect.vert', 'glsl/effect.frag');
  classifier = ml5.imageClassifier(imageModelURL + 'model.json')
  for (let i = 0; i < audioInstances; i++) {
    audio[i] = loadSound('res/audio/'+(i+1)+'.wav');
  }

  for (let i = 0; i < loopInstances; i++) {
    loops[i] = loadSound('res/loops/'+(i)+'.wav');
  }
  // audio = loadSound('res/audio/test_file.mp3');
}

function drawCircle(x, y, alpha) {
 // fill(255, 255, 255, alpha);
 // ellipse(x, y, 10);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  cam = createCapture(VIDEO);
  // cam.size(windowWidth, windowHeight);
  cam.position(0,0);
  cam.style('opacity',0)// use this to hide the capture later on (change to 0 to hide)...
  // cam.hide();
  cam.id("myVideo"); //give the capture an ID so we can use it in the tracker below.

  synth = new p5.PolySynth();

  synth.setADSR(0.5, 0.5, 0.5, 0.5, 4);
  // Adjusting filter
  // synth.setFilter(10, 0.7); 

  // Access the underlying canvas and context
  let canvas = document.getElementById('defaultCanvas0');
  // let context = canvas.getContext('2d', { willReadFrequently: true });

  // this layer will use webgl with our shader
  shaderLayer = createGraphics(windowWidth, windowHeight, WEBGL);

  // create a ton of createGraphics layers
  for (let i = 0; i < numLayers; i++){
    let l = createGraphics(windowWidth, windowHeight);
    layers.push(l);
  }

  flippedVideo = ml5.flipImage(cam);
  // Start classifying
  if (cam.loadedmetadata) {
    // classifyVideo();
  }
  
  tracking.ColorTracker.registerColor('red', function(r, g, b) {
    if (r > 150 && g < 100 && b < 100) {
      return true;
    }
    return false;
  });

  tracking.ColorTracker.registerColor('blue', function(r, g, b) {
    if (r < 50 && g < 50 && b > 200) {
      return true;
    }
    return false;
  });

  // tracking.ColorTracker.registerColor('yellow', function(r, g, b) {
  //   if (r > 200 && g > 200 && b > 200) {
  //     return true;
  //   }
  //   return false;
  // });


  colors = new tracking.ColorTracker(['yellow']);
  tracking.track('#myVideo', colors); // start the tracking of the colors above on the camera in p5

  //start detecting the tracking
  colors.on('track', function(event) { //this happens each time the tracking happens
      trackingData = event.data // break the trackingjs data into a global so we can access it with p5
  });

  reds = new tracking.ColorTracker(['red']);
  tracking.track('#myVideo', reds); // start the tracking of the colors above on the camera in p5

  //start detecting the tracking
  reds.on('track', function(event) { //this happens each time the tracking happens
      trackingDataRed = event.data // break the trackingjs data into a global so we can access it with p5
  });

  noStroke();
  colorMode(HSB);
  rectMode(CENTER);
  // playerSpeed = height / 120/60/30 * 8;
  let bpf = bpm / 60 / 30;
  playerSpeed = height * bpf /4;
}

function draw() {
  // your draw code here
  if (cam.loadedmetadata) {
    camRatio.w = windowWidth/cam.width;
    camRatio.h = windowHeight/cam.height;
    if (!classifyStart) {
      classifyVideo();
      classifyStart = true;
    }
    // image(cam, 0, 0, width, height);
    // draw the camera on the current layer
    layers[index1].image(cam, 0, 0, width, height);

    // shader() sets the active shader with our shader
    shaderLayer.shader(camShader);

    // send the camera and the two other past frames into the camera feed
    camShader.setUniform('tex0', layers[index1]);
    camShader.setUniform('tex1', layers[index2]);
    camShader.setUniform('tex2', layers[index3]);

    // rect gives us some geometry on the screen
    shaderLayer.rect(0,0,width, height);
    push();
    translate(width,0);
    scale(-1, 1);
    image(shaderLayer, 0,0,width, height);
    pop();

    // Draw the label
    // fill(255);
    // textSize(16);
    // textAlign(CENTER);
    // text(label, width / 2, height - 4);

    // Draw the confidence
    // blendMode(OVERLAY);
    // for (let i = 0; i < confidence.length; i++) {
    //   let x = (i * width / confidence.length) + width / confidence.length / 2;
    //   let sqHeight = map(confidence[i], 0, 1, 0, height);
    //   fill(i * 360 / confidence.length, 255, 255, 120);
    //   rect(x, height/2, width / confidence.length, sqHeight);
    // }
    blendMode(BLEND);
  }
    // console.log(trackingData);
    if(trackingData){ //if there is tracking data to look at, then...
      blobs = [];
      for (var i = 0; i < trackingData.length; i++) { //loop through each of the detected colors
        // console.log( trackingData[i] )
        // rect(width-(trackingData[i].x*camRatio.w)-trackingData[i].width,
        //             trackingData[i].y*camRatio.h+trackingData[i].height,
        //             trackingData[i].width*camRatio.w,
        //             trackingData[i].height*camRatio.h);
        blob = {x: width-(trackingData[i].x*camRatio.w)-trackingData[i].width,
                    y: trackingData[i].y*camRatio.h+trackingData[i].height,
                    width: trackingData[i].width,
                    height: trackingData[i].height};
        // blobs.push({x: width-(trackingData[i].x*camRatio.w)-trackingData[i].width,
        //             y: trackingData[i].y*camRatio.h+trackingData[i].height,
        //             width: trackingData[i].width,
        //             height: trackingData[i].height});
        if (calibrate || blob.width < maxSize.w && blob.width > minSize.w && blob.height < maxSize.h && blob.height > minSize.h)
          blobs.push(blob);
      }
    }

    if(trackingDataRed){ //if there is tracking data to look at, then...
      rblobs = [];
      for (var i = 0; i < trackingDataRed.length; i++) { //loop through each of the detected colors
        // console.log( trackingData[i] )
        // rect(width-(trackingData[i].x*camRatio.w)-trackingData[i].width,
        //             trackingData[i].y*camRatio.h+trackingData[i].height,
        //             trackingData[i].width*camRatio.w,
        //             trackingData[i].height*camRatio.h);
        rblobs.push({x: width-(trackingDataRed[i].x*camRatio.w)-trackingDataRed[i].width,
                    y: trackingDataRed[i].y*camRatio.h+trackingDataRed[i].height,
                    width: trackingDataRed[i].width,
                    height: trackingDataRed[i].height});
      }
      // console.log(rblobs.length);
    }


  // draw the blobs
  if (showBlobs) {
    for (let i = 0; i < blobs.length; i++) {
      let blob = blobs[i];
      rect(blob.x, blob.y, blob.width, blob.height);
      
      if (blob.width > maxSize.w) maxSize.w = blob.width;
      if (blob.height > maxSize.h) maxSize.h = blob.height;
      if (blob.width < minSize.w) minSize.w = blob.width;
      if (blob.height < minSize.h) minSize.h = blob.height;
    }
    if (calibrate) {
      console.log(blobs.length);
      console.log('minSize', minSize);
      console.log('maxSize', maxSize);
    }

    for (let i = 0; i < rblobs.length; i++) {
      let blob = rblobs[i];
      rect(blob.x, blob.y, blob.width, blob.height);
    }
  }

  //draw the player line
  if (showPlayer) {
    fill(255);
    rect(width/2, playerY, width, 10);
  }
  playerY = (playerY + playerSpeed) % height;

  for (let i = 0; i < blobs.length; i++) {
    let blob = blobs[i];
    if (playerY > blob.y && playerY < blob.y + playerSpeed+2) {
      // playNote(blob.x, blob.y, blob.width);
      playAudio(blob.x, blob.y, blob.width, blob.height);
    }
  }

  for (let i = 0; i < rblobs.length; i++) {
    let blob = rblobs[i];
    if (playerY > blob.y && playerY < blob.y + playerSpeed+2) {
      playNote(blob.x, blob.y, blob.width);
      // playAudio(blob.x, blob.y, blob.width, blob.height);
    }
  }
  
  index1 = (index1 + 1)  % layers.length;
  index2 = (index2 + 1) % layers.length;
  index3 = (index3 + 1) % layers.length;
}

function playNote(x, y, b) {
  let note = map(x, 0, width, 0,1);
  let volume = map(y, 0, height, 0.4, 1);
  sustain = map(b, 0, 255, 0.5, 1);
  try {
    if (!mute)
      synth.play(note*243+21, volume, 0,sustain); 
  } catch(err) {
    // console.log(err);
  }
}

function keyPressed() {
 // Toggle fullscreen mode
  if (key == 'F') {
    let fs = fullscreen();
    fullscreen(!fs);
  } else if (key == 'P') {
    showPlayer = !showPlayer;
    console.log('showPlayer', showPlayer);
  } else if (key == 'C') {
    if (!calibrate) {
      minSize = { w: 1000, h: 1000};
      maxSize = { w: 0, h: 0};
    }
    calibrate = !calibrate;

    if (calibrate) {
      showBlobs = true;
      showPlayer = true;
    }
    console.log('calibrate', calibrate);
  } else if (key == 'B') { 
    showBlobs = !showBlobs;
    console.log('showBlobs', showBlobs);
  } else if (key == 'M') {
    mute = !mute;
    if (mute) {
      for (let i = 0; i < audioInstances; i++) {
        audio[i].stop();
      }
    }
    console.log('mute', mute);
  }

}

function mousePressed() {
  userStartAudio();
  console.log('audio started');
  //play([startTime], [rate], [amp], [cueStart], [duration])
  // audio.loop(0,0.3, 1, 0.5, 0.6);
  // audio.loop(0,0.5, 1, 0.1, 0.2);
}

function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
}

// Get a prediction for the current video frame
function classifyVideo() {
  flippedVideo = ml5.flipImage(cam)
  classifier.classify(flippedVideo, gotResult);
  flippedVideo.remove();
}

// When we get a result
function gotResult(error, results) {
  // If there is an error
  if (error) {
    console.error(error);
    return;
  }
  
  results.forEach((result, index) => {
    // Update the confidence array
    confidence[result.label] = result.confidence;
  });

  // console.log(confidence);

  label = parseInt(results[0].label);
  // console.log(results);
  updateAudio(label);
  // console.log(results);
  // Classifiy again!
  classifyVideo();
}

function updateAudio(index) {

  if (index>0) 
  if (!audio[index-1].isPlaying()) {
    //play([startTime], [rate], [amp], [cueStart], [duration])
    //console.log('playing audio', index);
    
    rate = random(0.5,1.2);
    amp = 0.2;
    duration = random(0.2,0.8);
    cueStart = random(0, 1-duration);
    
    //audio[index-1].play(0, rate, amp, cueStart, duration); 
  }
}

function playAudio(x, y, w, h) {
  index = int(map(x, 0, width, 0, loopInstances));

  if (!loops[index].isPlaying() && !mute) {
    //play([startTime], [rate], [amp], [cueStart], [duration])
    loops[index].stop();
   
    // rate = random(0.5,1.2);
    // amp = 0.2;
    // duration = random(0.2,0.8);
    // cueStart = random(0, 1-duration);

    rate = 1;
    amp = 0.5;
    duration = random(0.2,0.8);
    cueStart = random(0, 1-duration);
    
    loops[index].play(0, rate, amp); 
  }
}

