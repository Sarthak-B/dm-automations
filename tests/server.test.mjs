import {test,beforeEach} from 'node:test';import assert from 'node:assert/strict';
import handler from '../api/bridge.js';
const memory=new Map();let dispatches=0;let active=false;let inputSchema="";let sentInputs;
process.env.TEAM_ACCESS_CODE='test-code-1234567890123456';process.env.GITHUB_TOKEN='fake-test-token';process.env.UPSTASH_REDIS_REST_URL='https://redis.invalid';process.env.UPSTASH_REDIS_REST_TOKEN='fake-redis-token';
global.fetch=async(url,opts)=>{
 if(String(url)==='https://redis.invalid/'){
  const [cmd,...a]=JSON.parse(opts.body);let result;
  if(cmd==='GET')result=memory.get(a[0])||null;
  else if(cmd==='SET'){if(a.includes('NX')&&memory.has(a[0]))result=null;else{memory.set(a[0],a[1]);result='OK';}}
  else if(cmd==='EVAL'&&a[0].includes('INCR'))result=1;
  else if(cmd==='EVAL'){const rows=JSON.parse(memory.get(a[2])||'[]'),item=JSON.parse(a[3]);result=rows.some(v=>v.repository===item.repository&&v.workflow===item.workflow)?'duplicate':rows.length>=19?'limit':'ok';if(result==='ok'){rows.push(item);memory.set(a[2],JSON.stringify(rows));}}
  return Response.json({result});
 }
 if(String(url).includes('/actions/workflows?'))return Response.json({workflows:[{name:'Discrepancy tracker',path:'.github/workflows/test.yml',state:'active'}]});
 if(String(url).includes('/contents/'))return Response.json({encoding:'base64',content:Buffer.from(inputSchema||'on:\n  workflow_dispatch:\n').toString('base64')});
 if(String(url).endsWith('/dispatches')){dispatches++;sentInputs=JSON.parse(opts.body).inputs;return Response.json({workflow_run_id:123,html_url:'https://github.com/run/123'});}
 if(String(url).includes('/runs?'))return Response.json({workflow_runs:active?[{id:9,status:'in_progress'}]:[]});
 return Response.json({default_branch:'main'});
};
async function request(route,{code=process.env.TEAM_ACCESS_CODE,method=route==='hub'?'GET':'POST',body={},origin='https://hub.example'}={}){
 const req={url:'/api/'+route,method,body,headers:{host:'hub.example',origin,authorization:'Bearer '+code},socket:{remoteAddress:'127.0.0.1'}};
 let data;const res={setHeader(){},end(s){data=JSON.parse(s);},statusCode:0};await handler(req,res);return {status:res.statusCode,data};
}
beforeEach(()=>{memory.clear();dispatches=0;active=false;inputSchema="";sentInputs=undefined;});
test('incorrect team code cannot read or launch workflows',async()=>{assert.equal((await request('hub',{code:'wrong'})).status,401);assert.equal((await request('run',{code:'wrong',body:{id:'aisensy'}})).status,401);assert.equal(dispatches,0);});
test('cross-origin mutation is refused',async()=>{assert.equal((await request('run',{origin:'https://evil.example',body:{id:'aisensy'}})).status,403);assert.equal(dispatches,0);});
test('unknown workflow is refused',async()=>{assert.equal((await request('run',{body:{id:'unknown'}})).status,404);assert.equal(dispatches,0);});
test('cooldown prevents concurrent duplicate dispatches',async()=>{const results=await Promise.all([request('run',{body:{id:'aisensy'}}),request('run',{body:{id:'aisensy'}})]);assert.equal(dispatches,1);assert.deepEqual(results.map(x=>x.status).sort(),[202,409]);});
test('existing active GitHub run is not duplicated',async()=>{active=true;assert.equal((await request('run',{body:{id:'aisensy'}})).status,409);assert.equal(dispatches,0);});
test('unapproved repositories cannot be registered',async()=>{const r=await request('automations',{body:{name:'Bad',description:'Test',repository:'other/repo',workflow:'run.yml',branch:'',category:'Operations'}});assert.equal(r.status,403);});
test('workflow registry persists, rejects duplicate registration',async()=>{const body={name:'Second',description:'Test',repository:'Sarthak-B/aisensy-broadcast-tracker',workflow:'other.yml',branch:'',category:'Operations'};assert.equal((await request('automations',{body})).status,201);assert.equal((await request('automations',{body})).status,409);assert.equal((await request('hub')).data.workflows.length,3);});
test('missing storage fails closed',async()=>{const saved=process.env.UPSTASH_REDIS_REST_TOKEN;delete process.env.UPSTASH_REDIS_REST_TOKEN;try{assert.equal((await request('run',{body:{id:'aisensy'}})).status,503);assert.equal(dispatches,0);}finally{process.env.UPSTASH_REDIS_REST_TOKEN=saved;}});

import {parseInputs,validateInputs} from '../api/bridge.js';
test('workflow form preserves required fields and exact choices',()=>{const fields=parseInputs('on:\n  workflow_dispatch:\n    inputs:\n      session:\n        description: Webinar time\n        type: choice\n        required: true\n        options: [morning, evening]\n      tab:\n        required: true\n');assert.deepEqual(fields[0].options,['morning','evening']);assert.throws(()=>validateInputs(fields,{session:'wrong',tab:'A'}));assert.throws(()=>validateInputs(fields,{session:'morning'}));assert.deepEqual(validateInputs(fields,{session:'morning',tab:'Business'}),{session:'morning',tab:'Business'});assert.throws(()=>validateInputs(fields,{session:'morning',tab:'A',unknown:'x'}));});
test('disabled manual workflow fails closed',()=>assert.throws(()=>parseInputs('on: push')));

import {remember} from '../source/frontend/recent.mjs';
test('recent entries keep five unique values, newest first',()=>{assert.deepEqual(remember({tab:['a','b','c','d','e']},{tab:'f'}).tab,['f','a','b','c','d']);assert.deepEqual(remember({tab:['a','b']},{tab:'b'}).tab,['b','a']);});
test('validated inputs reach GitHub dispatch unchanged',async()=>{inputSchema='on:\n  workflow_dispatch:\n    inputs:\n      utm_business_tab:\n        required: true\n      session:\n        type: choice\n        options: [morning, evening]\n';const inputs={utm_business_tab:'21 Oct Business',session:'evening'};assert.equal((await request('run',{body:{id:'aisensy',inputs}})).status,202);assert.deepEqual(sentInputs,inputs);});

test('copied environment assignment gives actionable error without leaking value',async()=>{const old=process.env.UPSTASH_REDIS_REST_URL;process.env.UPSTASH_REDIS_REST_URL='UPSTASH_REDIS_REST_URL="https://redis.invalid"';try{const r=await request('hub');assert.equal(r.status,503);assert.match(r.data.error,/valid URL/);}finally{process.env.UPSTASH_REDIS_REST_URL=old;}});
test('network failure gives safe storage diagnostic',async()=>{const saved=global.fetch;global.fetch=async()=>{throw Error('secret-bearing network detail')};try{const r=await request('hub');assert.equal(r.status,503);assert.match(r.data.error,/Cannot connect/);assert.ok(!r.data.error.includes('secret-bearing'));}finally{global.fetch=saved;}});
test('malformed registry is retained and reported',async()=>{memory.set('sarthakautoklerk:v1:workflows','broken');const r=await request('hub');assert.equal(r.status,503);assert.match(r.data.error,/invalid JSON/);assert.equal(memory.get('sarthakautoklerk:v1:workflows'),'broken');});
