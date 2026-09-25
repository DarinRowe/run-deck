import { processFixture, snapshotOutput } from './fake-services.mjs';
import { parseSnapshot, groupServices } from '../src/processes.js';
import { ServiceHistory } from '../src/observation.js';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const send = value => window.webkit.messageHandlers.soak.postMessage(value);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const settle = () => new Promise((resolve,reject) => {
 let second;
 const timeout=setTimeout(()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);reject(Error('WebKit stopped drawing'));},10000);
 const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{clearTimeout(timeout);resolve();});});
});
async function until(test) {const end=performance.now()+10000;while(!test()){assert(performance.now()<end,'UI readiness timeout');await delay(20);}}
export function startSoak(){run().catch(error=>send({type:'error',message:String(error),stack:error.stack}));}
async function run(){
 const q=new URLSearchParams(location.search), arm=q.get('arm')||'full';
 const count=Number(q.get('cycles')||180), cadence=Number(q.get('cadence')||1200);
 const services=Number(q.get('services')||200), members=Number(q.get('members')||30);
 const isUI=!['fixture','data','blank'].includes(arm);
 let api=null,scans=0,cycles=0,rawBytes=0,latest=null,phase='active';
 const history=new ServiceHistory();
 if(isUI){
  await until(()=>window.previewApi&&document.querySelector('.refresh')&&!document.querySelector('.refresh').disabled);
  api=window.previewApi;api.focusChanged(true);
  const live=document.querySelector('.live-button');if(live.getAttribute('aria-pressed')==='true')live.click();
  await settle();
  const originalExec=api.exec;api.exec=async request=>{scans++;return originalExec(request);};
  window.addEventListener('blur',()=>{if(!document.hidden)api.focusChanged(true);});
 }
 assert(!document.hidden,'Document hidden');
 const started=performance.now();
 const report=type=>send({type,arm,phase,cycles,scans,elapsed_s:(performance.now()-started)/1000,cadence_ms:cadence,services,members,
  elements:document.querySelectorAll('*').length,details:document.querySelectorAll('.detail-body').length,
  rawBytes,historyKeys:history.records.size,latestServices:latest?.length||0,errors:window.previewErrors?.length||0,documentHidden:document.hidden});
 report('phase');
 for(;cycles<count;cycles++){
  const at=performance.now();
  const base=10000+(arm==='stable'?0:Math.floor(cycles/5)%2*10000);
  if(arm!=='blank'){
   const processes=Array.from({length:services*members},(_,index)=>{
    const group=Math.floor(index/members), member=index%members;
    return processFixture({pid:base+index,ppid:member?base+group*members:1,cwd:'/Users/example/Projects/storefront',
      ports:member?[]:[{port:10000+group,hosts:['127.0.0.1']}],cpuPercent:(cycles+index)%9/100,rssKiB:1000+(cycles%20)*10});
   });
   if(isUI){api.processes=processes;
    document.querySelector('.refresh').click();await settle();await until(()=>!document.querySelector('.refresh').disabled);
    assert(document.querySelectorAll('.service').length===services,'Service count');
    assert(document.querySelector('.service .stop').title.includes(`PID ${base} ·`),'Stale PID');
    if(arm!=='no-details'){
     for(const detail of Array.from(document.querySelectorAll('.service-details')).slice(0,8))detail.open=true;
     await settle();assert(document.querySelectorAll('tbody tr').length===Math.min(8,services)*members,'Detail rows');
     for(const detail of document.querySelectorAll('.service-details[open]'))detail.open=false;await settle();
    }
    if(arm!=='no-search'){
     const search=document.querySelector('.search');
     for(const value of ['no-such-service','storefront','']){search.value=value;search.dispatchEvent(new Event('input',{bubbles:true}));void document.body.offsetHeight;}
    }
    assert(document.querySelectorAll('.detail-body').length===0,'Retained attached details');api.calls.length=0;
    assert(window.previewErrors.length===0,window.previewErrors[0]);
   }else{
    const raw=snapshotOutput(processes);rawBytes=raw.length;
    if(arm==='data'){
     const snapshot=parseSnapshot(raw);
     latest=groupServices(snapshot).map(service=>({...service,...history.observe(service,snapshot.hostId,Date.now())}));
     assert(latest.length===services,'Data service count');
    }
   }
  }
  await delay(Math.max(0,cadence-(performance.now()-at)));
  if((cycles+1)%15===0)report('sample');
 }
 phase='idle';report('phase');await delay(30000);assert(!document.hidden,'Document hidden at end');report('finished');
}
