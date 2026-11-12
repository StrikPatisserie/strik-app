declare module "heic-decode" {
  type DecodedImage = { width: number; height: number; data: Uint8ClampedArray };
  type ImageCollection = Array<{ width: number; height: number; decode: () => Promise<DecodedImage> }> & { dispose: () => void };
  const decode: {
    (input: { buffer: Uint8Array }): Promise<DecodedImage>;
    all(input: { buffer: Uint8Array }): Promise<ImageCollection>;
  };
  export default decode;
}
