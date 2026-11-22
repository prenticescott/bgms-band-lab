const $ = (id) => document.getElementById(id);
const DB_KEY = 'bgms-band-lab-recordings-v1';
let mediaRecorder = null, chunks = [], activeStream = null, startedAt = 0, timerHandle = null, pendingBlob = null, pendingUrl = null, deferredInstall = null;
let recordings = [];
try { recordings = JSON.parse(localStorage.getItem(DB_KEY) || '[]'); } catch { recordings = []; }
function saveList(){ localStorage.setItem(DB_KEY, JSON.stringify(recordings)); updateCount(); }
function updateCount(){ $('count').textContent = recordings.length; }
function setStatus(text, live=false){ $('recordStatus').textContent=text; $('recordDot').classList.toggle('live',live); }
function formatTime(ms){const s=Math.floor(ms/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function stopTimer(){clearInterval(timerHandle);timerHandle=null;}
function stopTracks(){if(activeStream){activeStream.getTracks().forEach(t=>t.stop());activeStream=null;}}
$('recordBtn').addEventListener('click', async()=>{
  if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder){$('micHelp').textContent='This browser does not support in-browser recording. Try the latest Chrome, Safari, or Edge over HTTPS.';return;}
  try{
    activeStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
    mediaRecorder=new MediaRecorder(activeStream,mime?{mimeType:mime}:undefined);chunks=[];
    mediaRecorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    mediaRecorder.onstop=()=>{pendingBlob=new Blob(chunks,{type:mediaRecorder.mimeType||'audio/webm'});if(pendingUrl)URL.revokeObjectURL(pendingUrl);pendingUrl=URL.createObjectURL(pendingBlob);$('preview').src=pendingUrl;$('previewWrap').classList.remove('hidden');setStatus('Recording ready to review');stopTracks();};
    mediaRecorder.start();startedAt=Date.now();$('timer').textContent='00:00';setStatus('Recording — play when ready',true);$('recordBtn').disabled=true;$('stopBtn').disabled=false;
    timerHandle=setInterval(()=>$('timer').textContent=formatTime(Date.now()-startedAt),250);
  }catch(err){$('micHelp').textContent=err.name==='NotAllowedError'?'Microphone permission was denied. Allow microphone access in your browser settings, then try again.':'Could not access the microphone. Check that it is connected and not being used by another app.';}
});
$('stopBtn').addEventListener('click',()=>{if(mediaRecorder?.state==='recording'){mediaRecorder.stop();stopTimer();$('recordBtn').disabled=false;$('stopBtn').disabled=true;$('timer').textContent=formatTime(Date.now()-startedAt);}});
$('saveBtn').addEventListener('click',()=>{
  if(!pendingBlob)return;
  const item={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),student:$('student').value.trim()||'Student',ensemble:$('ensemble').value,instrument:$('instrument').value,focus:$('focus').value,piece:$('piece').value.trim()||'Practice take',date:new Date().toISOString(),duration:Date.now()-startedAt,mime:pendingBlob.type};
  const reader=new FileReader();reader.onload=()=>{item.audio=reader.result;recordings.unshift(item);try{saveList();}catch(e){recordings.shift();alert('This device may be out of storage space. Delete older recordings and try again.');return;}$('previewWrap').classList.add('hidden');$('preview').removeAttribute('src');pendingBlob=null;if(pendingUrl){URL.revokeObjectURL(pendingUrl);pendingUrl=null;}setStatus('Saved to this device');renderRecordings();};reader.readAsDataURL(pendingBlob);
});
function renderRecordings(){updateCount();const host=$('recordings');host.innerHTML='';if(!recordings.length){host.innerHTML='<div class="empty"><strong>No recordings yet</strong><p>Your saved practice takes will appear here.</p></div>';return;}
  recordings.forEach(r=>{const card=document.createElement('article');card.className='record-card';const info=document.createElement('div');const h=document.createElement('h3');h.textContent=r.piece;const p=document.createElement('p');p.textContent=`${r.student} · ${r.ensemble} · ${r.instrument} · ${r.focus} · ${new Date(r.date).toLocaleString()}`;info.append(h,p);const del=document.createElement('button');del.className='delete';del.textContent='Delete';del.addEventListener('click',()=>{if(confirm('Delete this recording from this device?')){recordings=recordings.filter(x=>x.id!==r.id);saveList();renderRecordings();}});const audio=document.createElement('audio');audio.controls=true;audio.src=r.audio;card.append(info,del,audio);host.append(card);});}
document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===tab));$('practiceView').classList.toggle('hidden',tab.dataset.view!=='practice');$('libraryView').classList.toggle('hidden',tab.dataset.view!=='library');if(tab.dataset.view==='library')renderRecordings();}));
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('installBtn').classList.remove('hidden');});
$('installBtn').addEventListener('click',async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('installBtn').classList.add('hidden');});
if('serviceWorker' in navigator && location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
renderRecordings();
