import './style.css';

const AI_STUDIO_URL='https://aistudio.google.com/app/apikey';
const MODEL='gemini-3.6-flash';
const STEPS=['시작','아이디어','AI 확인','발명 구조','명세서 초안','최종 편집','도면 프롬프트','완성·기록'];
const app=document.querySelector('#app');

const state={
  step:0,
  apiKey:sessionStorage.getItem('psl_key')||'',
  title:'',
  rough:'',
  sketchDataUrl:'',
  sketchBase64:'',
  sketchMime:'',
  sketchName:'',
  sketchAnalysis:null,
  conversation:[],
  questions:[],
  answers:{},
  answerSources:{},
  interactionLog:[],
  initialInput:null,
  brief:null,
  draft:null,
  aiInitialDraft:null,
  aiInitialDraftText:'',
  finalText:'',
  revisionNotes:[{change:'',reason:''},{change:'',reason:''}],
  revisionReasons:{},
  reviewDecision:'',
  reviewReason:'',
  drawingPrompt:''
};

const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const friendly=e=>{
  const m=e?.message||String(e);
  if(m==='NO_KEY')return '먼저 Gemini API Key를 연결하세요.';
  if(/no longer available|not found|404/i.test(m))return `현재 선택된 모델(${MODEL})을 사용할 수 없습니다. 앱의 모델 설정을 확인해주세요.`;
  if(/429|quota|rate/i.test(m))return 'Gemini 무료 API 사용량 제한에 도달했거나 요청이 많습니다. 잠시 후 다시 시도하거나 Google AI Studio의 사용량을 확인해주세요.';
  if(/prepayment credits|billing/i.test(m))return '이 API Key가 연결된 프로젝트의 결제/크레딧 상태를 확인해주세요.';
  if(/403|permission/i.test(m))return 'API Key 또는 프로젝트 권한을 확인해주세요.';
  if(/image|mime|inline_data|inlineData/i.test(m))return '스케치 이미지를 처리하지 못했습니다. JPG/PNG/WEBP 이미지로 다시 시도해주세요.';
  return m;
};

function steps(){return `<div class="steps">${STEPS.map((s,i)=>`<div class="step ${i<state.step?'done':''} ${i===state.step?'active':''}">${i+1}. ${s}</div>`).join('')}</div>`}
function layout(content){
  app.innerHTML=`<div class="shell"><div class="topbar"><div class="brand"><h1>Patent Specification Lab</h1><p>AI와 대화하며 발명 아이디어를 구체화하고 특허명세서 초안을 작성합니다. <span class="badge">교육용 초안</span></p></div><div class="key-status"><span class="badge">${state.apiKey?'Gemini 연결됨':'API Key 필요'}</span><button class="btn ghost" id="openKey">${state.apiKey?'API 설정':'Gemini 연결'}</button></div></div>${steps()}${content}</div>`;
  document.querySelector('#openKey')?.addEventListener('click',keyModal);
}
function setStep(n){state.step=n;render();window.scrollTo({top:0,behavior:'smooth'})}

async function gemini(prompt,json=true,key=state.apiKey,media=null){
  if(!key)throw new Error('NO_KEY');
  const parts=[{text:prompt}];
  if(media?.base64&&media?.mime){
    parts.push({inline_data:{mime_type:media.mime,data:media.base64}});
  }
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{
    method:'POST',
    headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({
      contents:[{parts}],
      generationConfig:{temperature:.25,...(json?{responseMimeType:'application/json'}:{})}
    })
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data?.error?.message||`Gemini API 오류 (${r.status})`);
  const text=(data?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();
  if(!text)throw new Error('Gemini 응답이 비어 있습니다.');
  if(!json)return text;
  try{return JSON.parse(text.replace(/^```json\s*|```$/g,'').trim())}
  catch{throw new Error('AI 응답 형식을 해석하지 못했습니다. 다시 시도해주세요.')}
}

function keyModal(){
  const w=document.createElement('div');w.className='modal-backdrop';
  w.innerHTML=`<div class="modal"><h2>Google Gemini API 연결</h2><p>학생 본인의 Google AI Studio API Key를 입력하세요. 텍스트·스케치 이해에는 <b>${MODEL}</b>을 사용합니다.</p><div class="notice"><b>개인정보 안내</b><br>Key는 이 앱의 서버나 DB에 저장하지 않고 현재 브라우저 세션에만 보관합니다. Free Tier 데이터는 Google 제품 개선에 사용될 수 있으므로 민감한 개인정보는 입력하지 마세요.</div><p><a href="${AI_STUDIO_URL}" target="_blank" rel="noopener noreferrer">🔑 Google AI Studio에서 API Key 발급하기 →</a></p><div class="api-row"><input id="key" type="password" placeholder="Gemini API Key" value="${esc(state.apiKey)}"><button class="btn secondary" id="show">보기</button></div><div class="actions"><button class="btn secondary" id="close">닫기</button><button class="btn" id="test">연결 확인</button></div><p id="msg" class="small muted"></p></div>`;
  document.body.appendChild(w);
  const input=w.querySelector('#key');
  w.querySelector('#show').onclick=()=>input.type=input.type==='password'?'text':'password';
  w.querySelector('#close').onclick=()=>w.remove();
  w.addEventListener('click',e=>{if(e.target===w)w.remove()});
  w.querySelector('#test').onclick=async()=>{
    const msg=w.querySelector('#msg'),key=input.value.trim();
    if(!key){msg.textContent='API Key를 입력하세요.';return}
    msg.textContent='연결 확인 중…';
    try{
      await gemini("'연결됨'이라고만 답하세요.",false,key);
      state.apiKey=key;sessionStorage.setItem('psl_key',key);
      msg.textContent='✓ 정상 연결되었습니다.';
      setTimeout(()=>{w.remove();render()},600);
    }catch(e){msg.textContent='연결 실패: '+friendly(e)}
  }
}

function home(){
  state.step=0;
  layout(`<div class="card hero"><span class="badge">Patent Specification Lab v0.4.2</span><h2>말로 설명하고, 원하면 스케치도 보여주세요.<br>AI가 발명자의 의도를 확인하며 명세서로 구체화합니다.</h2><p class="muted">발명 구상 스케치는 선택사항입니다. 완성된 도면이 아니라도 머릿속 구조를 시각적으로 풀어낸 자료가 될 수 있습니다. 첨부하면 AI가 구조·배치관계를 이해하는 보조자료로 사용하고, 첨부하지 않아도 설명과 확인 질문만으로 진행할 수 있습니다.</p><div class="flow"><div class="flow-item">① 설명 + 선택 스케치</div><div class="flow-item">② AI 확인 질문</div><div class="flow-item">③ 발명 구조 확정</div><div class="flow-item">④ 명세서 작성·수정</div><div class="flow-item">⑤ 도면 프롬프트</div><div class="flow-item">⑥ 수행 기록</div></div><div class="notice good"><b>발명 구상 스케치 사용 원칙</b><br>스케치는 선택 자료이며 그림 실력이나 미적 완성도를 평가하지 않습니다. 다만 학생이 주요 구성요소의 위치·관계를 사전에 구상한 과정 증거로 활용할 수 있습니다. AI는 그림만 보고 구조를 확정하지 않으며, 설명과 스케치가 다르거나 모호하면 학생에게 다시 확인합니다.</div><div class="notice warn"><b>주의</b><br>교육용 작성 도구이며 실제 출원의 법률적 완성도나 등록 가능성을 보장하지 않습니다.</div><div class="actions"><span></span><button class="btn" id="start">발명 아이디어 작성 시작 →</button></div></div>`);
  document.querySelector('#start').onclick=()=>state.apiKey?setStep(1):keyModal();
}

async function processSketchFile(file){
  if(!file)return;
  if(!/^image\/(jpeg|png|webp)$/i.test(file.type))throw new Error('JPG, PNG, WEBP 이미지만 지원합니다.');
  if(file.size>15*1024*1024)throw new Error('이미지 파일은 15MB 이하로 올려주세요.');
  const original=await fileToDataUrl(file);
  const img=await loadImage(original);
  const maxSide=1600;
  const scale=Math.min(1,maxSide/Math.max(img.width,img.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(img.width*scale));
  canvas.height=Math.max(1,Math.round(img.height*scale));
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const dataUrl=canvas.toDataURL('image/jpeg',0.86);
  state.sketchDataUrl=dataUrl;
  state.sketchBase64=dataUrl.split(',')[1];
  state.sketchMime='image/jpeg';
  state.sketchName=file.name;
  state.sketchAnalysis=null;
}
function fileToDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('이미지를 읽지 못했습니다.'));r.readAsDataURL(file)})}
function loadImage(src){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('이미지를 표시하지 못했습니다.'));i.src=src})}
function sketchMedia(){return state.sketchBase64?{base64:state.sketchBase64,mime:state.sketchMime}:null}

function idea(){
  layout(`<div class="card"><h2>STEP 1. 내가 생각한 발명을 편하게 설명하세요</h2><p class="muted">전문용어를 몰라도 괜찮습니다. 기존에 무엇이 불편했고, 무엇을 만들고 싶고, 어떻게 작동하면 좋겠는지 평소 말투로 적으세요.</p>
  <label class="field">내가 생각한 발명의 명칭<input id="title" value="${esc(state.title)}" placeholder="예: 립밤을 보관할 수 있는 휴대폰 케이스"></label>
  <label class="field">발명 아이디어 설명<textarea id="rough" placeholder="예: 휴대폰 뒤에 립밤을 붙여서 같이 가지고 다니고, 립밤 뚜껑에는 휴대폰을 세울 수 있는 링이 있었으면 좋겠어요.">${esc(state.rough)}</textarea></label>
  <div class="sketch-upload">
    <div class="sketch-upload-head"><div><b>발명 구상 스케치 첨부 <span class="badge">선택</span></b><p class="small muted">정확한 도면이나 예쁜 그림이 아니어도 됩니다. 주요 구성요소의 위치·관계, 결합·개폐 방향 등 머릿속 구상을 간단히 표현해 보세요.</p></div></div>
    ${state.sketchDataUrl?`<div class="sketch-preview-wrap"><img class="sketch-preview" src="${state.sketchDataUrl}" alt="첨부한 발명 스케치"><div><b>${esc(state.sketchName||'스케치')}</b><p class="small muted">AI는 이 그림을 보조 자료로 사용하며, 수행 기록에는 스케치 제출 여부가 남습니다.</p><button class="btn ghost" id="removeSketch" type="button">스케치 제거</button></div></div>`:`<label class="sketch-drop" for="sketchInput"><span class="sketch-icon">✏️</span><b>스케치 사진 또는 이미지 선택</b><span class="small muted">JPG · PNG · WEBP / 스마트폰 촬영본 가능</span></label><input id="sketchInput" type="file" accept="image/jpeg,image/png,image/webp" hidden>`}
  </div>
  <div class="notice"><b>힌트</b><br>① 기존에는 무엇이 불편했나요? ② 어떤 구성이나 기능을 추가하나요? ③ 사용하면 무엇이 좋아지나요?<br><span class="small muted">스케치는 선택사항이며, 제출하지 않았다는 이유만으로 자동 감점되지 않습니다.</span></div>
  <div class="actions"><button class="btn secondary" id="back">← 이전</button><button class="btn" id="go">AI가 내 의도 확인하기 →</button></div></div>`);

  document.querySelector('#back').onclick=()=>setStep(0);
  document.querySelector('#sketchInput')?.addEventListener('change',async e=>{
    const file=e.target.files?.[0];
    if(!file)return;
    try{await processSketchFile(file);render()}catch(err){alert(err.message||err)}
  });
  document.querySelector('#removeSketch')?.addEventListener('click',()=>{
    state.sketchDataUrl='';state.sketchBase64='';state.sketchMime='';state.sketchName='';state.sketchAnalysis=null;render();
  });
  document.querySelector('#go').onclick=async e=>{
    state.title=document.querySelector('#title').value.trim();
    state.rough=document.querySelector('#rough').value.trim();
    if(!state.title||!state.rough)return alert('발명의 명칭과 설명을 모두 입력해주세요.');
    const b=e.currentTarget;b.disabled=true;b.textContent=state.sketchBase64?'설명과 스케치를 함께 이해하는 중…':'AI가 아이디어를 이해하는 중…';
    try{
      const r=await gemini(initialPrompt(),true,state.apiKey,sketchMedia());
      state.sketchAnalysis={observations:r.sketchObservations||[],conflicts:r.sketchConflicts||[]};
      if(!state.initialInput){
        state.initialInput={
          title:state.title,
          rough:state.rough,
          sketchAttached:!!state.sketchBase64,
          sketchName:state.sketchName||''
        };
      }
      state.conversation=[
        {role:'user',text:`발명의 명칭: ${state.title}\n\n${state.rough}${state.sketchBase64?'\n\n[프리핸드 스케치 첨부됨]':''}`},
        {role:'ai',text:r.understanding||''}
      ];
      state.questions=r.questions||[];
      state.answers={};
      state.answerSources={};
      setStep(2);
    }catch(err){alert(friendly(err));b.disabled=false;b.textContent='AI가 내 의도 확인하기 →'}
  };
}

function initialPrompt(){
  return `당신은 고등학교 지식재산일반 수업의 특허명세서 작성 코치입니다. 학생이 기술 용어를 잘 모른다는 전제로 의도를 정확히 파악하세요.

발명명: ${state.title}
학생 설명:
${state.rough}

${state.sketchBase64?`학생이 프리핸드 스케치 이미지도 첨부했습니다.
[스케치 해석 원칙]
- 스케치는 학생 의도를 이해하기 위한 보조 자료이지 절대적인 정답이 아닙니다.
- 학생 설명과 스케치가 서로 일치하면 구조·배치관계를 이해하는 데 참고하세요.
- 스케치에 보이지만 설명에 없는 구조는 사실로 확정하지 말고 질문으로 확인하세요.
- 설명과 스케치가 충돌하면 어느 쪽이 맞는지 반드시 학생에게 확인하세요.
- 손그림의 비례, 선의 흔들림, 생략된 세부를 실제 치수·재료·숨은 구조로 추론하지 마세요.
- 스케치에서 관찰한 내용은 "스케치상 ~로 보임" 수준으로 표현하세요.`:
`프리핸드 스케치는 첨부되지 않았습니다. 학생 설명에만 근거하여 진행하세요.`}

[공통 원칙]
- 학생이 말하지 않은 핵심 기능·구성·수치·재료·작동원리를 임의로 만들지 마세요.
- 학생 아이디어를 전문적인 말로 짧게 다시 설명하세요.
- 명세서 작성에 꼭 필요한 모호점만 최대 5개 질문하세요.
- 이미 알 수 있는 것을 다시 묻지 마세요.
- 질문은 고등학생이 답할 수 있게 구체적으로 만들고, 선택 예시 2~4개를 제안할 수 있습니다.
- 직접 입력과 '아직 정하지 않음'이 가능해야 합니다.
- 선행기술이나 실제 특허번호를 추측하지 마세요.

JSON:
{
 "understanding":"AI가 이해한 발명의 핵심",
 "sketchObservations":["스케치가 있을 때만 관찰된 구조/배치. 확정 표현 금지"],
 "sketchConflicts":["설명과 스케치가 다르거나 모호하여 확인이 필요한 점"],
 "questions":[{"id":"q1","question":"확인 질문","why":"왜 확인이 필요한지","options":["예시1","예시2"]}]
}`;
}

function qhtml(q){return `<div class="qcard" data-id="${esc(q.id)}"><strong>${esc(q.question)}</strong><div class="small muted">${esc(q.why||'')}</div>${q.options?.length?`<div class="choice-row">${q.options.map(o=>`<button type="button" class="choice ${state.answerSources[q.id]==='choice'&&state.answers[q.id]===o?'selected':''}" data-value="${esc(o)}">${esc(o)}</button>`).join('')}</div>`:''}<input class="answer" placeholder="내 답변 직접 입력" value="${esc(state.answers[q.id]||'')}"></div>`}
function bindQs(){document.querySelectorAll('.qcard').forEach(c=>{const id=c.dataset.id,input=c.querySelector('.answer');input.oninput=()=>{state.answers[id]=input.value;state.answerSources[id]='typed';c.querySelectorAll('.choice').forEach(x=>x.classList.remove('selected'))};c.querySelectorAll('.choice').forEach(b=>b.onclick=()=>{c.querySelectorAll('.choice').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');input.value=b.dataset.value;state.answers[id]=b.dataset.value;state.answerSources[id]='choice'})})}
function answers(){return state.questions.map(q=>({id:q.id,question:q.question,answer:(state.answers[q.id]||'').trim()||'아직 정하지 않음',source:(state.answers[q.id]||'').trim()?(state.answerSources[q.id]||'typed'):'unanswered'}))}
function interactionRound(ans,extra,finalize){return {round:state.interactionLog.length+1,action:finalize?'발명 구조 확정':'AI 재확인',items:ans.map(a=>({...a})),extra:extra||''}}
function allInteractionForPrompt(ans,extra){return [...state.interactionLog,interactionRound(ans,extra,true)]}

function dialogue(){
  const obs=state.sketchAnalysis?.observations||[];
  const conflicts=state.sketchAnalysis?.conflicts||[];
  layout(`<div class="card"><h2>STEP 2. AI가 이해한 내용이 맞는지 확인하세요</h2>
  ${state.sketchDataUrl?`<div class="sketch-context"><img src="${state.sketchDataUrl}" alt="첨부 스케치"><div><b>첨부 스케치를 함께 참고했습니다.</b><p class="small muted">그림에서 보이는 내용도 학생의 설명과 함께 확인합니다.</p></div></div>`:''}
  <div class="chat">${state.conversation.map(m=>`<div class="bubble ${m.role==='ai'?'ai':'user'}">${esc(m.text)}</div>`).join('')}</div>
  ${obs.length?`<div class="notice good"><b>스케치에서 참고한 내용</b><br>${obs.map(x=>`• ${esc(x)}`).join('<br>')}</div>`:''}
  ${conflicts.length?`<div class="notice warn"><b>설명과 스케치 사이에서 확인할 점</b><br>${conflicts.map(x=>`• ${esc(x)}`).join('<br>')}</div>`:''}
  <h3>추가로 확인할 내용</h3><div>${state.questions.length?state.questions.map(qhtml).join(''):'<div class="notice good">추가 확인 질문이 없습니다.</div>'}</div>
  <label class="field">AI가 놓친 내용이나 꼭 추가하고 싶은 내용<textarea id="extra" placeholder="없으면 비워두어도 됩니다."></textarea></label>
  <div class="actions"><button class="btn secondary" id="back">← 아이디어 수정</button><div><button class="btn secondary" id="again">AI에게 다시 확인받기</button> <button class="btn" id="confirm">발명 구조 정리 →</button></div></div></div>`);
  bindQs();
  document.querySelector('#back').onclick=()=>setStep(1);
  document.querySelector('#again').onclick=()=>refine(false);
  document.querySelector('#confirm').onclick=()=>refine(true);
}

async function refine(finalize){
  const extra=document.querySelector('#extra').value.trim(),ans=answers(),btn=document.querySelector(finalize?'#confirm':'#again');
  btn.disabled=true;btn.textContent='AI 확인 중…';
  try{
    if(finalize){
      state.brief=await gemini(briefPrompt(ans,extra),true,state.apiKey,sketchMedia());
      state.interactionLog.push(interactionRound(ans,extra,true));
      setStep(3);
    }else{
      const r=await gemini(refinePrompt(ans,extra),true,state.apiKey,sketchMedia());
      state.interactionLog.push(interactionRound(ans,extra,false));
      state.sketchAnalysis={observations:r.sketchObservations||state.sketchAnalysis?.observations||[],conflicts:r.sketchConflicts||[]};
      state.conversation.push(
        {role:'user',text:ans.map(a=>`${a.question}\n→ ${a.answer}`).join('\n\n')+(extra?`\n\n추가 설명: ${extra}`:'')},
        {role:'ai',text:r.understanding||''}
      );
      state.questions=r.questions||[];state.answers={};state.answerSources={};render();
    }
  }catch(e){alert(friendly(e));btn.disabled=false;btn.textContent=finalize?'발명 구조 정리 →':'AI에게 다시 확인받기'}
}

function refinePrompt(ans,extra){
  return `고등학교 특허명세서 작성 코치로서 아래 학생 아이디어를 다시 확인하세요.
원래 발명명: ${state.title}
원래 설명: ${state.rough}
지금까지의 확인 기록:
${JSON.stringify(state.interactionLog,null,2)}

학생의 이번 답:
${JSON.stringify(ans,null,2)}
추가 설명: ${extra||'없음'}

${state.sketchBase64?`프리핸드 스케치가 다시 함께 제공됩니다. 스케치는 보조 자료입니다. 학생 답변과 그림이 충돌하면 임의로 판단하지 말고 질문하세요. 그림에서 새 구조를 발명하지 마세요.`:'스케치 없음'}

이미 답한 질문은 반복하지 말고, 학생이 '아직 정하지 않음'이라고 한 부분은 임의로 확정하지 마세요. 남은 필수 모호점만 최대 3개 질문하세요.

JSON:
{"understanding":"업데이트된 이해","sketchObservations":["필요한 경우 업데이트된 관찰"],"sketchConflicts":["아직 충돌/모호한 점"],"questions":[{"id":"q1","question":"질문","why":"이유","options":["예시"]}]}`;
}

function briefPrompt(ans,extra){
  return `학생이 확정한 정보만으로 발명 구조를 정리하세요.
말하지 않은 구조/효과/수치/재료/작동원리를 만들지 말고 불확실한 것은 '미확정'으로 남기세요.

발명명: ${state.title}
설명: ${state.rough}
전체 확인 기록(이번 답 포함):
${JSON.stringify(allInteractionForPrompt(ans,extra),null,2)}
추가 설명: ${extra||'없음'}
${state.sketchBase64?`프리핸드 스케치가 첨부되어 있습니다. 스케치에서 보이는 형상·배치는 학생 답변을 보조하는 정도로만 사용하고, 학생이 확인하지 않은 구조를 스케치만 보고 확정하지 마세요.`:''}

JSON:
{
 "recommendedTitle":"다듬은 발명명",
 "coreIdea":"발명의 핵심",
 "problem":"해결하려는 문제",
 "components":[{"name":"구성요소","role":"역할","relationship":"관계"}],
 "operation":["작동/사용 과정"],
 "effects":["확정된 정보에서 직접 도출되는 효과"],
 "unconfirmed":["아직 결정되지 않은 핵심 사항"],
 "optionalDetails":["현재 정하지 않아도 되는 재질·정확한 치수·외형 등 선택사항"],
 "aiAssistedIdeas":["AI가 선택지로 제안했고 학생이 채택하여 구체화한 부분이 있다면 기록"]
}`;
}

function brief(){
  const b=state.brief||{};
  layout(`<div class="card"><h2>STEP 3. 발명 구조 확정</h2><p class="muted">명세서를 쓰기 전에 AI가 이해한 구조를 직접 수정하세요. 스케치를 첨부했더라도 최종 구조는 학생의 확인을 기준으로 합니다.</p>
  <label class="field">추천 발명의 명칭<input id="bTitle" value="${esc(b.recommendedTitle||state.title)}"></label>
  <label class="field">발명의 핵심<textarea id="bCore">${esc(b.coreIdea||'')}</textarea></label>
  <div class="grid2"><label class="field">해결하려는 문제<textarea id="bProblem">${esc(b.problem||'')}</textarea></label><label class="field">기대 효과<textarea id="bEffects">${esc((b.effects||[]).join('\n'))}</textarea></label></div>
  <label class="field">구성요소 · 역할 · 관계<textarea id="bComponents">${esc((b.components||[]).map(x=>`${x.name} | ${x.role} | ${x.relationship}`).join('\n'))}</textarea></label>
  <label class="field">작동/사용 과정<textarea id="bOperation">${esc((b.operation||[]).join('\n'))}</textarea></label>
  ${(b.aiAssistedIdeas||[]).length?`<div class="notice"><b>💡 AI 제안을 참고해 구체화된 부분</b><br>${b.aiAssistedIdeas.map(x=>`• ${esc(x)}`).join('<br>')}</div>`:''}
  ${(b.unconfirmed||[]).length?`<div class="notice warn"><b>명세서 작성 전 확인이 필요한 핵심 사항</b><br>${b.unconfirmed.map(x=>`• ${esc(x)}`).join('<br>')}</div>`:''}
  ${(b.optionalDetails||[]).length?`<div class="notice"><b>현재 정하지 않아도 되는 선택사항</b><br>${b.optionalDetails.map(x=>`• ${esc(x)}`).join('<br>')}</div>`:''}
  <div class="actions"><button class="btn secondary" id="back">← 확인 대화</button><button class="btn" id="draft">이 내용으로 명세서 초안 작성 →</button></div></div>`);
  document.querySelector('#back').onclick=()=>setStep(2);
  document.querySelector('#draft').onclick=async e=>{
    state.brief={
      ...b,
      recommendedTitle:document.querySelector('#bTitle').value.trim(),
      coreIdea:document.querySelector('#bCore').value.trim(),
      problem:document.querySelector('#bProblem').value.trim(),
      effects:document.querySelector('#bEffects').value.split('\n').map(x=>x.trim()).filter(Boolean),
      components:document.querySelector('#bComponents').value.split('\n').map(line=>{const [name='',role='',relationship='']=line.split('|').map(x=>x.trim());return{name,role,relationship}}).filter(x=>x.name),
      operation:document.querySelector('#bOperation').value.split('\n').map(x=>x.trim()).filter(Boolean)
    };
    const btn=e.currentTarget;btn.disabled=true;btn.textContent='명세서 초안 작성 중…';
    try{const generated=await gemini(specPrompt());state.draft=generated;if(!state.aiInitialDraft){state.aiInitialDraft=JSON.parse(JSON.stringify(generated));state.aiInitialDraftText=md(generated)}setStep(4)}
    catch(err){alert(friendly(err));btn.disabled=false;btn.textContent='이 내용으로 명세서 초안 작성 →'}
  };
}

function specPrompt(){return `대한민국 고등학교 지식재산일반 수업에서 사용하는 특허명세서 작성 코치입니다. 아래 학생이 확정한 정보만으로 '교육용 명세서 초안'을 작성하세요.
${JSON.stringify(state.brief,null,2)}

[절대 원칙]
1. 학생이 말하거나 확인하지 않은 구조, 재료, 수치, 형상, 결합방식, 작동원리, 효과를 사실처럼 만들지 마세요.
2. 필수적인데 미확정인 사항은 본문에 억지로 삽입하지 말고 reviewNotes에 '확인 필요'로 남기세요.
3. 재질, 정확한 치수, 색상, 세부 제조규격처럼 발명의 핵심이 아닌 선택사항은 불필요하게 확정하도록 요구하지 마세요.
4. 배경기술에서 실제 선행기술 조사 없이 특정 제품의 구조·문제점을 사실처럼 단정하지 마세요.
5. 발명의 효과는 해결수단으로부터 직접 도출되는 효과만 쓰고 과장 표현을 피하세요.
6. 같은 구성요소는 문서 전체에서 같은 명칭과 같은 도면부호를 사용하세요.
7. 청구항의 핵심 구성은 상세설명에서 뒷받침되어야 하며 상세설명에 없는 새 구성을 청구항에서 만들지 마세요.
8. 독립항은 발명의 핵심 구성을 중심으로 넓게 작성하고, 학생이 확정한 세부 결합방식·개폐방식·부가구성은 가능하면 종속항으로 분리하세요.
9. 종속항은 상위 청구항을 단순 반복하지 말고 추가적인 기술적 특징을 실제로 한정할 때만 작성하세요. 추가 특징이 없으면 청구항 1만 작성해도 됩니다.
10. 도면이 아직 실제로 만들어지지 않았으므로 '도면의 간단한 설명'은 권장 도면안을 생성하되 명세서 문장 자체에는 '(권장 예시)'라는 말을 넣지 마세요.
11. 부호는 100, 110, 120... 또는 100, 200, 210...처럼 계층이 드러나도록 교육용 추천부호를 일관되게 배정하세요.
12. 요약서는 발명의 핵심 구성과 작용을 중심으로 400자 이내로 작성하세요.

JSON:
{"title":"","technicalField":"","background":"","problemToSolve":"","solution":"","effects":"","drawingDescription":"","detailedDescription":"","referenceSigns":"","claims":"","abstract":"","reviewNotes":["최종 확인이 필요한 핵심 사항만"]}`}

const SECTIONS=[['title','발명의 명칭'],['technicalField','기술분야'],['background','배경기술'],['problemToSolve','해결하려는 과제'],['solution','과제의 해결수단'],['effects','발명의 효과'],['drawingDescription','도면의 간단한 설명'],['detailedDescription','발명을 실시하기 위한 구체적인 내용'],['referenceSigns','부호의 설명'],['claims','청구범위'],['abstract','요약서']];

function draft(){
  layout(`<div class="card"><h2>STEP 4. AI가 만든 명세서 초안 검토</h2><p class="muted">각 항목은 바로 수정할 수 있습니다. AI 초안을 그대로 제출하지 말고 발명자의 의도와 실제 구조가 맞는지 확인하세요.</p>${state.draft?.reviewNotes?.length?`<div class="notice warn"><b>최종 확인 필요</b><br>${state.draft.reviewNotes.map(x=>`• ${esc(x)}`).join('<br>')}</div>`:''}<div class="section-list">${SECTIONS.map(([k,l])=>`<div class="section-card"><h3>【${l}】</h3><textarea data-key="${k}">${esc(state.draft?.[k]||'')}</textarea></div>`).join('')}</div><div class="actions"><button class="btn secondary" id="back">← 발명 구조 수정</button><div><button class="btn secondary" id="regen">전체 다시 작성</button> <button class="btn" id="final">최종 편집본 만들기 →</button></div></div></div>`);
  const save=()=>document.querySelectorAll('[data-key]').forEach(t=>state.draft[t.dataset.key]=t.value);
  document.querySelector('#back').onclick=()=>{save();setStep(3)};
  document.querySelector('#regen').onclick=async e=>{
    if(!confirm('현재 초안을 새로 생성할까요? 직접 수정한 내용이 덮어써집니다.'))return;
    const b=e.currentTarget;b.disabled=true;b.textContent='다시 작성 중…';
    try{state.draft=await gemini(specPrompt());render()}
    catch(err){alert(friendly(err));b.disabled=false;b.textContent='전체 다시 작성'}
  };
  document.querySelector('#final').onclick=()=>{save();state.finalText=md(state.draft);setStep(5)}
}

function md(d){return `# ${d.title||state.title}\n\n## 【기술분야】\n${d.technicalField||''}\n\n## 【배경기술】\n${d.background||''}\n\n## 【발명의 내용】\n\n### 【해결하려는 과제】\n${d.problemToSolve||''}\n\n### 【과제의 해결수단】\n${d.solution||''}\n\n### 【발명의 효과】\n${d.effects||''}\n\n## 【도면의 간단한 설명】\n${d.drawingDescription||''}\n\n## 【발명을 실시하기 위한 구체적인 내용】\n${d.detailedDescription||''}\n\n## 【부호의 설명】\n${d.referenceSigns||''}\n\n## 【청구범위】\n${d.claims||''}\n\n## 【요약서】\n${d.abstract||''}\n`}
function download(name,text,type){const blob=new Blob([text],{type:`${type};charset=utf-8`}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)}
function safe(){return (state.brief?.recommendedTitle||state.title||'특허명세서').replace(/[\\/:*?"<>|]/g,'_').slice(0,60)}

function normalizeText(v=''){return String(v).replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim()}
function parseMdSections(text=''){
  const lines=String(text).replace(/\r/g,'').split('\n');
  const out=[];let current={heading:'문서 시작',content:[]};
  const push=()=>{const content=current.content.join('\n').trim();if(current.heading!=='문서 시작'||content)out.push({heading:current.heading,content})};
  for(const line of lines){
    const m=line.match(/^(#{1,3})\s+(.+)\s*$/);
    if(m){push();current={heading:m[2].trim(),content:[]};}
    else current.content.push(line);
  }
  push();return out;
}
function detectedChanges(){
  const before=parseMdSections(state.aiInitialDraftText||'');
  const after=parseMdSections(state.finalText||'');
  const bm=new Map(before.map(x=>[x.heading,x.content]));
  const am=new Map(after.map(x=>[x.heading,x.content]));
  const order=[];[...before,...after].forEach(x=>{if(!order.includes(x.heading))order.push(x.heading)});
  return order.map(heading=>({heading,before:bm.get(heading)||'',after:am.get(heading)||''}))
    .filter(x=>normalizeText(x.before)!==normalizeText(x.after));
}
function shortText(v='',max=420){const t=normalizeText(v);return t.length>max?t.slice(0,max)+'…':t}
function downloadDataUrl(name,dataUrl){const a=document.createElement('a');a.href=dataUrl;a.download=name;document.body.appendChild(a);a.click();a.remove()}

function finalEditor(){
  const changes=detectedChanges();
  const reasonMap=state.revisionReasons||{};
  const decision=state.reviewDecision||'';
  layout(`<div class="card"><h2>STEP 5. 최종 편집 및 AI 결과 검토</h2><p class="muted">이 화면부터는 학생의 최종본입니다. AI가 작성한 내용을 자신의 발명 아이디어 및 확정 구조와 비교해 검토하고, 필요한 경우 직접 수정하세요.</p><div class="notice"><b>최종 점검</b><br>청구범위와 상세설명의 용어가 같은가? · 구성요소가 빠지거나 새로 생기지 않았는가? · 효과가 과장되지 않았는가? · 미확정 사항이 사실처럼 쓰이지 않았는가?</div><div class="editor-toolbar"><button class="btn ghost" id="copy">전체 복사</button><button class="btn ghost" id="md">.md 다운로드</button><button class="btn ghost" id="txt">.txt 다운로드</button><button class="btn secondary" id="checkChanges">변경사항 자동 확인</button></div><textarea id="finalText" class="final-editor">${esc(state.finalText)}</textarea>
  <div class="revision-box"><h3>AI 초안과 실제 변경사항 <span class="badge">자동 확인</span></h3><p class="small muted">앱이 AI 최초 초안과 현재 최종본을 항목별로 비교합니다. 실제 문서 변화가 있는 경우 자동으로 기록됩니다.</p>
  ${changes.length?changes.map((c,i)=>`<div class="revision-item detected-change"><div class="change-head"><b>변경 ${i+1}. ${esc(c.heading)}</b><span class="badge">실제 변경 감지</span></div><div class="change-grid"><div><span class="change-label">AI 최초 초안</span><div class="change-text">${esc(shortText(c.before)||'(내용 없음)')}</div></div><div><span class="change-label">학생 최종본</span><div class="change-text">${esc(shortText(c.after)||'(내용 없음)')}</div></div></div><label class="field">이 항목을 왜 수정했나요? <span class="small muted">(선택)</span><textarea data-reason-key="${esc(c.heading)}" placeholder="예: 내가 실제로 설계한 결합 방식과 AI가 작성한 방식이 달랐기 때문">${esc(reasonMap[c.heading]||'')}</textarea></label></div>`).join(''):`<div class="notice warn"><b>실질적 수정이 감지되지 않았습니다.</b><br>AI 최초 초안과 현재 최종본이 같습니다. 수정할 필요가 없다고 판단했다면 아래에서 그 이유를 설명하세요. 수정이 필요하다면 위 명세서를 고친 뒤 '변경사항 자동 확인'을 누르세요.</div>`}
  </div>
  <div class="review-decision-box"><h3>AI 생성 결과에 대한 나의 최종 판단 <span class="badge">필수</span></h3><p class="small muted">문장을 억지로 바꾸는 것이 목적이 아닙니다. 자신의 발명과 비교하여 수정 필요 여부를 판단하고 그 근거를 설명하세요.</p>
    <div class="review-options">
      <label class="review-option"><input type="radio" name="reviewDecision" value="modified" ${decision==='modified'?'checked':''}><span><b>수정이 필요하여 수정함</b><small>AI 초안에서 내 발명과 맞지 않거나 부정확한 부분을 고쳤습니다.</small></span></label>
      <label class="review-option"><input type="radio" name="reviewDecision" value="nochange" ${decision==='nochange'?'checked':''}><span><b>수정할 필요가 없다고 판단함</b><small>AI 초안을 내 발명 구조와 비교해 검토했고 그대로 사용하기로 판단했습니다.</small></span></label>
    </div>
    <label class="field">판단 이유 <span class="badge">필수</span><textarea id="reviewReason" placeholder="예: 컵 몸통, 슬라이드 홈, 분리막과 패킹의 구조가 내가 확정한 발명 구조와 일치한다고 판단하였다.">${esc(state.reviewReason||'')}</textarea></label>
    <div class="notice"><b>평가 기록 안내</b><br>선택한 판단, 판단 이유, 실제 문서 변경 여부가 최종 수행평가 학습 기록에 함께 저장됩니다.</div>
  </div>
  <div class="actions"><button class="btn secondary" id="back">← 항목별 초안</button><button class="btn" id="drawing">도면 생성용 프롬프트 만들기 →</button></div></div>`);
  const save=()=>{
    state.finalText=document.querySelector('#finalText').value;
    document.querySelectorAll('[data-reason-key]').forEach(t=>{state.revisionReasons[t.dataset.reasonKey]=t.value.trim()});
    state.reviewDecision=document.querySelector('input[name="reviewDecision"]:checked')?.value||'';
    state.reviewReason=document.querySelector('#reviewReason')?.value.trim()||'';
    return state.finalText;
  };
  document.querySelector('#copy').onclick=async()=>{await navigator.clipboard.writeText(save());alert('전체 내용을 복사했습니다.')};
  document.querySelector('#md').onclick=()=>download(safe()+'.md',save(),'text/markdown');
  document.querySelector('#txt').onclick=()=>download(safe()+'.txt',save(),'text/plain');
  document.querySelector('#checkChanges').onclick=()=>{save();render()};
  document.querySelector('#back').onclick=()=>{save();setStep(4)};
  document.querySelector('#drawing').onclick=async e=>{
    save();
    const actualChanges=detectedChanges();
    if(!state.reviewDecision){alert('AI 생성 결과에 대한 최종 판단을 선택하세요.');return}
    if(!state.reviewReason){alert('AI 생성 결과를 그렇게 판단한 이유를 작성하세요.');return}
    if(state.reviewDecision==='modified'&&!actualChanges.length){alert("'수정이 필요하여 수정함'을 선택했지만 실제 변경이 감지되지 않았습니다. 명세서를 수정한 뒤 '변경사항 자동 확인'을 누르거나, 수정할 필요가 없다고 판단했다면 해당 항목을 선택하세요.");return}
    if(state.reviewDecision==='nochange'&&actualChanges.length){alert("실제 문서 변경이 감지되었습니다. 변경한 내용을 최종본으로 사용할 경우 '수정이 필요하여 수정함'을 선택하세요. 변경을 취소하려면 명세서를 AI 최초 초안과 동일하게 되돌려 주세요.");return}
    const b=e.currentTarget;b.disabled=true;b.textContent='도면 프롬프트 작성 중…';
    try{state.drawingPrompt=await gemini(drawPrompt(),true,state.apiKey,sketchMedia());setStep(6)}
    catch(err){alert(friendly(err));b.disabled=false;b.textContent='도면 생성용 프롬프트 만들기 →'}
  }
}

function drawPrompt(){return `아래는 학생이 최종 수정한 교육용 특허명세서입니다.
${state.finalText}

${state.sketchBase64?`학생이 초기에 프리핸드 스케치를 첨부했으며 이 요청에 다시 함께 제공됩니다. 실제 이미지 생성 시에도 사용자가 같은 스케치를 첨부할 예정입니다.`:`초기 프리핸드 스케치는 첨부되지 않았습니다. 최종 이미지 생성 시 학생이 별도로 스케치를 준비할 수 있습니다.`}

학생이 자신의 프리핸드 스케치를 ChatGPT 또는 Gemini 이미지 생성 기능에 첨부해 특허도면 초안을 만들 수 있도록 '도면 생성 계획'을 작성하세요.

[발명 충실성 우선순위]
1순위: 학생이 실제로 첨부할 손스케치의 형상·비례·배치
2순위: 학생이 대화에서 확정하여 명세서에 반영한 구조
3순위: 명세서의 기능 설명
AI의 추론은 위 세 가지를 절대 덮어쓰면 안 됩니다.

[절대 금지]
- 명세서에 이름이 있다는 이유만으로 손스케치에 없는 물리적 형상을 새로 만들어내지 마세요.
- 기능적 설명을 임의의 노즐, 밸브, 패킹, 손잡이, 뚜껑, 홈, 돌기 등 새로운 구조로 시각화하지 마세요.
- 미확정 재료, 치수, 두께, 밀폐 방식, 대칭성, 정확한 비율, 제조방법을 추측하지 마세요.
- 손스케치나 명세서에 없는 장식, 로고, 텍스트, 화살표, 숨은 구조를 추가하지 마세요.
- 이미지 안에 한글/영문 설명이나 도면부호 숫자를 넣지 마세요. 도면부호는 후편집 대상으로 둡니다.

[도면 스타일]
흰 배경, 순수 검은색 기술 선화, 명확하고 일정한 윤곽선, 색상 없음, 사진 질감 없음, 사실적 명암 없음, 복잡한 그라데이션 없음.

먼저 명세서에서 실제로 확정된 구성요소와 미확정 요소를 구분하세요.
그 다음 발명을 설명하는 데 유용한 도면을 최대 3개 추천하세요. 기본은 도 1 사시도이며, 실제 구조상 의미가 있을 때만 분해 사시도/평면도/정면도/단면도 등을 추가하세요.
각 도면마다 사용자가 그대로 복사할 수 있는 독립적인 영문 중심 이미지 생성 프롬프트를 작성하세요.
프롬프트에는 반드시 'uploaded hand sketch is the primary geometric source of truth'와 'if a described feature is not visibly defined in the sketch, preserve the sketch as-is rather than guessing its shape' 취지의 지시를 포함하세요.

JSON:
{
  "confirmedVisualElements":[{"name":"구성요소","instruction":"도면에서 어떻게 다룰지"}],
  "uncertainVisualElements":[{"name":"미확정 요소","instruction":"추측하지 말아야 할 내용"}],
  "figures":[{"id":"fig1","title":"도 1. 사시도","purpose":"이 도면이 필요한 이유","prompt":"복사 가능한 전체 이미지 생성 프롬프트"}],
  "finalCheck":["이미지 생성 후 학생이 확인할 사항"]
}`}

function drawing(){
  const plan=typeof state.drawingPrompt==='object'&&state.drawingPrompt?state.drawingPrompt:{confirmedVisualElements:[],uncertainVisualElements:[],figures:[{id:'fig1',title:'도 1. 사시도',purpose:'대표 도면',prompt:String(state.drawingPrompt||'')}],finalCheck:[]};
  const confirmed=(plan.confirmedVisualElements||[]).map(x=>`<div class="review-row"><b>${esc(x.name)}</b><span>${esc(x.instruction||'')}</span></div>`).join('');
  const uncertain=(plan.uncertainVisualElements||[]).map(x=>`<div class="review-row warn-row"><b>${esc(x.name)}</b><span>${esc(x.instruction||'임의로 표현하지 않음')}</span></div>`).join('');
  const figs=(plan.figures||[]).map((f,i)=>`<div class="section-card figure-card"><div class="figure-head"><div><h3>${esc(f.title||`도 ${i+1}`)}</h3><div class="small muted">${esc(f.purpose||'')}</div></div></div><textarea class="figure-prompt" data-index="${i}">${esc(f.prompt||'')}</textarea><button class="btn ghost copy-fig" data-index="${i}">이 프롬프트 복사</button></div>`).join('');
  layout(`<div class="card"><h2>STEP 6. 도면 생성 전 확인 & 프롬프트</h2><p class="muted">이 앱은 이미지 API를 호출하지 않습니다. 필요한 도면의 프롬프트를 복사하여 학생의 프리핸드 스케치와 함께 ChatGPT 또는 Gemini에 넣으세요.</p>
  ${state.sketchDataUrl?`<div class="sketch-context large"><img src="${state.sketchDataUrl}" alt="초기 스케치"><div><b>처음 첨부한 스케치를 다시 사용하세요.</b><p class="small muted">아래 프롬프트와 함께 동일한 스케치 이미지를 외부 이미지 AI에 첨부합니다.</p></div></div>`:`<div class="notice"><b>초기 스케치 없음</b><br>필요하면 학생이 지금 종이에 프리핸드 스케치를 그려 촬영한 뒤 아래 프롬프트와 함께 외부 이미지 AI에 첨부하세요.</div>`}
  <div class="notice good"><b>도면에서 표현할 확정 구조</b><div class="review-list">${confirmed||'확정된 시각 요소 없음'}</div></div>
  <div class="notice warn"><b>추측하면 안 되는 미확정 구조</b><div class="review-list">${uncertain||'별도 미확정 요소 없음'}</div></div>
  <div class="notice"><b>도면 생성 원칙</b><br>손스케치 &gt; 학생이 확정한 구조 &gt; 명세서의 기능 설명 &gt; AI 추론 순으로 우선합니다.</div>
  <h3>추천 도면</h3>${figs}
  <div class="notice"><b>생성 후 최종 확인</b><br>${(plan.finalCheck||[]).map(x=>`• ${esc(x)}`).join('<br>')||'구성요소의 추가·누락, 위치 관계, 학생 의도와의 일치 여부를 확인하세요.'}</div>
  <div class="actions"><button class="btn secondary" id="back">← 최종 명세서</button><button class="btn" id="done">작업 마무리 →</button></div></div>`);
  document.querySelectorAll('.figure-prompt').forEach(t=>t.oninput=()=>{const i=+t.dataset.index;plan.figures[i].prompt=t.value;state.drawingPrompt=plan});
  document.querySelectorAll('.copy-fig').forEach(b=>b.onclick=async()=>{const i=+b.dataset.index;const t=document.querySelector(`.figure-prompt[data-index="${i}"]`);await navigator.clipboard.writeText(t.value);b.textContent='복사됨 ✓';setTimeout(()=>b.textContent='이 프롬프트 복사',1000)});
  document.querySelector('#back').onclick=()=>setStep(5);
  document.querySelector('#done').onclick=()=>setStep(7);
}

function sourceLabel(s){return s==='choice'?'AI 제안 선택':s==='typed'?'학생 직접 입력':'미응답/미확정'}
function performanceRecord(){
  const initial=state.initialInput||{title:state.title,rough:state.rough,sketchAttached:!!state.sketchDataUrl,sketchName:state.sketchName||''};
  const b=state.brief||{};
  const interactions=state.interactionLog.length?state.interactionLog.map(r=>{
    const qa=(r.items||[]).map((x,i)=>`${i+1}. Q. ${x.question}\n   A. ${x.answer}\n   응답 방식: ${sourceLabel(x.source)}`).join('\n');
    return `### ${r.round}차 확인 (${r.action})\n${qa||'확인 질문 없음'}${r.extra?`\n추가 설명: ${r.extra}`:''}`;
  }).join('\n\n'):'확인 질문 기록 없음';
  const comps=(b.components||[]).map(x=>`- ${x.name}: ${x.role||'역할 미기재'}${x.relationship?` / 관계: ${x.relationship}`:''}`).join('\n')||'- 구성요소 기록 없음';
  const ops=(b.operation||[]).map((x,i)=>`${i+1}. ${x}`).join('\n')||'작동 과정 기록 없음';
  const effects=(b.effects||[]).map(x=>`- ${x}`).join('\n')||'- 효과 기록 없음';
  const changes=detectedChanges();
  const decisionLabel=state.reviewDecision==='modified'?'수정이 필요하여 수정함':state.reviewDecision==='nochange'?'수정할 필요가 없다고 판단함':'미선택';
  const changeText=changes.length?changes.map((x,i)=>`### 변경 ${i+1}. ${x.heading}\n- 변경 전: ${shortText(x.before,500)||'(내용 없음)'}\n- 변경 후: ${shortText(x.after,500)||'(내용 없음)'}\n- 항목별 수정 이유: ${(state.revisionReasons||{})[x.heading]||'미기재'}`).join('\n\n'):'실질적 수정 없음 (AI 최초 초안과 학생 최종본이 동일함)';
  const reviewText=`- 학생의 최종 판단: ${decisionLabel}\n- 판단 이유: ${state.reviewReason||'미기재'}\n- 실제 변경 확인: ${changes.length?`${changes.length}개 항목에서 변경 감지`:'실질적 수정 없음'}`;
  return `# 수행평가 학습 기록\n\n> 이 기록은 AI 활용 과정과 학생의 최종 결과물을 함께 확인하기 위한 교육용 기록입니다. 학교에서 지정한 LMS, 포트폴리오 또는 문서에 붙여넣어 제출할 수 있습니다.\n\n## 1. 최초 발명 아이디어\n- 발명의 명칭: ${initial.title||''}\n- 발명 구상 스케치: ${initial.sketchAttached?`제출${initial.sketchName?` (${initial.sketchName})`:''}`:'미제출 (선택사항)'}\n\n${initial.rough||''}\n\n## 2. AI 확인 질문과 학생 응답\n${interactions}\n\n## 3. 학생이 확정한 발명 구조\n- 최종 발명의 명칭: ${b.recommendedTitle||state.title||''}\n- 발명의 핵심: ${b.coreIdea||''}\n- 해결하려는 문제: ${b.problem||''}\n\n### 구성요소의 기능\n${comps}\n\n### 작동/사용 과정\n${ops}\n\n### 기대 효과\n${effects}\n\n## 4. AI가 생성한 최초 명세서 초안\n${state.aiInitialDraftText||'(최초 AI 초안 기록 없음)'}\n\n## 5. AI 생성 결과 검토 및 실제 변경 기록\n${reviewText}\n\n${changeText}\n\n## 6. 학생 최종 명세서\n${state.finalText||''}\n`;
}

function done(){
  const record=performanceRecord();
  const changes=detectedChanges();
  layout(`<div class="card hero"><span class="badge">작성 완료 · v0.4.2</span><h2>특허명세서 학습 과정과 수행 기록이 완성되었습니다.</h2><p>아래 기록에는 최초 아이디어, AI 확인 과정, 확정한 발명 구조, AI 최초 초안, 학생의 검토 판단·근거, 실제 변경 기록과 학생 최종 명세서가 함께 포함됩니다.</p><div class="notice good"><b>교사 확인이 가능한 평가 증거</b><br>✓ 최초 문제·아이디어<br>✓ AI 질문에 대한 학생의 응답 과정<br>✓ 학생이 확정한 구성요소와 기능<br>✓ 선택적으로 제출한 발명 구상 스케치<br>✓ AI 생성 결과에 대한 학생의 최종 판단과 근거<br>✓ AI 최초 초안과 학생 최종본의 실제 변경 내역</div><div class="notice ${changes.length?'good':'warn'}"><b>문서 변경 확인</b><br>${changes.length?`AI 최초 초안과 비교하여 <b>${changes.length}개 항목</b>에서 실제 변경이 감지되었습니다. 수정 이유가 작성된 항목은 수행 과정 증거로 함께 기록됩니다.`:'AI 최초 초안과 학생 최종본 사이에 실질적 변경이 감지되지 않았습니다.'}</div><div class="notice good"><b>학생의 AI 결과 검토 판단</b><br>${state.reviewDecision==='modified'?'수정이 필요하여 수정함':'수정할 필요가 없다고 판단함'}<br><span class="small">${esc(state.reviewReason||'판단 이유 미기재')}</span></div>${state.sketchDataUrl?`<div class="sketch-context large"><img src="${state.sketchDataUrl}" alt="발명 구상 스케치"><div><b>발명 구상 스케치가 제출되었습니다.</b><p class="small muted">텍스트 기록을 복사하면 이미지 파일 자체는 포함되지 않습니다. 학교 제출 방식에 따라 스케치도 함께 첨부할 수 있습니다.</p><button class="btn ghost" id="downloadSketch">발명 구상 스케치 저장</button></div></div>`:''}<div class="notice"><b>제출 방법</b><br>학교에서 사용하는 LMS, 디지털 포트폴리오, 문서 등에 아래 기록을 그대로 붙여넣거나 파일로 제출하세요.</div><div class="editor-toolbar"><button class="btn" id="copyRecord">수행평가 기록 전체 복사</button><button class="btn ghost" id="recordMd">기록 .md 다운로드</button><button class="btn ghost" id="recordTxt">기록 .txt 다운로드</button></div><textarea class="record-preview" id="recordPreview" readonly>${esc(record)}</textarea><div class="actions"><button class="btn secondary" id="edit">← 최종본 다시 보기</button><button class="btn" id="restart">새 발명 시작</button></div></div>`);
  document.querySelector('#copyRecord').onclick=async()=>{await navigator.clipboard.writeText(record);alert('수행평가 기록 전체를 복사했습니다.')};
  document.querySelector('#recordMd').onclick=()=>download(safe()+'_수행평가기록.md',record,'text/markdown');
  document.querySelector('#recordTxt').onclick=()=>download(safe()+'_수행평가기록.txt',record,'text/plain');
  document.querySelector('#downloadSketch')?.addEventListener('click',()=>downloadDataUrl(safe()+'_발명구상스케치.jpg',state.sketchDataUrl));
  document.querySelector('#edit').onclick=()=>setStep(5);
  document.querySelector('#restart').onclick=()=>{
    const k=state.apiKey;
    Object.assign(state,{step:0,apiKey:k,title:'',rough:'',sketchDataUrl:'',sketchBase64:'',sketchMime:'',sketchName:'',sketchAnalysis:null,conversation:[],questions:[],answers:{},answerSources:{},interactionLog:[],initialInput:null,brief:null,draft:null,aiInitialDraft:null,aiInitialDraftText:'',finalText:'',revisionNotes:[{change:'',reason:''},{change:'',reason:''}],revisionReasons:{},reviewDecision:'',reviewReason:'',drawingPrompt:''});
    render();
  };
}

function render(){[home,idea,dialogue,brief,draft,finalEditor,drawing,done][state.step]()}
render();
