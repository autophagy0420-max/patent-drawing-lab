import { getAI, sendError, allowPost } from "./_gemini.js";
const MODEL="gemini-2.5-flash";

export default async function handler(req,res){
 if(!allowPost(req,res))return;
 try{
  const {title="",figureType="",components=[]}=req.body||{};
  const ai=getAI();
  const list=components.map(c=>`${c.ref}: ${c.name}`).join(", ");
  const r=await ai.models.generateContent({model:MODEL,contents:`고등학교 특허명세서 작성 활동용입니다.
발명명: ${title}
도면 유형: ${figureType}
구성요소: ${list}
다음 두 항목만 한국어로 간결하게 작성하세요.
1) 도면의 간단한 설명: "도 1은 ..." 형식 한 문장
2) 부호의 설명: 각 참조부호와 구성요소를 줄바꿈
학생이 확인하지 않은 새로운 기술적 내용을 추가하지 마세요.`});
  res.status(200).json({text:r.text||""});
 }catch(e){sendError(res,e);}
}
