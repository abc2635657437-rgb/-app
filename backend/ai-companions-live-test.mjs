import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const base=process.env.TEST_API_BASE||'http://localhost:8789';
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
let id;
try{
  const email='tw-ai-check-'+randomUUID()+'@example.com',password='Tw!'+randomUUID();
  const created=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:'Temporary AI acceptance test'}});
  if(created.error)throw created.error;id=created.data.user.id;
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  assert.equal(login.status,200);const token=(await login.json()).session.access_token;
  for(const [region,language,message] of [['oceania','en','I want a short Sydney visit. In two sentences, explain what you can help plan and what I must verify.'],['asia','zh','用两句话说明你怎样帮助规划亚洲旅行的吃住与预算，哪些信息需要核实。']]){
    const response=await fetch(base+'/api/ai/companion',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({region,language,message}),signal:AbortSignal.timeout(50000)});
    const result=await response.json();assert.equal(response.status,200,result.error);assert.equal(result.isAI,true);assert.equal(result.region,region);assert(result.answer?.length>10);
    if(language==='en')assert(!/[\u3400-\u9fff]/.test(result.answer),'English reply contains Han text');else assert(/[\u3400-\u9fff]/.test(result.answer));
    console.log(region+': real authenticated AI reply and '+language+' language passed');
  }
}finally{
  if(id){const {error}=await db.auth.admin.deleteUser(id);if(error)throw error;console.log('Temporary AI test account removed.');}
}
