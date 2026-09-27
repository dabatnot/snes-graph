import { decode } from "fast-png";
import { uid, type DrawingReference } from "./model";

export function referenceDimensions(png: Uint8Array) {
  if (
    !(png instanceof Uint8Array) ||
    png.length < 33 ||
    png.length > 128 * 1024 * 1024 ||
    ![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => png[i] === v)
  )
    throw new Error("Invalid reference PNG / PNG de référence invalide");
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const width = view.getUint32(16),
    height = view.getUint32(20);
  if (!width || !height || width > 4096 || height > 4096)
    throw new Error(
      "Reference PNG exceeds 4096 × 4096 / Référence PNG limitée à 4096 × 4096",
    );
  return { width, height };
}
export function fitReference(
  nativeWidth: number,
  nativeHeight: number,
  width: number,
  height: number,
) {
  const scale = Math.min(width / nativeWidth, height / nativeHeight);
  return {
    x: (width - nativeWidth * scale) / 2,
    y: (height - nativeHeight * scale) / 2,
    width: nativeWidth * scale,
  };
}
export function createReference(
  png: Uint8Array,
  name: string,
  width: number,
  height: number,
): DrawingReference {
  const size = referenceDimensions(png);
  decode(png, { checkCrc: true }); // Validate the complete image before replacing an existing reference.
  return {
    id: uid(),
    name,
    png,
    nativeWidth: size.width,
    nativeHeight: size.height,
    ...fitReference(size.width, size.height, width, height),
    opacity: 0.5,
    visible: true,
  };
}
export function validateReference(r: DrawingReference) {
  const size = referenceDimensions(r.png);
  if (
    typeof r.id !== "string" ||
    !r.id ||
    typeof r.name !== "string" ||
    r.nativeWidth !== size.width ||
    r.nativeHeight !== size.height ||
    ![r.x, r.y, r.width, r.opacity].every(Number.isFinite) ||
    r.width <= 0 ||
    r.width > 32767 ||
    Math.abs(r.x) > 32768 ||
    Math.abs(r.y) > 32768 ||
    r.opacity < 0 ||
    r.opacity > 1 ||
    typeof r.visible !== "boolean"
  )
    throw new Error("Invalid image reference / Référence invalide");
}
