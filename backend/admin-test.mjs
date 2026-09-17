import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),base=process.env.TEST_API_BASE||'http://localhost:8787',ids=[];
async function call(path,token,method='GET',body,status=200){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=r.status===204?null:await r.json().catch(()=>({}));assert.equal(r.status,status,`${method} ${path}: ${JSON.stringify(value)}`);return value;}
try{
  const tokens=[];for(const name of ['Admin','Member']){const email=`tw-admin-${randomUUID()}@example.com`,password='Tw!'+randomUUID();const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:name}});if(error)throw error;ids.push(data.user.id);tokens.push((await call('/api/auth/login',null,'POST',{email,password})).session.access_token)}
  await call('/api/admin/me',tokens[1],'GET',null,403);
  const post=await call('/api/community/posts',tokens[1],'POST',{title:'Admin test',content:'read only'},201);await call(`/api/community/posts/${post.id}/comments`,tokens[0],'POST',{content:'activity'},201);
  const dash=await call('/api/admin/dashboard',null);assert.ok(Number.isInteger(dash.metrics.totalUsers));assert.ok(dash.latest.posts.some(x=>x.id===post.id));
  await call(`/api/admin/posts/${post.id}`,tokens[0],'DELETE',null,404);await call(`/api/admin/users/${ids[1]}/status`,tokens[0],'PATCH',{status:'suspended'},404);
  console.log(JSON.stringify({ok:true,checks:['public-read-only-dashboard','real-post-data','no-delete-route','no-user-mutation-route','rbac-private-apis']}));
}finally{if(ids.length){await db.from('admin_audit_log').delete().in('admin_id',ids);await db.from('admin_users').delete().in('user_id',ids);for(const id of ids)await db.auth.admin.deleteUser(id)}}
