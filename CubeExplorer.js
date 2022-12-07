/** Szymon Pilawka */
/** Program wykorzystuje WebGL oraz operacje macierzowe do stworzenia 
 * przestrzenii trójwymiarowej.
 * Generowane jest 2000 losowych rozmiarów prostopadłościanów rozmieszczonych
 * na obszarze [-1000,1000)^3.
 * "Gra" nie ma określonego celu (jeśli chodzi o warunek ukończenia). Celem jest jedynie 
 * podróż po stworzonej przestrzenii.
 */


const canvas = document.getElementById("myCanvas");
const gl = canvas.getContext("webgl");

/**Odniesienie do programu Shaderowego i bufora */
var program, myBuffer;

/** Pierwotne wartosci: Polozenia, obrotu i pola widzenia */
var translation = [0,0,0];
var rotation = [0,0,0];
var FoV = 90;

/** Ilosc generowanych prostopadloscianow */
var n = 2000;

/** zNear, zFar */
const zNear = 1, zFar = 1200;

/** Predkosc obrotu i ruchu */
const rotSpeed = 3.0, advanceSpeed=9;

/** Odnosniki do zmiennych w vertex shaderze */
var perspectiveLoc,xLoc,yLoc,zLoc,transposeLoc,vertexLoc;

/** Kod zrodlowy vertex shadera */
const vertexSource = `
uniform mat4 perspectiveM;
uniform mat4 xRotateM;
uniform mat4 yRotateM;
uniform mat4 zRotateM;
uniform mat4 transposeM;
attribute vec4 vpos;

void main(void) {
    gl_Position = perspectiveM * xRotateM * yRotateM * zRotateM * transposeM * vpos;
}
`;

/** Kod zrodlowy fragment shadera
 * Zawsze zwraca fragment koloru białego
 */
const fragmentSource = `
void main() {
    gl_FragColor = vec4(1.0,1.0,1.0,1.0);
}
`;

/** Obliczanie ruchu naprzod */
function calculateMove(n) {
    var sx = Math.sin(degToRad(rotation[0])),
    cx = Math.cos(degToRad(rotation[0])),
    sy = Math.sin(degToRad(rotation[1])),
    cy = Math.cos(degToRad(rotation[1]));

    translation[2] += n*cy;
    translation[1] += n*sx;
    translation[0] -= n*sy;
}

/**Obsluga nacisniec klawiszy myszy */
document.addEventListener('keydown', function(event) {
    if (event.key == "w") {
        rotation[0]-=rotSpeed; draw();
    }
    else if (event.key == "s") {
        rotation[0]+=rotSpeed; draw();
    }
    else if (event.key == "a") {
        rotation[1]-=rotSpeed; draw();
    }
    else if (event.key == "d") {
        rotation[1]+=rotSpeed; draw();
    }
    else if (event.key == "q") {
        rotation[2]-=rotSpeed; draw();
    }
    else if (event.key == "e") {
        rotation[2]+=rotSpeed; draw();
    }
    else if (event.key == " ") {
        calculateMove(advanceSpeed); draw();
    }
});

/** Funkcja inicjujaca dany shader z podanym typem */
function initShader (type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    //error
    if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {
        console.log(gl.getShaderInfoLog(shader));
        gl.deleteSharer(shader);
        return null;
    }
    return shader;
}

/** Funkcja rozpoczyna i linkuje program shaderowy */
function initProgram(fshader, vshader) {
    program = gl.createProgram();
    gl.attachShader(program,fshader);
    gl.attachShader(program,vshader);

    gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)){
        console.log(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    gl.useProgram(program);
}

/** Inicjalizacja bufora: przylaczenie */
function initDataBuffer () {
    vertexLoc = gl.getAttribLocation(program,"vpos");
    perspectiveLoc = gl.getUniformLocation(program,"perspectiveM");
    xLoc = gl.getUniformLocation(program,"xRotateM");
    yLoc = gl.getUniformLocation(program,"yRotateM");
    zLoc = gl.getUniformLocation(program,"zRotateM");
    transposeLoc = gl.getUniformLocation(program,"transposeM");
    
   
    myBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, myBuffer);

    gl.bindBuffer(gl.ARRAY_BUFFER, myBuffer);
    gl.enableVertexAttribArray(vertexLoc);
    gl.vertexAttribPointer (vertexLoc,3,gl.FLOAT,false,0,0);
}

/** Funkcja zamieniajaca stopnie na radiany */
function degToRad(deg) {
    return deg*Math.PI/180;
}

/** Macierze przeksztalcen do shadera */
var mtx = {
    //Perspektywa
    perspective: function(FoV, aspect, near, far) {
        var f = Math.tan(0.5* (Math.PI - FoV));
        var rangeInv = 1.0 / (near - far);
        return [
          f / aspect, 0, 0, 0,
          0, f, 0, 0,
          0, 0, (near + far) * rangeInv, -1,
          0, 0, near * far * rangeInv * 2, 0
        ];
    },
    //Przesuniecie w ukladzie wsp.
    translation: function(tx, ty, tz) {
      return [
         1,  0,  0,  0,
         0,  1,  0,  0,
         0,  0,  1,  0,
         tx, ty, tz, 1,
      ];
    },
    //Obroty
    xRotation: function(rad) {
      var c = Math.cos(rad);
      var s = Math.sin(rad);
  
      return [
        1, 0, 0, 0,
        0, c, s, 0,
        0, -s, c, 0,
        0, 0, 0, 1,
      ];
    },
    yRotation: function(rad) {
      var c = Math.cos(rad);
      var s = Math.sin(rad);
  
      return [
        c, 0, -s, 0,
        0, 1, 0, 0,
        s, 0, c, 0,
        0, 0, 0, 1,
      ];
    },
    zRotation: function(rad) {
      var c = Math.cos(rad);
      var s = Math.sin(rad);
  
      return [
         c, s, 0, 0,
        -s, c, 0, 0,
         0, 0, 1, 0,
         0, 0, 0, 1,
      ];
    },
};

/** Rysowanie dla nowego obrotu/polozenia */
function draw() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    //wyczyszczenie ekranu
    gl.viewport(0,0,gl.canvas.width,gl.canvas.height);
    gl.clearColor(0.0,0.0,0.0,1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    //przekazanie macierzy
    gl.uniformMatrix4fv(perspectiveLoc,false,mtx.perspective(degToRad(FoV), gl.canvas.clientWidth/gl.canvas.clientHeight,zNear,zFar));
    gl.uniformMatrix4fv(xLoc,false,mtx.xRotation(degToRad(rotation[0])));
    gl.uniformMatrix4fv(yLoc,false,mtx.yRotation(degToRad(rotation[1])));
    gl.uniformMatrix4fv(zLoc,false,mtx.zRotation(degToRad(rotation[2])));
    gl.uniformMatrix4fv(transposeLoc,false,mtx.translation(translation[0],translation[1],translation[2]));

    //rysuj
    gl.drawArrays(gl.LINES,0,24*n);
}

/** Funkcja wywolujaca wszystkie funkcje inicjujace */
function initAll() {
    const fshader = initShader(gl.FRAGMENT_SHADER,fragmentSource);
    const vshader = initShader(gl.VERTEX_SHADER,vertexSource);
    initProgram(fshader,vshader);
    initDataBuffer();
    generateRandomCuboid(n);
    draw();
}

/** Funkcja zwraca losowa liczbe z zakresu [off,off+mult) */
function randomFloat(mult,off) {
    return Math.random()*mult + off;
}

/** Łaczenie arrayow  */
function Float32Concat(a,b) {
    var c = new Float32Array(a.length + b.length);

    c.set(a);
    c.set(b, a.length);

    return c;
}


/**Generowanie nowej listy punktow */
function generateRandomArraySet(n) {
    var myArr = new Float32Array();
    for (var i=0;i<n;i++) {
        //pierwszy punkt
        var x1 = randomFloat(2000,-1000), y1 = randomFloat(2000,-1000), z1 = randomFloat(2000,-1000);
        //rozmiar
        var dx = randomFloat(45,5), dy = randomFloat(45,5), dz = randomFloat(45,5);
        x2 = x1+dx, y2=y1+dy ,z2 = z1+dz;

        var newArr = new Float32Array([
            x1,y1,z1,
            x1,y2,z1,
    
            x1,y2,z1,
            x2,y2,z1,
    
            x2,y2,z1,
            x2,y1,z1,
    
            x2,y1,z1,
            x1,y1,z1,
    
            x2,y2,z2,
            x2,y1,z2,
    
            x2,y1,z2,
            x1,y1,z2,
    
            x1,y1,z2,
            x1,y2,z2,
    
            x1,y2,z2,
            x2,y2,z2,
    
            x1,y2,z1,
            x1,y2,z2,
    
            x2,y2,z1,
            x2,y2,z2,
    
            x2,y1,z1,
            x2,y1,z2,
    
            x1,y1,z1,
            x1,y1,z2
        ]);
        myArr = Float32Concat(myArr,newArr);
    }
    return myArr;
}

/** Funkcja generuje n losowych prostopadloscianow do bufora */
function generateRandomCuboid(n) {
    gl.bufferData(gl.ARRAY_BUFFER,
        generateRandomArraySet(n),
        gl.STATIC_DRAW);
}

onload = function() {
    initAll();
}
