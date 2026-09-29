import sharp from "sharp";

/** Long edge cap — text on infographics stays readable; file size stays moderate. */
const MAX_LONG_EDGE = 1920;
const JPEG_QUALITY = 87;

export async function compressImageToJpeg(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize(MAX_LONG_EDGE, MAX_LONG_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

export function decodeDataUrlToBuffer(dataUrl: string): Buffer {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Buffer.from(b64, "base64");
}
