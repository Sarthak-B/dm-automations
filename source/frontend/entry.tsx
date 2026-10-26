import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import Home from './Home';
import {setCode,apiFetch} from './transport';
function App(){
 const [unlocked,setUnlocked]=useState(false),[value,setValue]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{const lock=()=>{setCode('');setUnlocked(false);setValue('');};window.addEventListener('workspace-locked',lock);return()=>window.removeEventListener('workspace-locked',lock)},[]);
 async function unlock(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setCode(value);try{const response=await apiFetch('/api/hub');const d=await response.json();if(!response.ok)throw Error(d.error||'Unable to unlock workspace.');setUnlocked(true);setValue('');}catch(e){setCode('');setError((e as Error).message);}finally{setBusy(false)}}
 if(location.protocol==='file:')return <><div className="preview-banner">Local preview · Deploy the complete Vercel package to connect GitHub and run workflows.</div><Home/></>;
 if(unlocked)return <><button className="lock-workspace" onClick={()=>{setCode('');setUnlocked(false)}}>Lock workspace</button><Home/></>;
 return <main className="access-page"><section className="access-panel"><div className="access-logo">ϟ</div><p className="eyebrow">BY SARTHAK</p><h1>FlexiAutomations</h1><p className="access-copy">Your marketing automation control room.<br/>Enter your team access code to continue.</p>{location.protocol==='file:'?<p className="form-error">This is the complete interface. Deploy the included server package to use protected workflow controls; opening HTML directly cannot run the server.</p>:<form onSubmit={unlock}><label htmlFor="team-code">Team access code</label><input id="team-code" type="password" value={value} onChange={e=>setValue(e.target.value)} autoComplete="current-password" required autoFocus placeholder="Enter your access code"/><button className="dark-button full" disabled={busy}>{busy?'Checking access…':'Open workspace →'}</button></form>}{error&&<p className="form-error" role="alert">{error}</p>}<small>GitHub credentials stay on the server.<br/>Share the team code only with people you authorize.</small></section></main>
}
createRoot(document.getElementById('root')!).render(<App/>);
