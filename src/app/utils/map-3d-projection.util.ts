/** Projection d’un point mercator (x, y, z) vers le canvas via la matrice VP MapLibre. */
export function projectMercatorToCanvasPoint(
  mainMatrix: ArrayLike<number>,
  mercatorX: number,
  mercatorY: number,
  mercatorZ: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number; visible: boolean } {
  const m = mainMatrix;
  const w =
    m[3] * mercatorX + m[7] * mercatorY + m[11] * mercatorZ + m[15];
  if (w <= 0) {
    return { x: 0, y: 0, visible: false };
  }

  const clipX =
    (m[0] * mercatorX + m[4] * mercatorY + m[8] * mercatorZ + m[12]) / w;
  const clipY =
    (m[1] * mercatorX + m[5] * mercatorY + m[9] * mercatorZ + m[13]) / w;

  return {
    x: (clipX * 0.5 + 0.5) * canvasWidth,
    y: (1 - (clipY * 0.5 + 0.5)) * canvasHeight,
    visible:
      clipX >= -1.2 &&
      clipX <= 1.2 &&
      clipY >= -1.2 &&
      clipY <= 1.2
  };
}
