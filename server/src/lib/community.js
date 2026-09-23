import { z } from 'zod';
import sharp from 'sharp';
import { createHmac } from 'node:crypto';
// Scoped to one discussion: a public label cannot link someone's other posts.
const adjectives=['მშვიდი','ნაზი','ნათელი','ცისფერი','ოქროსფერი','ვერცხლისფერი','თბილი','მზიანი','ფერადი','მოციმციმე','მომღიმარი','მოელვარე','მშვენიერი','მყუდრო','თავისუფალი','ცოცხალი','სხივოსანი','დილის','საღამოს','მთვარის','ზღვის','გაზაფხულის','ზაფხულის','შემოდგომის','ზამთრის','ვარსკვლავის','ცისარტყელის','ტყის','მთის','აისის','განთიადის','ბაღის'];
const nouns=['ნიავი','შუქი','ტალღა','სხივი','ვარდი','იასამანი','გვირილა','ვარსკვლავი','ღრუბელი','პეპელა','მერცხალი','ნამი','ჰორიზონტი','მელოდია','ზარი','ფოთოლი','ყვავილი','ლოტოსი','ორქიდეა','ლავანდა','მარგალიტი','ცისკარი','ნაპერწკალი','ბრწყინვალება','სიზმარი','ზღაპარი','ნაკადული','ჩანჩქერი','ბილიკი','ხავერდი','სურნელი','ცისარტყელა'];
export function anonymousName(postId, authorId, attempt=0) {
 const secret=process.env.COMMUNITY_ALIAS_SECRET||process.env.JWT_SECRET;
 if(!secret||!postId||!authorId)throw new Error('Anonymous identity context is missing');
 const hash=createHmac('sha256',secret).update(JSON.stringify(['community-name-v2',postId,authorId,attempt])).digest();
 return `${adjectives[hash[0]%adjectives.length]} ${attempt<32?'':adjectives[hash[2]%adjectives.length]+' '}${nouns[hash[1]%nouns.length]}`;
}
export async function assignAnonymousNames(rows,db){
 const cache=new Map();
 async function label(postId,authorId){
  const key=postId+':'+authorId;if(cache.has(key))return cache.get(key);
  for(let attempt=0;attempt<128;attempt++){
   const [existing]=await db.$queryRaw`SELECT label FROM "CommunityAlias" WHERE "postId"=${postId} AND "authorId"=${authorId}`;
   if(existing){cache.set(key,existing.label);return existing.label;}
   const candidate=anonymousName(postId,authorId,attempt);
   const inserted=await db.$queryRaw`INSERT INTO "CommunityAlias" ("postId","authorId",label) VALUES (${postId},${authorId},${candidate}) ON CONFLICT DO NOTHING RETURNING label`;
   if(inserted[0]){cache.set(key,candidate);return candidate;}
  }
  throw new Error('Could not allocate a distinct anonymous name');
 }
 for(const row of rows){
  if(row.anonymous)row.anonymousAlias=await label(row.postId||row.id,row.authorId);
  if(row.replyIdentity?.anonymous)row.replyIdentity.anonymousAlias=await label(row.postId,row.replyIdentity.authorId);
 }
 return rows;
}
export const COMMUNITY_RULES_VERSION = '2026-09-23';
export const topics = ['everyday','cycle','pregnancy','wellbeing'];
export const id = z.string().uuid();
export const postInput = z.object({ body:z.string().trim().min(1).max(3000), topic:z.enum(topics), anonymous:z.boolean(), requestId:id, image:z.string().max(1500000).nullable().optional() }).strict();
export const mentionInput=z.object({targetId:id,kind:z.enum(['post','comment']),label:z.string().min(1).max(100),start:z.number().int().min(0),end:z.number().int().min(1)}).strict();
export const commentInput = z.object({ body:z.string().min(1).max(1500).refine(v=>!!v.trim()), anonymous:z.boolean(), requestId:id, parentId:id.nullable().optional(),mentions:z.array(mentionInput).max(10).default([]) }).strict();
export function validMentionRanges(body,mentions){let end=0;for(const m of [...mentions].sort((a,b)=>a.start-b.start)){if(m.start<end||m.end>body.length||body.slice(m.start,m.end)!=='@'+m.label)return false;end=m.end;}return true;}
export function fail(status,message) { throw Object.assign(new Error(message),{status}); }
export function eligible(user) { return user?.gender === 'FEMALE' && user?.status === 'ACTIVE'; }
// Explicit allowlist: never spread database rows into member-facing responses.
export function publicContent(row, viewer) {
 return { id:row.id, revision:Number(row.revision||0), body:row.body, topic:row.topic, anonymous:row.anonymous,
  author:row.anonymous ? row.anonymousAlias||anonymousName(row.postId||row.id,row.authorId) : row.alias,
  mine:row.authorId===viewer, status:row.status, createdAt:row.createdAt,
  hasImage:!!row.hasImage, likes:Number(row.likes||0), dislikes:Number(row.dislikes||0),
  comments:Number(row.comments||0), reaction:Number(row.reaction||0), reactions:row.reactions||{}, myReaction:row.myReaction||null, parentId:row.parentId||null, replyTo:row.replyIdentity ? (row.replyIdentity.anonymous ? row.replyIdentity.anonymousAlias||anonymousName(row.postId,row.replyIdentity.authorId) : row.replyIdentity.alias) : row.replyTo||null, liked:!!row.liked,
  mentions:(row.mentions||[]).map(m=>({label:m.label,start:m.start,end:m.end,targetId:m.targetId,kind:m.kind})) };
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
export const notificationText={mention:'კომენტარში მოგნიშნეს.',like:'შენს პოსტზე ახალი რეაქციაა.',dislike:'შენს პოსტზე ახალი განსხვავებული აზრია.',comment:'შენს პოსტზე ახალი კომენტარია.',approved:'შენი ჩანაწერი გამოქვეყნდა.',reply:'შენს კომენტარს უპასუხეს.',comment_like:'შენი კომენტარი მოიწონეს.'};
