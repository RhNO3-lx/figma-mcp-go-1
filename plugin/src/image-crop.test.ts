import { describe,it,expect } from 'bun:test';
import { imageCropTransform } from './image-crop';
describe('fixed shape image crop',()=>{
 it('covers a square avatar without changing the node geometry',()=>{
  expect(imageCropTransform(400,200,44,44,{x:0,y:0,width:1,height:1})).toEqual([[0.5,0,0.25],[0,1,0]]);
  expect(imageCropTransform(400,200,44,44,{x:0,y:0,width:0.5,height:1})).toEqual([[0.5,0,0],[0,1,0]]);
 });
 it('rejects invalid or outside normalized crop',()=>{
  for(const crop of [{x:0.8,y:0,width:0.5,height:1},{x:0,y:0,width:0,height:1},{x:NaN,y:0,width:1,height:1}])expect(()=>imageCropTransform(400,200,44,44,crop)).toThrow();
 });
});
it('outline style serialization preserves hidden motion-state opacity, omitting normal default',async()=>{
 const {serializeStyles}=await import('./serializers');
 expect((await serializeStyles({opacity:0})).opacity).toBe(0);
 expect((await serializeStyles({opacity:1})).opacity).toBeUndefined();
});
