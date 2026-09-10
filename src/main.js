import "./style.css";
import { GoogleGenAI } from "@google/genai";

const AI_STUDIO_URL = "https://aistudio.google.com/app/apikey";
const ANALYSIS_MODEL = "gemini-2.5-flash";
const IMAGE_MODEL = "gemini-3.1-flash-image";

const state = {
  step: 0, apiKey: sessionStorage.getItem("gemini_api_key") || "",
  remember: false, imageDataUrl: "", imageMime: "", imageBase64: "",
  title: "", description: "", analysis: null, components: [],
  figureType: "전체 사시도", generated: "", generatedMime: "image/png",
  markers: [], selectedMarker: null, drawingDescription: ""
};

const app = document.querySelector("#app");
const steps = ["시작","스케치","구조 분석","구성 확인","도면 생성","부호 편집","완성"];

function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function client(){ if(!state.apiKey) throw new Error("API Key를 먼저 입력해주세요."); return new GoogleGenAI({apiKey: state.apiKey}); }
function dataUrlToBase64(dataUrl){ return dataUrl.split(",")[1] || ""; }
function downloadDataUrl(url,name){ const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove(); }
function setStep(n){state.step=n;render();window.scrollTo({top:0,behavior:"smooth"});}
function stepsHtml(){return `<div class="steps">${steps.map((s,i)=>`<div class="step ${i===state.step?"active":i<state.step?"done":""}">${i+1}. ${s}</div>`).join("")}</div>`}

function apiModal(){
 return `<div class="api-modal" id="apiModal"><div class="modal-card">
 <div class="row between"><div><span class="badge">BYOK</span><h2>Google Gemini API 연결</h2></div><button class="btn secondary" id="closeApi">닫기</button></div>
 <p class="muted">본인의 Gemini API Key를 사용합니다. 앱 운영자용 공용 키는 포함하지 않습니다.</p>
 <div class="notice"><b>① API Key 발급</b><br>Google AI Studio에서 키를 만든 뒤 복사하세요.<br><br>
 <a class="btn google" href="${AI_STUDIO_URL}" target="_blank" rel="noopener noreferrer">🔑 Google AI Studio에서 API Key 발급하기 ↗</a></div>
 <div class="field"><label>② API Key</label><input id="apiInput" type="password" autocomplete="off" placeholder="API Key 붙여넣기" value="${esc(state.apiKey)}"></div>
 <label class="check"><input id="rememberKey" type="checkbox" ${state.remember?"checked":""}><span><b>이 기기에서 기억하기</b><br><span class="small muted">공용 PC에서는 선택하지 마세요.</span></span></label>
 <div class="row" style="margin-top:16px"><button class="btn" id="testApi">연결 확인</button><span id="apiStatus" class="small muted"></span></div>
 <p class="small muted">기본값은 현재 탭의 세션 저장입니다. 브라우저를 닫으면 삭제됩니다. '기억하기'를 선택하면 이 브라우저의 localStorage에 저장됩니다.</p>
 </div></div>`;
}

function layout(content){
 app.innerHTML=`<div class="shell">
 <div class="topbar"><div class="brand"><h1>Patent Drawing Lab</h1><p>학생 발명 스케치 → 특허도면 작성 도우미 <span class="badge">교육용 초안</span></p></div>
 <button class="btn outline" id="apiBtn">⚙ API 설정 ${state.apiKey?"✓":""}</button></div>
 ${stepsHtml()}${content}</div>`;
 document.querySelector("#apiBtn").onclick=()=>{document.body.insertAdjacentHTML("beforeend",apiModal());bindApi();}
}

function bindApi(){
 const modal=document.querySelector("#apiModal");
 document.querySelector("#closeApi").onclick=()=>modal.remove();
 document.querySelector("#testApi").onclick=async()=>{
   const key=document.querySelector("#apiInput").value.trim();
   const status=document.querySelector("#apiStatus"); status.textContent="확인 중…";
   try{
     const ai=new GoogleGenAI({apiKey:key});
     const r=await ai.models.generateContent({model:ANALYSIS_MODEL,contents:"Reply only with OK."});
     if(!r.text) throw new Error("응답 없음");
     state.apiKey=key; state.remember=document.querySelector("#rememberKey").checked;
     sessionStorage.setItem("gemini_api_key",key);
     if(state.remember) localStorage.setItem("gemini_api_key",key); else localStorage.removeItem("gemini_api_key");
     status.textContent="✅ 연결되었습니다.";
     setTimeout(()=>{modal.remove();render()},600);
   }catch(e){status.textContent="❌ 연결 실패: "+(e.message||e)}
 };
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
 if(!state.apiKey){document.querySelector("#apiBtn").click();return;}
 const btn=document.querySelector("#analyze");btn.disabled=true;btn.textContent="분석 중…";
 try{
   const ai=client();
   const prompt=`당신은 고등학교 지식재산교육용 발명 스케치 분석 도우미입니다.
학생의 발명을 새로 설계하거나 보이지 않는 부품을 상상하지 마세요.
발명명: ${state.title}
학생 설명: ${state.description}
이미지에서 실제로 확인되는 구성요소와 학생 설명으로 명확히 뒷받침되는 구성요소만 추출하세요.
JSON만 반환하세요. 형식:
{"summary":"한두 문장","uncertainties":["불확실한 점"],"components":[{"name":"구성요소","confidence":"확실|보통|불확실","reason":"짧은 근거"}]}
최대 12개 구성요소.`;
   const r=await ai.models.generateContent({
     model:ANALYSIS_MODEL,
     contents:[{inlineData:{mimeType:state.imageMime,data:state.imageBase64}},{text:prompt}],
     config:{responseMimeType:"application/json"}
   });
   const parsed=JSON.parse((r.text||"{}").replace(/```json|```/g,"").trim());
   state.analysis=parsed;
   state.components=(parsed.components||[]).map((c,i)=>({...c,ref:String((i+1)*10)}));
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
 layout(`<section class="card"><h2>STEP 3. 구성요소와 참조부호를 확인하세요.</h2>
 <p class="muted">AI가 잘못 이해한 이름을 직접 고치고, 빠진 구성요소가 있으면 추가하세요.</p>
 <div id="componentList">${state.components.map((c,i)=>`<div class="component" data-i="${i}">
 <input class="ref" value="${esc(c.ref)}" aria-label="참조부호"><input class="name" value="${esc(c.name)}" aria-label="구성요소">
 <select class="confidence"><option ${c.confidence==="확실"?"selected":""}>확실</option><option ${c.confidence==="보통"?"selected":""}>보통</option><option ${c.confidence==="불확실"?"selected":""}>불확실</option></select>
 <button class="btn danger remove">×</button></div>`).join("")}</div>
 <div class="row"><button class="btn outline" id="add">+ 구성요소 추가</button><button class="btn outline" id="renumber">구조 번호 자동 부여</button></div>
 <div class="field"><label>생성할 도면</label><select id="figureType">${["전체 사시도","정면도","측면도","평면도","분해 사시도","작동 상태도","단면 구조도"].map(x=>`<option ${state.figureType===x?"selected":""}>${x}</option>`).join("")}</select></div>
 <div class="notice warn">⚠️ 보이지 않는 내부·후면 구조가 필요한 도면은 AI가 추정할 수 있습니다. 그런 경우 추가 스케치를 올리는 것이 원칙입니다.</div>
 <div class="footer-actions"><button class="btn secondary" id="back">← 이전</button><button class="btn" id="next">도면 생성 설정 →</button></div></section>`);
 const sync=()=>{state.components=[...document.querySelectorAll(".component")].map(el=>({ref:el.querySelector(".ref").value,name:el.querySelector(".name").value,confidence:el.querySelector(".confidence").value}));state.figureType=document.querySelector("#figureType").value;}
 document.querySelectorAll(".remove").forEach(b=>b.onclick=()=>{sync();state.components.splice(+b.parentElement.dataset.i,1);render();});
 document.querySelector("#add").onclick=()=>{sync();state.components.push({ref:"",name:"새 구성요소",confidence:"확실"});render();};
 document.querySelector("#renumber").onclick=()=>{sync();state.components.forEach((c,i)=>c.ref=String((i+1)*10));render();};
 document.querySelector("#back").onclick=()=>{sync();setStep(2)};document.querySelector("#next").onclick=()=>{sync();setStep(4)};
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
 if(!state.apiKey){document.querySelector("#apiBtn").click();return;}
 const btn=document.querySelector("#generate");btn.disabled=true;btn.textContent="도면 생성 중…";
 try{
  const ai=client();
  const comps=state.components.map(c=>`${c.ref}: ${c.name}`).join(", ");
  const prompt=`Transform the supplied student's invention sketch into a clean black-and-white patent-style technical line drawing.
STRICT PRESERVATION RULES:
- Preserve the student's invention structure and component relationships.
- Do NOT add components, remove components, redesign, beautify, or invent hidden structures.
- If a detail is ambiguous, simplify it rather than inventing it.
- Remove paper texture, shadows, handwriting noise, colors and photographic background.
- Use clean black technical outlines on a pure white background, minimal or no shading.
- Do NOT render reference numerals, labels, arrows, titles, captions, dimensions, logos, or explanatory text.
- Keep generous white space around the invention.
Requested view: ${state.figureType}.
Confirmed components: ${comps}.
Student description: ${state.description}
This is an educational draft; fidelity to the supplied sketch is more important than visual attractiveness.`;
  const interaction=await ai.interactions.create({
    model:IMAGE_MODEL,
    input:[{type:"text",text:prompt},{type:"image",mime_type:state.imageMime,data:state.imageBase64}],
    response_format:{type:"image",image_size:"1K"}
  });
  const out=interaction.output_image;
  if(!out?.data) throw new Error("이미지 응답을 받지 못했습니다.");
  state.generatedMime=out.mime_type||"image/png";
  state.generated=`data:${state.generatedMime};base64,${out.data}`;
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
 if(!state.apiKey){document.querySelector("#apiBtn").click();return;}
 try{
  const ai=client();const list=state.components.map(c=>`${c.ref}: ${c.name}`).join(", ");
  const r=await ai.models.generateContent({model:ANALYSIS_MODEL,contents:`고등학교 특허명세서 작성 활동용입니다.
발명명: ${state.title}
도면 유형: ${state.figureType}
구성요소: ${list}
다음 두 항목만 한국어로 간결하게 작성하세요.
1) 도면의 간단한 설명: "도 1은 ..." 형식 한 문장
2) 부호의 설명: 각 참조부호와 구성요소를 줄바꿈
학생이 확인하지 않은 새로운 기술적 내용을 추가하지 마세요.`});
  state.drawingDescription=r.text||"";setStep(6);
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
 if(!state.apiKey){const remembered=localStorage.getItem("gemini_api_key");if(remembered){state.apiKey=remembered;state.remember=true;sessionStorage.setItem("gemini_api_key",remembered);}}
 [home,upload,analysis,components,generateScreen,editor,finish][state.step]();
}
render();
