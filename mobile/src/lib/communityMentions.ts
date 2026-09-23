export type CommunityMention={targetId:string;kind:'post'|'comment';label:string;start:number;end:number};
export type MentionCandidate=Pick<CommunityMention,'targetId'|'kind'|'label'>&{anonymous:boolean;avatarId?:string|null};
export function editMentionRanges(before:string,after:string,mentions:CommunityMention[]){
 let start=0;while(start<before.length&&start<after.length&&before[start]===after[start])start++;
 let oldEnd=before.length,newEnd=after.length;
 while(oldEnd>start&&newEnd>start&&before[oldEnd-1]===after[newEnd-1]){oldEnd--;newEnd--;}
 const delta=after.length-before.length;
 return mentions.flatMap(m=>{
  if(m.end<=start)return [m];
  if(m.start>=oldEnd)return [{...m,start:m.start+delta,end:m.end+delta}];
  return [];
 }).filter(m=>after.slice(m.start,m.end)==='@'+m.label);
}
export function mentionQuery(body:string,cursor:number,mentions:CommunityMention[]){
 if(mentions.some(m=>cursor>m.start&&cursor<=m.end+1))return null;
 const match=body.slice(0,cursor).match(/(?:^|\s)@([^@\n]{0,60})$/);
 return match?{query:match[1],start:cursor-match[1].length-1,end:cursor}:null;
}
