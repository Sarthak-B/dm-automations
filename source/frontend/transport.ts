import {aisensy,discrepancy} from './catalog';
let code='';
export function setCode(value:string){code=value;}
export async function apiFetch(input:string,init:RequestInit={}){
 if(location.protocol==='file:'&&input==='/api/hub')return new Response(JSON.stringify({workflows:[aisensy,discrepancy],connected:false,user:{name:'Sarthak'},runs:[],errors:[]}));
 const headers=new Headers(init.headers);headers.set('Authorization','Bearer '+code);
 const response=await window.fetch(input,{...init,headers});
 if(response.status===401)window.dispatchEvent(new Event('workspace-locked'));
 return response;
}
