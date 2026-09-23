import { z } from 'zod';
import sharp from 'sharp';
export const COMMUNITY_RULES_VERSION = '2026-09-23';
export const topics = ['everyday','cycle','pregnancy','wellbeing'];
export const id = z.string().uuid();
export const postInput = z.object({ body:z.string().trim().min(1).max(3000), topic:z.enum(topics), anonymous:z.boolean(), requestId:id, image:z.string().max(1500000).nullable().optional() }).strict();
export const commentInput = z.object({ body:z.string().trim().min(1).max(1500), anonymous:z.boolean(), requestId:id, parentId:id.nullable().optional() }).strict();
export function fail(status,message) { throw Object.assign(new Error(message),{status}); }
export function eligible(user) { return user?.gender === 'FEMALE' && user?.status === 'ACTIVE'; }
// Explicit allowlist: never spread database rows into member-facing responses.
export function publicContent(row, viewer) {
 return { id:row.id, revision:Number(row.revision||0), body:row.body, topic:row.topic, anonymous:row.anonymous,
  author:row.anonymous ? 'ანონიმური წევრი' : row.alias,
  mine:row.authorId===viewer, status:row.status, createdAt:row.createdAt,
  hasImage:!!row.hasImage, likes:Number(row.likes||0), dislikes:Number(row.dislikes||0),
  comments:Number(row.comments||0), reaction:Number(row.reaction||0), reactions:row.reactions||{}, myReaction:row.myReaction||null, parentId:row.parentId||null, replyTo:row.replyTo||null, liked:!!row.liked };
}
export async function cleanImage(encoded) {
 if(!encoded)return null;
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) fail(400,'ფოტოს ფორმატი არასწორია.');
 const bytes=Buffer.from(encoded,'base64');
 if(bytes.length>1050000)fail(400,'ფოტოს ზომა ძალიან დიდია.');
 try {
  const img=sharp(bytes,{limitInputPixels:20000000,animated:false,failOn:'error'});
  const meta=await img.metadata();
  if(!['jpeg','png','webp'].includes(meta.format)|| (meta.pages||1)>1)fail(400,'აირჩიე JPEG, PNG ან WebP ფოტო.');
  // Re-encoding intentionally strips all EXIF, GPS, filename and embedded metadata.
  return await img.rotate().resize(1200,1200,{fit:'inside',withoutEnlargement:true}).jpeg({quality:80}).toBuffer();
 }catch(e){if(e.status)throw e;fail(400,'ფოტო ვერ დამუშავდა. აირჩიე სხვა ფოტო.');}
}
export const notificationText={like:'შენს პოსტზე ახალი რეაქციაა.',dislike:'შენს პოსტზე ახალი განსხვავებული აზრია.',comment:'შენს პოსტზე ახალი კომენტარია.',approved:'შენი ჩანაწერი გამოქვეყნდა.',reply:'შენს კომენტარს უპასუხეს.',comment_like:'შენი კომენტარი მოიწონეს.'};
