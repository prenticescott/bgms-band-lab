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


// Chromatic tuner — independent microphone session using autocorrelation.
let tunerStream = null, tunerContext = null, tunerAnalyser = null;
let tunerFrame = null, tunerBuffer = null, tunerLastAnalysis = 0;
const tunerNoteNames = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];

function autoCorrelate(buffer, sampleRate) {
  const size = buffer.length;
  let rms = 0;
  for (let i = 0; i < size; i += 2) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / (size / 2));
  if (rms < 0.012) return -1;

  // Decimate by two to reduce CPU use while retaining enough detail for band pitches.
  const signal = new Float32Array(size / 2);
  for (let i = 0; i < signal.length; i++) signal[i] = buffer[i * 2];
  const n = signal.length;
  let bestOffset = -1, bestCorrelation = 0;
  const effectiveRate = sampleRate / 2;
  const minPeriod = Math.max(2, Math.floor(effectiveRate / 1200));
  const maxPeriod = Math.min(Math.floor(effectiveRate / 65), Math.floor(n / 2));
  const correlations = new Float32Array(maxPeriod + 1);

  for (let offset = minPeriod; offset <= maxPeriod; offset++) {
    let correlation = 0;
    for (let i = 0; i < n - offset; i += 2) correlation += signal[i] * signal[i + offset];
    correlation /= Math.max(1, Math.floor((n - offset) / 2));
    correlations[offset] = correlation;
    if (correlation > bestCorrelation) { bestCorrelation = correlation; bestOffset = offset; }
  }
  if (bestOffset < 0 || bestCorrelation < 0.45) return -1;

  // Parabolic interpolation between neighboring period estimates.
  const left = correlations[Math.max(minPeriod, bestOffset - 1)];
  const center = correlations[bestOffset];
  const right = correlations[Math.min(maxPeriod, bestOffset + 1)];
  const denominator = left - 2 * center + right;
  const shift = denominator ? 0.5 * (left - right) / denominator : 0;
  return effectiveRate / (bestOffset + Math.max(-1, Math.min(1, shift)));
}

function showTunerReading(frequency) {
  if (!Number.isFinite(frequency) || frequency <= 0) return;
  const midi = 69 + 12 * Math.log2(frequency / 440);
  const nearest = Math.round(midi);
  const cents = Math.round((midi - nearest) * 100);
  const note = tunerNoteNames[((nearest % 12) + 12) % 12];
  const octave = Math.floor(nearest / 12) - 1;
  $('tunerNote').textContent = note + octave;
  $('tunerFrequency').textContent = frequency.toFixed(1) + ' Hz';
  $('tunerCents').textContent = cents === 0 ? 'In tune' : (cents > 0 ? Math.abs(cents) + ' cents sharp' : Math.abs(cents) + ' cents flat');
  $('tunerCents').classList.toggle('in-tune', Math.abs(cents) <= 5);
  $('tunerNeedle').style.left = (50 + Math.max(-50, Math.min(50, cents))) + '%';
  $('tunerNeedle').classList.toggle('needle-good', Math.abs(cents) <= 5);
}

function tunerLoop(timestamp = 0) {
  if (!tunerAnalyser || !tunerBuffer) return;
  if (timestamp - tunerLastAnalysis < 80) { tunerFrame = requestAnimationFrame(tunerLoop); return; }
  tunerLastAnalysis = timestamp;
  tunerAnalyser.getFloatTimeDomainData(tunerBuffer);
  const frequency = autoCorrelate(tunerBuffer, tunerContext.sampleRate);
  if (frequency > 0) showTunerReading(frequency);
  else {
    $('tunerNote').textContent = '—';
    $('tunerFrequency').textContent = 'Listening…';
    $('tunerCents').textContent = 'Play a steady note';
    $('tunerNeedle').style.left = '50%';
    $('tunerNeedle').classList.remove('needle-good');
  }
  tunerFrame = requestAnimationFrame(tunerLoop);
}

async function stopTuner() {
  if (tunerFrame) cancelAnimationFrame(tunerFrame);
  tunerFrame = null;
  if (tunerStream) tunerStream.getTracks().forEach(track => track.stop());
  tunerStream = null;
  if (tunerContext && tunerContext.state !== 'closed') await tunerContext.close();
  tunerContext = null;
  tunerAnalyser = null;
  tunerBuffer = null;
  $('tunerStart').disabled = false;
  $('tunerStop').disabled = true;
  $('tunerHelp').textContent = 'Tuner stopped. Start again when you are ready.';
}

$('tunerStart').addEventListener('click', async () => {
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
    $('tunerHelp').textContent = 'This browser does not support microphone pitch detection. Try a current version of Chrome, Edge, or Safari over HTTPS.';
    return;
  }
  try {
    $('tunerStart').disabled = true;
    $('tunerHelp').textContent = 'Requesting microphone access…';
    tunerStream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    tunerContext = new AudioContext();
    const source = tunerContext.createMediaStreamSource(tunerStream);
    tunerAnalyser = tunerContext.createAnalyser();
    tunerAnalyser.fftSize = 4096;
    tunerAnalyser.smoothingTimeConstant = 0;
    source.connect(tunerAnalyser);
    tunerBuffer = new Float32Array(tunerAnalyser.fftSize);
    if (tunerContext.state === 'suspended') await tunerContext.resume();
    $('tunerStop').disabled = false;
    $('tunerHelp').textContent = 'Listening. Play and sustain one note; move closer to the microphone if needed.';
    tunerLoop();
  } catch (err) {
    await stopTuner();
    $('tunerHelp').textContent = err.name === 'NotAllowedError'
      ? 'Microphone permission was denied. Allow microphone access in your browser settings and try again.'
      : 'Could not start the tuner. Check your microphone and close other apps using it.';
  }
});
$('tunerStop').addEventListener('click', stopTuner);
window.addEventListener('pagehide', () => {
  if (tunerStream) tunerStream.getTracks().forEach(track => track.stop());
});
