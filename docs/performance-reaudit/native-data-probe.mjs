import { parseSnapshot, groupServices } from '../src/processes.js';
import { ServiceHistory } from '../src/observation.js';
import { processFixture, snapshotOutput } from './fake-services.mjs';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const send = value => window.webkit.messageHandlers.soak.postMessage(value);
export function startSoak(seconds) { run(seconds).catch(error => send({type:'error',message:String(error)})); }
async function run(seconds) {
 const started=performance.now();
 const history=new ServiceHistory();
 const processes=Array.from({length:6000},(_,i)=>processFixture({pid:10000+i,ppid:1,ports:[]}));
 let cycles=0;
 const report=type=>send({type,elapsed_s:(performance.now()-started)/1000,cycles,keys:history.records.size,documentHidden:document.hidden});
 report('phase');
 // Unique scans, with 200 different history keys kept live in a rolling window.
 while (cycles < 1200) {
  for(let j=0;j<10;j++) {
   processes[0].ports=[{port:10000+cycles%400,hosts:['127.0.0.1']}];
   const snapshot=parseSnapshot(snapshotOutput(processes));
   history.observe(groupServices(snapshot)[0],snapshot.hostId,cycles*5000);
   cycles++;
  }
  if(cycles%200===0) report('sample');
  await delay(30);
 }
 report('idle');
 await delay(20000);
 if(history.records.size!==200) throw new Error('History did not remain live');
 report('finished');
}
