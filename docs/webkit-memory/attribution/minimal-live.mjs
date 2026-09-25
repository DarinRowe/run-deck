// Standalone WebKit DOM probe: no Run Deck imports or production bundle.
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const send=value=>window.webkit.messageHandlers.soak.postMessage(value);
const assert=(value,message)=>{if(!value)throw Error(message);};
const settle=()=>new Promise((resolve,reject)=>{
 let second;const timer=setTimeout(()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);reject(Error('WebKit stopped drawing'));},10000);
 const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{clearTimeout(timer);resolve();});});
});
export function startSoak(){run().catch(error=>send({type:'error',message:String(error)}));}
function makeBody(detail){
 const body=document.createElement('div');body.className='detail-body';
 const table=document.createElement('table'),tbody=document.createElement('tbody');table.append(tbody);
 for(let i=0;i<30;i++){
  const row=document.createElement('tr');row.style.setProperty('--depth',String(i?1:0));
  for(const text of ['node',String(10000+i),'3.6%','180 MB']){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}
  tbody.append(row);
 }
 const options=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Custom address';
 const form=document.createElement('form'),input=document.createElement('input'),button=document.createElement('button');input.type='url';input.value='http://localhost:3000';button.textContent='Open';
 form.addEventListener('submit',event=>{event.preventDefault();void input.value;detail.open=false;});form.append(input,button);options.append(summary,form);body.append(table,options);return body;
}
async function run(){
 const list=[];for(let i=0;i<8;i++){const detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Service '+i;detail.append(summary);document.body.append(detail);list.push(detail);}
 const start=performance.now();let cycles=0,phase='active';
 const report=type=>send({type,phase,cycles,elapsed_s:(performance.now()-start)/1000,elements:document.getElementsByTagName('*').length,documentHidden:document.hidden});
 report('phase');
 for(;cycles<1200;cycles++){
  const at=performance.now();let bodies=list.map(detail=>{const body=makeBody(detail);detail.append(body);detail.open=true;return body;});
  await settle();assert(document.getElementsByTagName('tr').length===240,'row count');
  for(const detail of list)detail.open=false;for(const body of bodies)body.remove();bodies=null;
  await settle();assert(document.getElementsByClassName('detail-body').length===0,'closed body retained');
  await delay(Math.max(0,100-(performance.now()-at)));if((cycles+1)%30===0)report('sample');
 }
 phase='idle';report('phase');await delay(20000);report('finished');
}
