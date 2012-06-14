// グローバル変数
var gl          = null;
var vbuffers    = null;
var ibuffer     = null;
var texture     = null;
var program     = null;
var uniformVars = null;
var count       = 0;

$(function() {
  // WebGL コンテキストの取得
  var canvas = $("#screen").get(0);
  $.each(["webgl", "experimental-webgl", "webkit-3d", "moz-webgl"], function(i, name) {
    try { gl = canvas.getContext(name); } catch(e) {}
    return !gl
  });
  if(!gl) {
    alert("WebGL がサポートされていません。");
    return;
  }

  // リソースの初期化
  initVertices();
  initIndices();
  initTexture();
  initShaders();

  // 描画処理を毎秒 30 回呼び出す
  setInterval(redrawScene, 1000/30);
});

function initVertices() {
  // 頂点データを生成
  var positions = [], uvs = [];
  for(var i = 0 ; i <= 8 ; ++i) {
    var v = i / 8.0;
    var y = Math.cos(Math.PI * v), r = Math.sin(Math.PI * v);
    for(var j = 0 ; j <= 16 ; ++j) {
      var u = j / 16.0;
      positions = positions.concat(
        Math.cos(2 * Math.PI * u) * r, y, Math.sin(2 * Math.PI * u) * r);
      uvs = uvs.concat(u, v);
    }
  }

  // VBOを作成し、データを転送
  vbuffers = $.map([positions, positions, uvs], function(data, i) {
    var vbuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return vbuffer;
  });
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

function initIndices() {
  // インデックスデータを生成
  var indices = [];
  for(var j = 0 ; j < 8 ; ++j) {
    var base = j * 17;
    for(var i = 0 ; i < 16 ; ++i) {
      indices = indices.concat(
        base + i,      base + i + 1, base + i     + 17,
        base + i + 17, base + i + 1, base + i + 1 + 17);
    }
  }

  // IBOを作成し、データを転送
  ibuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Int16Array(indices), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  // インデックスの数を保存しておく
  numIndices = indices.length;
}

function initTexture() {
  // テクスチャーオブジェクトを作成
  texture = gl.createTexture();

  // 画像の読み込み完了時の処理
  var image = new Image();
  image.onload = function() {
    gl.enable(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  // 画像の読み込みを開始
  image.src = "earth.jpg";
}

function initShaders() {
  // 頂点シェーダーを作成
  var vshader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vshader, $('#vshader').text());
  gl.compileShader(vshader);
  if(!gl.getShaderParameter(vshader, gl.COMPILE_STATUS))
    alert(gl.getShaderInfoLog(vshader));

  // フラグメントシェーダーを作成
  var fshader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fshader, $('#fshader').text());
  gl.compileShader(fshader);
  if(!gl.getShaderParameter(fshader, gl.COMPILE_STATUS))
    alert(gl.getShaderInfoLog(fshader));

  // プログラムオブジェクトを作成
  program = gl.createProgram();
  gl.attachShader(program, vshader);
  gl.attachShader(program, fshader);

  // シェーダー内の変数を頂点属性に結びつける
  $.each(["position", "normal", "uv"], function(i, name) {
    gl.bindAttribLocation(program, i, name);
  });

  // 頂点シェーダーとフラグメントシェーダーをリンクする
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program, gl.LINK_STATUS))
    alert(gl.getProgramInfoLog(program));

  // シェーダーパラメータのインデックスを取得・保存
  uniformVars = $.map(["mvpMatrix", "normalMatrix", "lightVec"], function(name) {
    return gl.getUniformLocation(program, name);
  });
}

function redrawScene() {
  // フレームカウントをインクリメント
  count += 1;

  // 画面をクリア
  gl.clearColor(0, 0, 0, 1);
  gl.clearDepth(1000);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // デプステストを有効にし、シェーダーを指定
  gl.enable(gl.DEPTH_TEST);
  gl.useProgram(program);

  // シェーダーに渡すパラメータを計算し、設定
  var lightVec  = [0.5773502691896258, 0.5773502691896258, 0.5773502691896258, 0.0];

  var modelMatrix = new CanvasMatrix4();
  modelMatrix.rotate(count, 0, 1, 0);

  var mvpMatrix = new CanvasMatrix4(modelMatrix);
  mvpMatrix.translate(0, 0, -6);
  mvpMatrix.perspective(30, 500.0 / 500.0, 0.1, 1000);

  var normalMatrix = new CanvasMatrix4(modelMatrix);
  normalMatrix.invert();
  normalMatrix.transpose();

  $.each([mvpMatrix, normalMatrix, lightVec], function(i, value) {
    if(value instanceof CanvasMatrix4)
      gl.uniformMatrix4fv(uniformVars[i], false, value.getAsWebGLFloatArray());
    else
      gl.uniform4fv(uniformVars[i], new Float32Array(value));
  });

  // VBOを頂点属性に割り当てる
  $.each([3, 3, 2], function(i, stride) {
    gl.enableVertexAttribArray(i);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuffers[i]);
    gl.vertexAttribPointer(i, stride, gl.FLOAT, false, 0, 0);
  });

  // IBOを指定
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuffer);

  // テクスチャを指定
  gl.enable(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // 描画
  gl.drawElements(gl.TRIANGLES, numIndices, gl.UNSIGNED_SHORT, 0);

  // ページに反映させる
  gl.flush();
}
