function setup() {
    createCanvas(400, 400);
    console.log("Iniciando");
  }
  
  function draw() {
    background(255);
    push();
    fill(0);
    translate(width*0.5, height*0.5);
    rotate(frameCount*0.01);
    rect(0,0, 100, 100);
    pop();
  }