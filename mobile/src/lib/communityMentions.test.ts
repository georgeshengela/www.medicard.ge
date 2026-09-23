import test from 'node:test';
import assert from 'node:assert/strict';
import {editMentionRanges,mentionQuery} from './communityMentions.ts';
const text='Hi @ნაზი ნიავი hello';
const mention={targetId:'comment',kind:'comment' as const,label:'ნაზი ნიავი',start:3,end:3+'@ნაზი ნიავი'.length};
test('mention suggestions support Georgian multiword names and caret insertion',()=>{
 assert.deepEqual(mentionQuery('გამარჯობა @ნაზი',15,[]),{query:'ნაზი',start:10,end:15});
 assert.equal(mentionQuery('mail@example.org',16,[]),null);
 assert.equal(mentionQuery(text,14,[mention]),null);
});
test('text edits retain, shift or remove mention targets instead of tagging the wrong person',()=>{
 assert.deepEqual(editMentionRanges(text,'!'+text,[mention]),[{...mention,start:4,end:mention.end+1}]);
 assert.deepEqual(editMentionRanges(text,text+'!',[mention]),[mention]);
 assert.deepEqual(editMentionRanges(text,text.replace('ნაზი','სხვა'),[mention]),[]);
 assert.deepEqual(editMentionRanges(text,'',[mention]),[]);
});
