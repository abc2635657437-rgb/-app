import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),base=process.env.TEST_API_BASE||'http://localhost:8787',ids=[];
async function call(path,token,method='GET',body,status=200){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=r.status===204?null:await r.json().catch(()=>({}));assert.equal(r.status,status,`${method} ${path}: ${JSON.stringify(value)}`);return value;}
try{
  const tokens=[];for(const name of ['Admin','Member']){const email=`tw-admin-${randomUUID()}@example.com`,password='Tw!'+randomUUID();const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:name}});if(error)throw error;ids.push(data.user.id);tokens.push((await call('/api/auth/login',null,'POST',{email,password})).session.access_token)}
  await db.from('admin_users').insert({user_id:ids[0],role:'super_admin'});
  await call('/api/admin/me',tokens[1],'GET',null,403);assert.equal((await call('/api/admin/me',tokens[0])).role,'super_admin');
  await call('/api/activity',tokens[1],'POST',{sessionId:randomUUID(),source:'admin-test'},204);
  const post=await call('/api/community/posts',tokens[1],'POST',{title:'Admin test',content:'moderate me'},201),comment=await call(`/api/community/posts/${post.id}/comments`,tokens[1],'POST',{content:'remove me'},201);
  const content=await call('/api/admin/posts?q=Admin',tokens[0]);assert.ok(content.items.some(x=>x.id===post.id));
  await call(`/api/admin/comments/${comment.id}`,tokens[0],'DELETE',null,204);await call(`/api/admin/posts/${post.id}`,tokens[0],'DELETE',null,204);
  await call(`/api/admin/users/${ids[1]}/status`,tokens[0],'PATCH',{status:'suspended'});await call('/api/users/me',tokens[1],'GET',null,403);await call(`/api/admin/users/${ids[1]}/status`,tokens[0],'PATCH',{status:'active'});
  const dash=await call('/api/admin/dashboard',tokens[0]);assert.ok(Number.isInteger(dash.metrics.totalUsers));const audit=await call('/api/admin/audit',tokens[0]);assert.ok(audit.items.some(x=>x.target_id===post.id));
  console.log(JSON.stringify({ok:true,checks:['rbac','activity','dashboard','content-search','delete-comment','delete-post','suspend','unsuspend','audit']}));
}finally{if(ids.length){await db.from('admin_audit_log').delete().in('admin_id',ids);await db.from('admin_users').delete().in('user_id',ids);for(const id of ids)await db.auth.admin.deleteUser(id)}}
