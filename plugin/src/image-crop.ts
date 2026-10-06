export type CropRegion = { x: number; y: number; width: number; height: number };
/** Map a fixed node's normalized coordinates into a cover crop of an image region. */
export const imageCropTransform = (iw: number, ih: number, nw: number, nh: number, crop: CropRegion): Transform => {
  if (![iw,ih,nw,nh,crop.width,crop.height].every(v=>Number.isFinite(v)&&v>0) || ![crop.x,crop.y].every(v=>Number.isFinite(v)&&v>=0) || crop.x+crop.width>1 || crop.y+crop.height>1) throw new Error('Crop must be a positive normalized rectangle within the image');
  let w=crop.width,h=crop.height;
  if(w*iw/(h*ih)>nw/nh)w=h*ih*nw/nh/iw;else h=w*iw*nh/nw/ih;
  return [[w,0,crop.x+(crop.width-w)/2],[0,h,crop.y+(crop.height-h)/2]];
};
