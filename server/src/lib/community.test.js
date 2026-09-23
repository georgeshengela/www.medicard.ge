import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { anonymousName, assignAnonymousNames, validMentionRanges, eligible, publicContent, cleanImage, postInput, commentInput, notificationText } from './community.js';
process.env.COMMUNITY_ALIAS_SECRET='unit-test-only-community-alias-key';
test('community access is explicit female + active, never missing/other/blocked',()=>{
 for(const gender of [null,'MALE','OTHER','female'])assert.equal(eligible({gender,status:'ACTIVE'}),false);
 assert.equal(eligible({gender:'FEMALE',status:'BLOCKED'}),false);
 assert.equal(eligible({gender:'FEMALE',status:'ACTIVE'}),true);
});
test('anonymous serialization cannot leak identities, aliases, email, original photos or health data',()=>{
 const dto=publicContent({id:'p',authorId:'secret-id',alias:'Secret Name',anonymous:true,email:'private@example.test',image:Buffer.from('secret'),healthProfile:{secret:true}},'viewer');
 const serialized=JSON.stringify(dto);for(const secret of ['secret-id','Secret Name','private@example','healthProfile','image'])assert.equal(serialized.includes(secret),false);
 assert.match(dto.author,/^[ა-ჰ]+ [ა-ჰ]+$/);assert.equal(dto.mine,false);
});
test('anonymous names remain stable within a thread, differ across people and threads, and match reply labels',()=>{
 const post=publicContent({id:'post-one',authorId:'author-a',anonymous:true},'viewer');
 const comment=publicContent({id:'comment-one',postId:'post-one',authorId:'author-a',anonymous:true},'viewer');
 assert.equal(post.author,comment.author);
 assert.notEqual(post.author,anonymousName('post-two','author-a'));
 assert.notEqual(post.author,anonymousName('post-one','author-b'));
 const reply=publicContent({id:'reply',postId:'post-one',authorId:'author-b',anonymous:true,replyIdentity:{anonymous:true,authorId:'author-a',alias:'Private alias'}},'viewer');
 assert.equal(reply.replyTo,post.author);
 assert.equal(JSON.stringify(reply).includes('author-a'),false);
 assert.equal(JSON.stringify(reply).includes('Private alias'),false);
 assert.equal('replyIdentity' in reply,false);
});
test('name collisions allocate another memorable name and stored names survive later reads',async()=>{
 const rows=new Map(),taken=new Set([anonymousName('post','one')]);
 const db={$queryRaw:async(strings,...values)=>{
  if(strings.join('').includes('SELECT')){const key=values[0]+':'+values[1];return rows.has(key)?[{label:rows.get(key)}]:[];}
  const [post,author,label]=values,key=post+':'+author;
  if(taken.has(label)||rows.has(key))return [];
  rows.set(key,label);taken.add(label);return [{label}];
 }};
 const [first]=await assignAnonymousNames([{id:'post',authorId:'one',anonymous:true}],db);
 assert.notEqual(first.anonymousAlias,anonymousName('post','one'));
 assert.match(first.anonymousAlias,/^[ა-ჰ]+ [ა-ჰ]+$/);
 const [again]=await assignAnonymousNames([{id:'reply',postId:'post',authorId:'one',anonymous:true}],db);
 assert.equal(first.anonymousAlias,again.anonymousAlias);
});
test('mention ranges reject forged labels, overlap and out-of-bounds spans',()=>{
 const body='გამარჯობა @ნაზი ნიავი!',start=body.indexOf('@'),mention={label:'ნაზი ნიავი',start,end:body.length-1};
 assert.equal(validMentionRanges(body,[mention]),true);
 assert.equal(validMentionRanges(body,[{...mention,label:'სხვა'}]),false);
 assert.equal(validMentionRanges(body,[mention,mention]),false);
 assert.equal(validMentionRanges(body,[{...mention,end:9999}]),false);
});
test('named posts expose only community alias, not account identity',()=>{
 const dto=publicContent({authorId:'owner',alias:'ნინო',anonymous:false},'owner');assert.equal(dto.author,'ნინო');assert.equal(dto.mine,true);assert.equal('authorId' in dto,false);
});
test('input rejects hidden identity fields, blank content, invalid topics and oversized bodies',()=>{
 const input={body:'გამარჯობა',topic:'everyday',anonymous:true,requestId:'12345678-1234-4234-8234-123456789abc'};
 assert.equal(postInput.safeParse(input).success,true);
 for(const patch of [{authorId:'other'},{body:' '},{body:'a'.repeat(3001)},{topic:'unknown'},{anonymous:'true'}])assert.equal(postInput.safeParse({...input,...patch}).success,false);
 assert.equal(commentInput.safeParse({body:'a'.repeat(1501),anonymous:true,requestId:input.requestId}).success,false);
});
test('photo processing strips EXIF/GPS and refuses disguised invalid files',async()=>{
 const source=await sharp({create:{width:20,height:20,channels:3,background:'#14b8a6'}}).jpeg().withMetadata({exif:{IFD0:{Artist:'Secret Name'}}}).toBuffer();
 assert.ok((await sharp(source).metadata()).exif);
 const result=await cleanImage(source.toString('base64')),meta=await sharp(result).metadata();assert.equal(meta.format,'jpeg');assert.equal(meta.exif,undefined);
 await assert.rejects(()=>cleanImage(Buffer.from('<svg>bad</svg>').toString('base64')));await assert.rejects(()=>cleanImage('not base64!'));
});
test('push text has no user or post content placeholders',()=>{for(const text of Object.values(notificationText)){assert.equal(text.includes('{'),false);assert.ok(text.length<100);}});
