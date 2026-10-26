import {load,JSON_SCHEMA} from '../lib/vendor/yaml.mjs';
import {createHash,timingSafeEqual,randomUUID} from 'node:crypto';
export const seed={id:'aisensy',name:'AiSensy broadcast sync',description:'Your latest broadcasts, content and campaign metrics. Together in Google Sheets.',repository:'Sarthak-B/aisensy-broadcast-tracker',workflow:'test.yml',branch:'',category:'Messaging'};
export const discrepancy={id:'discrepancy',name:'Discrepancy tracker',description:'Compare registrations across your UTM sheets, FlexiFunnels and Zoom. Choose the reporting inputs before each run.',repository:'Sarthak-B/flexifunnels-discrepancy-tracker',workflow:'',branch:'',category:'Reporting'};
const key='sarthakautoklerk:v1:workflows';
function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
function digest(v){return createHash('sha256').update(v).digest();}
export async function redis(...command){
 const url=(process.env.UPSTASH_REDIS_REST_URL||'').trim(),token=(process.env.UPSTASH_REDIS_REST_TOKEN||'').trim();
 if(!url||!token)fail('Persistent storage is not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, then redeploy.',503);
 let endpoint;try{endpoint=new URL(url);}catch{fail('UPSTASH_REDIS_REST_URL is not a valid URL. Paste only the HTTPS endpoint, without quotes or the variable name, then redeploy.',503);}
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||endpoint.pathname!=='/')fail('UPSTASH_REDIS_REST_URL must be the HTTPS REST endpoint only. Do not use redis://, a connection command, or a URL with a path.',503);
 if(/[\s"']/.test(token)||token.startsWith('Bearer ')||token.startsWith('UPSTASH_'))fail('UPSTASH_REDIS_REST_TOKEN must contain only the token value, without quotes, spaces, Bearer, or the variable name.',503);
 let r;try{r=await fetch(endpoint.href,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(10000)});}catch{fail('Cannot connect to the Upstash REST endpoint. Check the endpoint spelling and that the database is active, then retry.',503);}
 if(r.status===401||r.status===403)fail('Upstash rejected the REST token. Use the standard read/write token from the same database as the REST URL, then redeploy.',503);
 if(r.status===429)fail('Upstash storage is rate limited. Check the database usage and retry later.',503);
 if(!r.ok)fail('Upstash returned HTTP '+r.status+'. Check the REST endpoint and database status.',503);
 let d;try{d=await r.json();}catch{fail('The storage endpoint did not return JSON. Check that you copied the database HTTPS REST endpoint.',503);}
 if(d.error)fail('Upstash rejected the storage command. Check that the token is read/write and the database has available capacity.',503);
 if(!Object.hasOwn(d,'result'))fail('Unexpected storage response. Check the Upstash REST endpoint.',503);
 return d.result;
}
function allowed(repo){return (process.env.ALLOWED_REPOSITORIES||seed.repository+','+discrepancy.repository).split(',').some(x=>x.trim().toLowerCase()===repo.toLowerCase());}
async function github(path,options={}){
 if(!process.env.GITHUB_TOKEN)fail('Add GITHUB_TOKEN as a server secret before running workflows.',503);
 let r;try{r=await fetch('https://api.github.com'+path,{...options,headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2026-03-10','User-Agent':'SarthakAutoKlerk'},signal:AbortSignal.timeout(20000)});}catch{fail('GitHub did not respond. Check Activity before trying a run again.',502);}
 if(!r.ok){if(r.status===401)fail('GitHub token is invalid or expired.',502);if(r.status===403)fail('GitHub denied access. Grant the token repository access and Actions read/write permission, or check its rate limit.',502);if(r.status===404)fail('GitHub repository or workflow not found, or the token cannot access it.',502);fail(`GitHub rejected the request (${r.status}). Check the workflow branch and manual-run settings.`,502);}
 return r.status===204?null:await r.json();
}
async function catalog(){
 discrepancy.workflow=process.env.DISCREPANCY_WORKFLOW||'';
 const raw=await redis('GET',key);let rows=[];
 if(raw){try{rows=JSON.parse(raw);}catch{fail('The saved workflow registry contains invalid JSON. Its data has been preserved; ask the owner to inspect the registry.',503);}}
 if(!Array.isArray(rows)||rows.some(w=>!valid(w)||typeof w.id!=='string'))fail('The saved workflow registry has an unsupported format. Its data has been preserved.',503);
 return [seed,discrepancy,...rows];
}
const base=w=>'/repos/'+w.repository.split('/').map(encodeURIComponent).join('/');
export function parseInputs(text){
 const doc=load(text,{schema:JSON_SCHEMA});
 const event=doc?.on;
 if(!(event==='workflow_dispatch'||Array.isArray(event)&&event.includes('workflow_dispatch')||event&&Object.hasOwn(event,'workflow_dispatch')))fail('This workflow does not enable manual runs.');
 return Object.entries(event?.workflow_dispatch?.inputs||{}).map(([name,v])=>({name,label:v.description||name,type:v.type||'string',required:!!v.required,default:v.default===undefined?'':String(v.default),options:(v.options||[]).map(String)}));
}
async function resolveWorkflow(w){
 if(w.workflow)return;
 const data=await github(`${base(w)}/actions/workflows?per_page=100`);
 const candidates=data.workflows.filter(x=>x.state==='active'&&/discrepancy/i.test(x.name));
 if(candidates.length!==1)fail('Set DISCREPANCY_WORKFLOW to the exact workflow filename in your hosting settings.',503);
 w.workflow=candidates[0].path.split('/').pop();
}
async function definition(w){
 await resolveWorkflow(w);
 const ref=w.branch||(await github(base(w))).default_branch;
 const file=await github(`${base(w)}/contents/.github/workflows/${encodeURIComponent(w.workflow)}?ref=${encodeURIComponent(ref)}`);
 if(file.encoding!=='base64'||!file.content)fail('Unable to read workflow input definitions.',502);
 return {ref,fields:parseInputs(Buffer.from(file.content,'base64').toString('utf8'))};
}
export function validateInputs(fields,values={}){
 if(!values||typeof values!=='object'||Array.isArray(values))fail('Invalid workflow inputs.');
 for(const name of Object.keys(values))if(!fields.some(f=>f.name===name))fail('Unknown workflow input: '+name);
 const result={};
 for(const f of fields){const value=String(values[f.name]??f.default??'').trim();
 if(f.required&&!value)fail('Required: '+f.label);
 if(value.length>2000)fail('Input is too long: '+f.label);
 if(value&&f.type==='choice'&&!f.options.includes(value))fail('Choose a valid option: '+f.label);
 if(value&&f.type==='boolean'&&!['true','false'].includes(value))fail('Choose true or false: '+f.label);
 if(value&&f.type==='number'&&!Number.isFinite(Number(value)))fail('Enter a number: '+f.label);
 if(value)result[f.name]=value;
 }return result;
}
async function readBody(req){
 if(req.body!==undefined){const b=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(Buffer.byteLength(b)>16000)fail('Request is too large.',413);try{return JSON.parse(b);}catch{fail('Invalid JSON.',400);}}
 let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>16000)fail('Request is too large.',413);}try{return JSON.parse(data||'{}');}catch{fail('Invalid JSON.',400);}
}
function valid(b){return b&&typeof b.name==='string'&&b.name.trim().length>0&&b.name.length<=70&&typeof b.description==='string'&&b.description.length<=300&&typeof b.repository==='string'&&/^[\w.-]+\/[\w.-]+$/.test(b.repository)&&typeof b.workflow==='string'&&/^[\w.-]+\.ya?ml$/.test(b.workflow)&&typeof b.branch==='string'&&b.branch.length<=100&&['Messaging','Reporting','Marketing','Operations'].includes(b.category);}
export default async function handler(req,res){
 const send=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(data));};
 try{
  const url=new URL(req.url,'https://'+(req.headers.host||'localhost'));
  const route=url.searchParams.get('route')||url.pathname.replace(/^\/api\//,'');
  if(!['hub','automations','run','inputs'].includes(route))return send(404,{error:'Not found.'});
  if((['hub','inputs'].includes(route)&&req.method!=='GET')||(!['hub','inputs'].includes(route)&&req.method!=='POST'))return send(405,{error:'Method not allowed.'});
  if(req.method==='POST'&&req.headers.origin){const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host) return send(403,{error:'Request origin not allowed.'});}
  const expected=process.env.TEAM_ACCESS_CODE||'';
  if(expected.length<16)fail('The owner must configure TEAM_ACCESS_CODE with at least 16 characters.',503);
  const supplied=String(req.headers.authorization||'').replace(/^Bearer /,'');
  if(!timingSafeEqual(digest(supplied),digest(expected))){
   const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0];
   const attempts=await redis('EVAL',"local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],600) end;return n",1,'sarthakautoklerk:auth:'+digest(ip).toString('hex'));
   return send(attempts>20?429:401,{error:attempts>20?'Too many incorrect attempts. Wait 10 minutes.':'Incorrect team access code.'});
  }
  const workflows=await catalog();
  if(route==='hub'){
   const results=process.env.GITHUB_TOKEN?await Promise.all(workflows.map(async w=>{try{
    if(!allowed(w.repository))return {id:w.id,runs:[],error:'Repository is not on the server allowlist.'};
    await resolveWorkflow(w);const d=await github(`${base(w)}/actions/workflows/${encodeURIComponent(w.workflow)}/runs?per_page=5`);
    return {id:w.id,runs:d.workflow_runs.map(r=>({id:r.id,name:w.name,automationId:w.id,status:r.status,conclusion:r.conclusion,url:r.html_url,createdAt:r.created_at,updatedAt:r.updated_at,event:r.event,number:r.run_number}))};
   }catch(e){return {id:w.id,runs:[],error:e.message};}})):[];
   return send(200,{workflows,connected:Boolean(process.env.GITHUB_TOKEN),user:{name:'Sarthak team'},runs:results.flatMap(x=>x.runs),errors:results.filter(x=>x.error)});
  }
  if(route==='inputs'){const w=workflows.find(w=>w.id===url.searchParams.get('id'));if(!w)fail('Automation not found.',404);if(!allowed(w.repository))fail('Repository is not on the server allowlist.',403);return send(200,await definition(w));}
  const b=await readBody(req);
  if(route==='automations'){
   if(!valid(b))fail('Check the name, repository (owner/repo), workflow filename (.yml), and category.');
   if(!allowed(b.repository))fail('Ask the owner to add this repository to ALLOWED_REPOSITORIES in the server settings.',403);
   if(b.repository.toLowerCase()===seed.repository.toLowerCase()&&b.workflow===seed.workflow)fail('This workflow is already in your workspace.',409);
   const w={id:randomUUID(),name:b.name.trim(),description:b.description,repository:b.repository,workflow:b.workflow,branch:b.branch,category:b.category};
   const result=await redis('EVAL',"local rows=cjson.decode(redis.call('GET',KEYS[1]) or '[]');if #rows>=19 then return 'limit' end;local item=cjson.decode(ARGV[1]);for _,v in ipairs(rows) do if string.lower(v.repository)==string.lower(item.repository) and v.workflow==item.workflow then return 'duplicate' end end;table.insert(rows,item);redis.call('SET',KEYS[1],cjson.encode(rows));return 'ok'",1,key,JSON.stringify(w));
   if(result!=='ok')fail(result==='limit'?'Maximum 20 automations allowed.':'This workflow already exists.',409);
   return send(201,{ok:true});
  }
  const w=workflows.find(x=>x.id===b.id);if(!w)fail('Automation not found.',404);
  if(!allowed(w.repository))fail('Repository is not on the server allowlist.',403);
  if(!process.env.GITHUB_TOKEN)fail('Configure the server GitHub token first.',503);
  const spec=await definition(w);const inputs=validateInputs(spec.fields,b.inputs);
  // Acquire before any GitHub calls; keep the cooldown if a response is ambiguous.
  const lock='sarthakautoklerk:run:'+w.id;
  if(!await redis('SET',lock,randomUUID(),'NX','EX',120))fail('A run was just requested. Wait two minutes before trying again.',409);
  const recent=await github(`${base(w)}/actions/workflows/${encodeURIComponent(w.workflow)}/runs?per_page=30`);
  if(recent.workflow_runs.some(x=>x.status!=='completed'))fail('This workflow already has an active run. Follow Activity.',409);
  const ref=spec.ref;
  const run=await github(`${base(w)}/actions/workflows/${encodeURIComponent(w.workflow)}/dispatches`,{method:'POST',body:JSON.stringify({ref,inputs})});
  return send(202,{accepted:true,runId:run?.workflow_run_id||null,url:run?.html_url||`https://github.com/${w.repository}/actions`});
 }catch(e){if(!e.status)console.error('FlexiAutomations unhandled request error', {type:e?.name||'Error'});return send(e.status||500,{error:e.status?e.message:'The server could not complete this request. Check its configuration and logs.'});}
}
