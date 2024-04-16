let circles = [];
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
let imageModelURL = 'https://teachablemachine.withgoogle.com/models/zSkoN7YWo/';
// To store the classification
let label = "";
//first call to classify
let classifyStart = false;

function preload(){
  // load the shader
  camShader = loadShader('glsl/effect.vert', 'glsl/effect.frag');
  classifier = ml5.imageClassifier(imageModelURL + 'model.json');
}

function drawCircle(x, y, alpha) {
  fill(255, 255, 255, alpha);
  ellipse(x, y, 10);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  cam = createCapture(VIDEO);
  // cam.size(windowWidth, windowHeight);
  cam.hide();
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
    classifyVideo();
  }
}

function draw() {
  // your draw code here
  if (cam.loadedmetadata) {

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
    fill(255);
    textSize(16);
    textAlign(CENTER);
    text(label, width / 2, height - 4);
  }

  for (let x = 0; x < width; x += 10) {
    for (let y = 0; y < height; y += 10) {
      const [r, g, b] = get(x, y); // get colors
      
      if (b > 240 && random() > 0.999) {
        circles.push({ x, y, alpha: 255, b });
      }
    }
  }

  for (let i = circles.length - 1; i >= 0; i--) {
    let circle = circles[i];
    drawCircle(circle.x, circle.y, circle.alpha);
    playNote(circle.x, circle.y, circle.b);
    circle.alpha -= 1; // adjust fading speed here

    if (circle.alpha <= 0) {
      circles.splice(i, 1);
    }
  }
  // numLayers = 90 + circles.length*9;
  // index1 = 0;
  // index2 = (index1+numLayers/3)%layers.length; // 30
  // index3 = (index1+numLayers/3 * 2)%layers.length; // 60
  // console.log(numLayers);

  if (circles.length > 0) {
    circles.shift();
  }
  // increase all indices by 1, resetting if it goes over layers.length
  // the index runs in a circle 0, 1, 2, ... 29, 30, 0, 1, 2, etc.
  // index1
  // index2 will be somewhere in the past
  // index3 will be even further into the past
  index1 = (index1 + 1)  % layers.length;
  index2 = (index2 + 1) % layers.length;
  index3 = (index3 + 1) % layers.length;
}

function playNote(x, y, b) {
  let note = map(x, 0, width, 0,1);
  let volume = map(y, 0, height, 0.4, 1);
  sustain = map(b, 240, 255, 0.5, 1);
  try {
  synth.play(note*243+21, volume, 0,sustain); 
  } catch(err) {
    // console.log(err);
    
  }
}

function keyPressed() {
  // Toggle fullscreen mode
  let fs = fullscreen();
  fullscreen(!fs);
}

function mousePressed() {
  userStartAudio();
  console.log('audio started');
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
  // The results are in an array ordered by confidence.
  // console.log(results[0]);
  label = results[0].label;
  console.log(label);
  // console.log(results);
  // Classifiy again!
  classifyVideo();
}
