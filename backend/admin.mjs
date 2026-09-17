const roles = {
  super_admin: new Set(['dashboard','content','users','audit','delete_content','manage_users','manage_roles']),
  content_moderator: new Set(['dashboard','content','users','delete_content']),
  operations: new Set(['dashboard','content','users','audit'])
};
const allowedSort = new Set(['created_at','updated_at','last_active_at','display_name']);
const iso = value => { const date = new Date(value); return Number.isNaN(date.valueOf()) ? null : date.toISOString(); };
const page = req => Math.max(1, Math.min(10000, Number(req.query.page) || 1));
const size = req => Math.max(10, Math.min(100, Number(req.query.pageSize) || 25));
const safeSearch = value => String(value || '').trim().replace(/[%(),]/g,'').slice(0,100);

export async function installAdmin(app, db, requireUser, rootDir) {
  async function requireAdmin(permission) {
    return [requireUser, async (req,res,next) => {
      const { data, error } = await db.from('admin_users').select('role').eq('user_id',req.user.id).maybeSingle();
      if (error || !data || !roles[data.role]?.has(permission)) return res.status(403).json({ error:'没有后台操作权限' });
      req.adminRole=data.role; next();
    }];
  }
  async function audit(req, action, targetType, targetId, result='success', details={}) {
    await db.from('admin_audit_log').insert({ admin_id:req.user.id, action, target_type:targetType, target_id:String(targetId), result, details });
  }

  app.get('/admin', (_req,res) => res.sendFile(rootDir+'/admin.html'));
  app.post('/api/activity', async (req,res) => {
    const sessionId=String(req.body?.sessionId||'').slice(0,80); if(!sessionId)return res.status(400).json({error:'sessionId required'});
    let userId=null; const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    if(token) { const {data}=await db.auth.getUser(token); userId=data.user?.id||null; }
    const now=new Date().toISOString(), country=String(req.body?.country||'').slice(0,80)||null, city=String(req.body?.city||'').slice(0,80)||null, source=String(req.body?.source||'direct').slice(0,100);
    await db.from('analytics_events').insert({user_id:userId,session_id:sessionId,event_type:'active',country,city,source,created_at:now});
    if(userId){const patch={last_active_at:now};if(country)patch.country=country;if(city)patch.city=city;const {data:profile}=await db.from('profiles').select('acquisition_source').eq('id',userId).maybeSingle();if(!profile?.acquisition_source)patch.acquisition_source=source;await db.from('profiles').update(patch).eq('id',userId);}
    res.status(204).end();
  });
  app.get('/api/admin/me', ...(await requireAdmin('dashboard')), async(req,res)=>res.json({id:req.user.id,email:req.user.email,role:req.adminRole}));
  app.get('/api/admin/dashboard', async(req,res)=>{
    const to=iso(req.query.to)||new Date().toISOString(), from=iso(req.query.from)||new Date(Date.now()-30*864e5).toISOString(), onlineSince=new Date(Date.now()-5*60e3).toISOString();
    const day=new Date(Date.now()-864e5).toISOString(), week=new Date(Date.now()-7*864e5).toISOString(), month=new Date(Date.now()-30*864e5).toISOString();
    const count=(table,mutate=q=>q)=>mutate(db.from(table).select('*',{count:'exact',head:true}));
    const results=await Promise.all([
      count('profiles'),count('profiles',q=>q.gte('created_at',from).lte('created_at',to)),count('profiles',q=>q.gte('last_active_at',day)),count('profiles',q=>q.gte('last_active_at',week)),count('profiles',q=>q.gte('last_active_at',month)),count('profiles',q=>q.gte('last_active_at',onlineSince)),
      count('posts',q=>q.gte('created_at',from).lte('created_at',to)),count('comments',q=>q.gte('created_at',from).lte('created_at',to)),count('post_likes',q=>q.gte('created_at',from).lte('created_at',to)),
      db.from('profiles').select('created_at,last_active_at,country,city').gte('created_at',from).lte('created_at',to).limit(10000),db.from('posts').select('created_at').gte('created_at',from).lte('created_at',to).limit(10000),db.from('comments').select('created_at').gte('created_at',from).lte('created_at',to).limit(10000),
      db.from('profiles').select('id,display_name,username,avatar_url,created_at').order('created_at',{ascending:false}).limit(5),db.from('posts').select('id,title,created_at,profiles:author_id(display_name,username)').order('created_at',{ascending:false}).limit(5),db.from('comments').select('id,content,created_at,profiles:author_id(display_name,username)').order('created_at',{ascending:false}).limit(5)
    ]);
    const failed=results.find(x=>x.error); if(failed)return res.status(503).json({error:failed.error.message});
    const bucket=new Map(), add=(rows,key)=>rows.forEach(x=>{const d=x.created_at.slice(0,10),v=bucket.get(d)||{date:d,users:0,posts:0,comments:0};v[key]++;bucket.set(d,v)});
    add(results[9].data,'users');add(results[10].data,'posts');add(results[11].data,'comments');
    const geo={}; for(const x of results[9].data){const key=[x.country||'未知',x.city||'未知'].join(' · ');geo[key]=(geo[key]||0)+1;}
    res.json({metrics:{totalUsers:results[0].count,newUsers:results[1].count,dau:results[2].count,wau:results[3].count,mau:results[4].count,online:results[5].count,posts:results[6].count,comments:results[7].count,likes:results[8].count,retention:results[0].count?Math.round(results[4].count/results[0].count*100):0},trend:[...bucket.values()].sort((a,b)=>a.date.localeCompare(b.date)),geo:Object.entries(geo).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value).slice(0,12),latest:{users:results[12].data.map(x=>({display_name:'新用户 '+x.id.slice(0,6),created_at:x.created_at})),posts:results[13].data,comments:results[14].data}});
  });
  app.get('/api/admin/posts', ...(await requireAdmin('content')), async(req,res)=>{
    const p=page(req),s=size(req),q=safeSearch(req.query.q),sort=allowedSort.has(req.query.sort)?req.query.sort:'created_at'; let query=db.from('posts').select('*,profiles:author_id(id,display_name,username,avatar_url),post_media(*),comments(id,content,created_at,profiles:author_id(id,display_name,username)),post_likes(user_id)',{count:'exact'}).order(sort,{ascending:req.query.order==='asc'}).range((p-1)*s,p*s-1);
    if(q)query=query.or(`title.ilike.%${q}%,content.ilike.%${q}%`); if(req.query.user)query=query.eq('author_id',req.query.user); if(iso(req.query.from))query=query.gte('created_at',iso(req.query.from)); if(iso(req.query.to))query=query.lte('created_at',iso(req.query.to)); const {data,error,count}=await query; if(error)return res.status(503).json({error:error.message});res.json({items:data,total:count,page:p,pageSize:s});
  });
  app.delete('/api/admin/posts/:id', ...(await requireAdmin('delete_content')), async(req,res)=>{const {error}=await db.from('posts').delete().eq('id',req.params.id);await audit(req,'delete_post','post',req.params.id,error?'failure':'success',error?{message:error.message}:{});if(error)return res.status(503).json({error:error.message});res.status(204).end();});
  app.delete('/api/admin/comments/:id', ...(await requireAdmin('delete_content')), async(req,res)=>{const {error}=await db.from('comments').delete().eq('id',req.params.id);await audit(req,'delete_comment','comment',req.params.id,error?'failure':'success',error?{message:error.message}:{});if(error)return res.status(503).json({error:error.message});res.status(204).end();});
  app.get('/api/admin/users', ...(await requireAdmin('users')), async(req,res)=>{const p=page(req),s=size(req),q=safeSearch(req.query.q),sort=allowedSort.has(req.query.sort)?req.query.sort:'created_at';let query=db.from('profiles').select('*,posts(count),comments(count),admin_users(role)',{count:'exact'}).order(sort,{ascending:req.query.order==='asc'}).range((p-1)*s,p*s-1);if(q)query=query.or(`display_name.ilike.%${q}%,username.ilike.%${q}%`);if(req.query.status)query=query.eq('account_status',req.query.status);const {data,error,count}=await query;if(error)return res.status(503).json({error:error.message});res.json({items:data,total:count,page:p,pageSize:s});});
  app.patch('/api/admin/users/:id/status', ...(await requireAdmin('manage_users')), async(req,res)=>{const status=req.body?.status;if(!['active','suspended'].includes(status))return res.status(400).json({error:'无效账号状态'});const {data,error}=await db.from('profiles').update({account_status:status}).eq('id',req.params.id).select().single();await audit(req,status==='suspended'?'suspend_user':'unsuspend_user','user',req.params.id,error?'failure':'success');if(error)return res.status(503).json({error:error.message});res.json(data);});
  app.patch('/api/admin/users/:id/role', ...(await requireAdmin('manage_roles')), async(req,res)=>{const role=req.body?.role;if(!roles[role])return res.status(400).json({error:'无效角色'});const {error}=await db.from('admin_users').upsert({user_id:req.params.id,role,updated_at:new Date().toISOString()});await audit(req,'change_role','user',req.params.id,error?'failure':'success',{role});if(error)return res.status(503).json({error:error.message});res.json({role});});
  app.get('/api/admin/audit', ...(await requireAdmin('audit')), async(req,res)=>{const p=page(req),s=size(req),q=safeSearch(req.query.q);let query=db.from('admin_audit_log').select('*,profiles:admin_id(display_name,username)',{count:'exact'}).order('created_at',{ascending:false}).range((p-1)*s,p*s-1);if(q)query=query.or(`action.ilike.%${q}%,target_id.ilike.%${q}%`);const {data,error,count}=await query;if(error)return res.status(503).json({error:error.message});res.json({items:data,total:count,page:p,pageSize:s});});
}
