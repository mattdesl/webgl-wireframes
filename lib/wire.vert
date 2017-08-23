attribute vec3 barycentric;
attribute float even;

varying vec3 vBarycentric;

varying vec3 vPosition;
varying float vEven;
varying vec2 vUv;


void main () {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xyz, 1.0);
  vBarycentric = barycentric;
  vPosition = position.xyz;
  vEven = even;
  vUv = uv;
}