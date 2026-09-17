import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const base = process.env.TEST_API_BASE || 'http://localhost:8787';
const ids = [], checks = [];
async function api(path, token, method='GET', body, expected=200) {
  const r = await fetch(base+path,{ method, headers:{'Content-Type':'application/json', ...(token?{Authorization:'Bearer '+token}:{})}, ...(body?{body:JSON.stringify(body)}:{}) });
  const value = await r.json().catch(()=>null);
  assert.equal(r.status,expected,path+': '+JSON.stringify(value));
  return value;
}
try {
  const tokens=[];
  for(let i=0;i<3;i++) {
    const email='tw-dm-'+randomUUID()+'@example.com', password='Tw!'+randomUUID();
    const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:'私聊验收 '+i}});
    if(error)throw error;
    ids.push(data.user.id);
    tokens.push((await api('/api/auth/login',null,'POST',{email,password})).session.access_token);
  }
  const [a,b,c]=tokens;
  await api('/api/dm',null,'GET',null,401);
  assert.equal((await api('/api/dm/users/'+ids[1],a)).id,ids[1]);
  const opened=await Promise.all([api('/api/dm/users/'+ids[1],a,'POST'),api('/api/dm/users/'+ids[0],b,'POST'),api('/api/dm/users/'+ids[1],a,'POST')]);
  assert.equal(new Set(opened.map(x=>x.chatId)).size,1);
  const id=opened[0].chatId, path='/api/dm/'+id;
  checks.push('real-login','profile','concurrent-unique-conversation');
  const nonce=randomUUID();
  const sent=await Promise.all([api(path+'/messages',a,'POST',{content:'真实文字消息 A → B',clientId:nonce},201),api(path+'/messages',a,'POST',{content:'真实文字消息 A → B',clientId:nonce},201)]);
  assert.equal(sent[0].id,sent[1].id);
  let list=await api('/api/dm',b);
  assert.equal(list[0].unread_count,1);assert.equal(list[0].user.id,ids[0]);assert.equal(list[0].last_message.content,'真实文字消息 A → B');
  let messages=await api(path+'/messages',b);
  assert.equal(messages.messages.length,1);
  const persisted=await db.from('dm_messages').select('id').eq('id',sent[0].id).single();
  assert.equal(persisted.data.id,sent[0].id);
  checks.push('persistent-delivery','last-message','unread-1','idempotent-retry');
  await api(path+'/messages',c,'GET',null,403);
  await api(path+'/messages',c,'POST',{content:'forbidden',clientId:randomUUID()},403);
  await api(path+'/read',c,'PATCH',{through:1},403);
  await api(path,c,'DELETE',null,403);
  assert.equal((await api('/api/dm',c)).length,0);
  const external=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{global:{headers:{Authorization:'Bearer '+c}},auth:{persistSession:false}});
  assert.ok((await external.from('dm_messages').select('*')).error);
  assert.ok((await external.rpc('tw_dm_action',{p_actor:ids[0],p_action:'list'})).error);
  checks.push('outsider-read-send-delete-denied','database-access-denied');
  await api(path+'/read',b,'PATCH',{through:1});
  assert.equal((await api('/api/dm',b))[0].unread_count,0);
  const second=await api(path+'/messages',a,'POST',{content:'第二条',clientId:randomUUID()},201);
  await api(path+'/read',b,'PATCH',{through:1});
  assert.equal((await api('/api/dm',b))[0].unread_count,1);
  await api(path+'/read',b,'PATCH',{through:second.seq});
  assert.equal((await api('/api/dm',b))[0].unread_count,0);
  assert.equal((await api(path+'/messages',a)).peerRead,second.seq);
  const reply=await api(path+'/messages',b,'POST',{content:'收到，B → A',clientId:randomUUID()},201);
  assert.equal((await api('/api/dm',a))[0].unread_count,1);
  checks.push('read-0','read-race-safe','read-receipt','bidirectional');
  await api(path,a,'DELETE');
  assert.equal((await api('/api/dm',a)).length,0);
  assert.equal((await api(path+'/messages',a)).messages.length,0);
  assert.equal((await api(path+'/messages',b)).messages.length,3);
  await api(path+'/messages',b,'POST',{content:'删除后新消息',clientId:randomUUID()},201);
  assert.equal((await api('/api/dm',a))[0].unread_count,1);
  assert.equal((await api(path+'/messages',a)).messages.length,1);
  assert.equal((await api('/api/dm/users/'+ids[1],a,'POST')).chatId,id);
  checks.push('delete-only-self','new-message-restores-conversation');
  await api(path+'/messages',a,'POST',{content:' ',clientId:randomUUID()},400);
  await api(path+'/messages',a,'POST',{content:'x'.repeat(4001),clientId:randomUUID()},400);
  await api('/api/dm/users/'+ids[0],a,'POST',null,400);
  // More than one page must retain the newest messages and allow older history.
  for(let i=0;i<102;i++) {
    const result=await db.rpc('tw_dm_action',{p_actor:ids[0],p_action:'send',p_chat:id,p_content:'分页 '+i,p_client:randomUUID()});
    if(result.error)throw result.error;
  }
  messages=await api(path+'/messages',b);
  assert.equal(messages.messages.length,100);assert.equal(messages.hasMore,true);
  const older=await api(path+'/messages?before='+messages.messages[0].seq,b);
  assert.equal(older.messages.length,6);
  checks.push('validation','history-pagination');
  console.log(JSON.stringify({ok:true,checks}));
} finally {
  for(const id of ids) { const {error}=await db.auth.admin.deleteUser(id); if(error)throw error; }
  console.log('Temporary test accounts removed.');
}
