import "./style.css";
const state = {
  step: 0, imageDataUrl: "", imageMime: "", imageBase64: "",
  title: "", description: "", analysis: null, components: [],
  figureType: "전체 사시도", generated: "", generatedMime: "image/png",
  markers: [], selectedMarker: null, drawingDescription: ""
};

const app = document.querySelector("#app");
const steps = ["시작","스케치","구조 분석","구성 확인","도면 생성","부호 편집","완성"];

function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function dataUrlToBase64(dataUrl){ return dataUrl.split(",")[1] || ""; }
function downloadDataUrl(url,name){ const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove(); }
function setStep(n){state.step=n;render();window.scrollTo({top:0,behavior:"smooth"});}
function stepsHtml(){return `<div class="steps">${steps.map((s,i)=>`<div class="step ${i===state.step?"active":i<state.step?"done":""}">${i+1}. ${s}</div>`).join("")}</div>`}

function layout(content){
 app.innerHTML=`<div class="shell">
 <div class="topbar"><div class="brand"><h1>Patent Drawing Lab</h1><p>학생 발명 스케치 → 특허도면 작성 도우미 <span class="badge">교육용 초안</span></p></div>
 <span class="badge">수업용 AI 연결</span></div>
 ${stepsHtml()}${content}</div>`;
}

async function callApi(path, payload){
 const response=await fetch(path,{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify(payload)
 });
 let data={};
 try{ data=await response.json(); }catch{}
 if(!response.ok) throw new Error(data.error||`서버 오류 (${response.status})`);
 return data;
}

function home(){
 layout(`<section class="card hero"><span class="badge">Preserve Structure</span>
 <h2>내 발명 스케치를<br>특허도면 형태로 정리해 보세요.</h2>
 <p>AI가 발명을 대신 설계하지 않습니다.<br>학생이 그린 구조를 분석하고, 학생의 확인을 거쳐 흑백 기술 선화로 정리합니다.</p>
 <button class="btn" id="start">새 도면 만들기 →</button></section>
 <section class="card" style="margin-top:18px"><b>학습 흐름</b><p class="muted">스케치 → AI 구조 분석 → 학생 검토·수정 → 도면화 → 참조부호 → 도면 설명</p></section>`);
 document.querySelector("#start").onclick=()=>setStep(1);
}

function upload(){
 layout(`<section class="card"><h2>STEP 1. 발명 스케치를 올려주세요</h2>
 <div class="grid2"><div>
 <label class="drop" for="file">${state.imageDataUrl?`<img src="${state.imageDataUrl}">`:`<div style="text-align:center"><div style="font-size:48px">📷</div><b>사진 또는 스케치 이미지 선택</b><p class="muted small">JPG · PNG · WEBP</p></div>`}</label>
 <input id="file" type="file" accept="image/png,image/jpeg,image/webp" capture="environment" hidden>
 </div><div>
 <div class="field"><label>발명의 명칭</label><input id="title" value="${esc(state.title)}" placeholder="예: 높이 조절이 가능한 스마트 독서대"></div>
 <div class="field"><label>발명은 어떻게 작동하나요?</label><textarea id="desc" placeholder="주요 구성과 작동 원리를 2~5문장으로 적어주세요.">${esc(state.description)}</textarea></div>
 <div class="notice">📷 <b>스케치 종이만 촬영해주세요.</b><br>학생 이름·학번·얼굴·교실 주변이 사진에 들어가지 않도록 합니다.</div>
 </div></div>
 <div class="footer-actions"><button class="btn secondary" id="back">← 이전</button><button class="btn" id="analyze">AI 구조 분석 →</button></div></section>`);
 document.querySelector("#back").onclick=()=>setStep(0);
 document.querySelector("#title").oninput=e=>state.title=e.target.value;
 document.querySelector("#desc").oninput=e=>state.description=e.target.value;
 document.querySelector("#file").onchange=e=>{
   const f=e.target.files[0]; if(!f)return;
   const reader=new FileReader();reader.onload=()=>{state.imageDataUrl=reader.result;state.imageMime=f.type;state.imageBase64=dataUrlToBase64(reader.result);render();};reader.readAsDataURL(f);
 };
 document.querySelector("#analyze").onclick=analyzeSketch;
}

async function analyzeSketch(){
 state.title=document.querySelector("#title").value.trim();state.description=document.querySelector("#desc").value.trim();
 if(!state.imageBase64) return alert("스케치 이미지를 먼저 올려주세요.");
 const btn=document.querySelector("#analyze");btn.disabled=true;btn.textContent="분석 중…";
 try{
   const data=await callApi("/api/analyze",{
     title:state.title,
     description:state.description,
     imageBase64:state.imageBase64,
     imageMime:state.imageMime
   });
   const parsed=data.analysis||{};
   state.analysis=parsed;
   state.components=(parsed.components||[]).map((c,i)=>({...c,ref:String(c.suggestedRef||((i+1)*10)), enabled:c.labelRecommended!==false}));
   setStep(2);
 }catch(e){alert("구조 분석 실패: "+(e.message||e));btn.disabled=false;btn.textContent="AI 구조 분석 →";}
}
function analysis(){
 layout(`<section class="card"><h2>STEP 2. AI가 스케치를 이렇게 이해했습니다.</h2>
 <div class="grid2"><div class="preview"><img src="${state.imageDataUrl}"></div><div>
 <h3>발명 전체</h3><div class="notice">${esc(state.analysis?.summary||"")}</div>
 <h3>발견된 구성요소</h3>
 ${(state.components||[]).map(c=>`<div class="notice" style="margin:8px 0"><b>${esc(c.name)}</b> · ${esc(c.confidence)}<br><span class="small muted">${esc(c.reason||"")}</span></div>`).join("")}
 ${state.analysis?.uncertainties?.length?`<div class="notice warn"><b>AI가 확신하지 못한 부분</b><br>${state.analysis.uncertainties.map(x=>"• "+esc(x)).join("<br>")}</div>`:""}
 </div></div>
 <div class="footer-actions"><button class="btn secondary" id="back">← 다시 입력</button><button class="btn" id="confirm">구성요소 확인·수정 →</button></div></section>`);
 document.querySelector("#back").onclick=()=>setStep(1);document.querySelector("#confirm").onclick=()=>setStep(3);
}

function components(){
 state.step=3;layout(`<div class="card"><h2>STEP 3. 구성 확인 및 도면부호 초안</h2>
 <p class="muted">AI가 스케치에서 확인한 구성요소와 추천 도면부호입니다. 최종 판단은 학생이 합니다. 명칭·번호를 수정하거나 불필요한 항목을 제외할 수 있습니다.</p>
 <div class="notice"><b>AI 추천 → 학생 검토 → 학생 확정</b><br/>도면부호는 특허도면을 읽기 쉽게 하는 식별표시입니다. 단순 경계나 불필요한 부분까지 모두 부호화할 필요는 없습니다.</div>
 <div id="compList"></div>
 <button class="btn secondary" id="addComp">+ 구성요소 추가</button>
 <div class="actions"><button class="btn secondary" id="back">← 이전</button><button class="btn" id="next">구성요소 확정 →</button></div></div>`);
 const box=document.querySelector("#compList");
 function draw(){
   box.innerHTML=state.components.map((c,i)=>`<div class="component-row" data-i="${i}">
     <label class="component-check"><input type="checkbox" class="enabled" ${c.enabled!==false?"checked":""}> 사용</label>
     <div class="component-fields">
       <label>부호<input class="ref" value="${escapeHtml(c.ref||"")}" inputmode="numeric"></label>
       <label class="grow">구성요소명<input class="name" value="${escapeHtml(c.name||"")}"></label>
     </div>
     <div class="component-meta"><span class="badge">${escapeHtml(c.confidence||"AI 추천")}</span> ${escapeHtml(c.reason||"")}</div>
     <button class="mini danger remove" type="button">삭제</button>
   </div>`).join("");
   box.querySelectorAll(".component-row").forEach(row=>{
     const i=Number(row.dataset.i);
     row.querySelector(".enabled").onchange=e=>state.components[i].enabled=e.target.checked;
     row.querySelector(".ref").oninput=e=>state.components[i].ref=e.target.value.replace(/[^0-9A-Za-z-]/g,"");
     row.querySelector(".name").oninput=e=>state.components[i].name=e.target.value;
     row.querySelector(".remove").onclick=()=>{state.components.splice(i,1);draw();};
   });
 }
 draw();
 document.querySelector("#addComp").onclick=()=>{
   const used=state.components.map(c=>parseInt(c.ref,10)).filter(Number.isFinite);
   const next=used.length?Math.ceil((Math.max(...used)+1)/10)*10:10;
   state.components.push({name:"새 구성요소",ref:String(next),confidence:"학생 추가",reason:"학생이 직접 추가한 구성요소",enabled:true});
   draw();
 };
 document.querySelector("#back").onclick=()=>setStep(2);
 document.querySelector("#next").onclick=()=>{
   const active=state.components.filter(c=>c.enabled!==false&&c.name.trim()&&c.ref.trim());
   if(!active.length)return alert("최소 1개의 구성요소를 확정해주세요.");
   const refs=active.map(c=>c.ref.trim());
   if(new Set(refs).size!==refs.length)return alert("도면부호가 중복되어 있습니다. 서로 다른 부호를 사용해주세요.");
   state.components=active;
   setStep(4);
 };
}
function generateScreen(){
 layout(`<section class="card"><h2>STEP 4. 특허도면 생성</h2>
 <div class="grid2"><div class="preview"><img src="${state.imageDataUrl}"></div><div>
 <h3>${esc(state.figureType)}</h3><div class="notice"><b>원본 충실 모드</b><br>새 부품 추가 금지 · 기존 부품 삭제 금지 · 장식/색/배경 제거 · 구조 관계 유지</div>
 <div class="checks" style="margin-top:14px">
 ${state.components.map(c=>`<label class="check"><input type="checkbox" checked disabled><span><b>${esc(c.ref)}</b> ${esc(c.name)}</span></label>`).join("")}
 </div>
 <p class="small muted">참조부호 숫자는 이미지 AI가 그리지 않습니다. 생성 후 편집 가능한 레이어로 별도 배치합니다.</p>
 </div></div>
 ${state.generated?`<div class="preview" style="margin-top:18px"><img src="${state.generated}"></div>`:""}
 <div class="footer-actions"><button class="btn secondary" id="back">← 이전</button><button class="btn" id="generate">${state.generated?"다시 생성":"특허도면 생성"}</button>${state.generated?`<button class="btn" id="edit">부호 편집 →</button>`:""}</div></section>`);
 document.querySelector("#back").onclick=()=>setStep(3);document.querySelector("#generate").onclick=generateDrawing;
 if(state.generated)document.querySelector("#edit").onclick=()=>{initMarkers();setStep(5)};
}

async function generateDrawing(){
 const btn=document.querySelector("#generate");
 if(btn.disabled)return;
 btn.disabled=true;btn.textContent="도면 생성 중…";
 try{
  const data=await callApi("/api/generate-image",{
    title:state.title,
    description:state.description,
    figureType:state.figureType,
    components:state.components,
    imageBase64:state.imageBase64,
    imageMime:state.imageMime
  });
  if(!data.imageBase64) throw new Error("이미지 응답을 받지 못했습니다.");
  state.generatedMime=data.mimeType||"image/png";
  state.generated=`data:${state.generatedMime};base64,${data.imageBase64}`;
  state.markers=[];render();
 }catch(e){alert("도면 생성 실패: "+(e.message||e));btn.disabled=false;btn.textContent="특허도면 생성";}
}
function initMarkers(){
 if(state.markers.length)return;
 const n=Math.max(state.components.length,1);
 state.markers=state.components.map((c,i)=>({ref:c.ref,name:c.name,x:82,y:12+(i*(76/Math.max(n-1,1)))}));
}

function editor(){
 initMarkers();
 layout(`<section class="card"><h2>STEP 5. 참조부호를 배치하세요.</h2>
 <p class="muted">번호 원을 드래그해서 해당 구성요소 가까이에 놓으세요. 번호는 AI 이미지가 아니라 별도 편집 레이어입니다.</p>
 <div class="grid2"><div><h3>원본 스케치</h3><div class="preview"><img src="${state.imageDataUrl}"></div></div>
 <div><h3>특허도면</h3><div class="preview"><div class="figure-wrap" id="figure"><img id="generatedImg" src="${state.generated}">
 ${state.markers.map((m,i)=>`<div class="marker ${state.selectedMarker===i?"selected":""}" data-i="${i}" style="left:${m.x}%;top:${m.y}%" title="${esc(m.name)}">${esc(m.ref)}</div>`).join("")}</div></div></div></div>
 <div class="notice" style="margin-top:16px"><b>검토 질문</b><br>AI가 원본에 없는 부품을 추가하거나, 원래 있던 부품을 없애거나, 연결 관계를 바꾸지 않았는지 반드시 확인하세요.</div>
 <div class="footer-actions"><button class="btn secondary" id="back">← 다시 생성</button><button class="btn outline" id="png">도면 PNG 저장</button><button class="btn" id="finish">도면 설명 만들기 →</button></div></section>`);
 document.querySelector("#back").onclick=()=>setStep(4);document.querySelector("#finish").onclick=createDescription;
 document.querySelector("#png").onclick=exportComposite;
 document.querySelectorAll(".marker").forEach(el=>{
   let dragging=false;
   const move=(e)=>{
     if(!dragging)return;const fig=document.querySelector("#figure").getBoundingClientRect();
     const x=Math.min(98,Math.max(2,(e.clientX-fig.left)/fig.width*100));const y=Math.min(98,Math.max(2,(e.clientY-fig.top)/fig.height*100));
     const i=+el.dataset.i;state.markers[i].x=x;state.markers[i].y=y;el.style.left=x+"%";el.style.top=y+"%";
   };
   el.onpointerdown=e=>{dragging=true;el.setPointerCapture(e.pointerId);state.selectedMarker=+el.dataset.i;el.classList.add("selected");};
   el.onpointermove=move;el.onpointerup=()=>dragging=false;
 });
}

async function exportComposite(){
 const img=document.querySelector("#generatedImg");
 const canvas=document.createElement("canvas");canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
 const ctx=canvas.getContext("2d");ctx.fillStyle="white";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0);
 ctx.font=`bold ${Math.max(18,canvas.width/45)}px Arial`;ctx.textAlign="center";ctx.textBaseline="middle";
 for(const m of state.markers){
   const x=m.x/100*canvas.width,y=m.y/100*canvas.height,r=Math.max(18,canvas.width/55);
   ctx.fillStyle="white";ctx.strokeStyle="black";ctx.lineWidth=Math.max(2,canvas.width/500);ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="black";ctx.fillText(m.ref,x,y);
 }
 downloadDataUrl(canvas.toDataURL("image/png"),`${state.title||"patent-drawing"}.png`);
}

async function createDescription(){
 try{
  const data=await callApi("/api/describe",{
    title:state.title,
    figureType:state.figureType,
    components:state.components
  });
  state.drawingDescription=data.text||"";setStep(6);
 }catch(e){alert("도면 설명 생성 실패: "+(e.message||e));}
}
function finish(){
 layout(`<section class="card"><h2>STEP 6. 완성</h2>
 <div class="grid2"><div class="preview"><img src="${state.generated}"></div><div>
 <div class="field"><label>도면 설명 초안</label><textarea id="finalText" style="min-height:260px">${esc(state.drawingDescription)}</textarea></div>
 <div class="notice ok">✓ AI 초안은 학생이 최종 검토·수정한 뒤 명세서에 사용하세요.</div></div></div>
 <div class="footer-actions"><button class="btn secondary" id="back">← 부호 편집</button><button class="btn outline" id="copy">설명 복사</button><button class="btn" id="new">새 도면 만들기</button></div></section>`);
 document.querySelector("#back").onclick=()=>setStep(5);
 document.querySelector("#copy").onclick=async()=>{await navigator.clipboard.writeText(document.querySelector("#finalText").value);alert("복사했습니다.");};
 document.querySelector("#new").onclick=()=>{Object.assign(state,{step:1,imageDataUrl:"",imageMime:"",imageBase64:"",title:"",description:"",analysis:null,components:[],generated:"",markers:[],drawingDescription:""});render();}
}

function render(){
 [home,upload,analysis,components,generateScreen,editor,finish][state.step]();
}
render();
