import { getAI, sendError, allowPost } from "./_gemini.js";
const MODEL="gemini-2.5-flash";

export default async function handler(req,res){
 if(!allowPost(req,res))return;
 try{
  const {title="",description="",imageBase64,imageMime="image/jpeg"}=req.body||{};
  if(!imageBase64)return res.status(400).json({error:"스케치 이미지가 없습니다."});
  const ai=getAI();
  const prompt=`당신은 고등학교 지식재산교육용 발명 스케치 분석 도우미입니다.
학생의 발명을 새로 설계하거나 보이지 않는 부품을 상상하지 마세요.
발명명: ${title}
학생 설명: ${description}
이미지에서 실제로 확인되는 구성요소와 학생 설명으로 명확히 뒷받침되는 구성요소만 추출하세요.
JSON만 반환하세요. 형식:
{"summary":"한두 문장","uncertainties":["불확실한 점"],"components":[{"name":"구성요소","confidence":"확실|보통|불확실","reason":"짧은 근거","suggestedRef":"10","labelRecommended":true}]}
최대 12개 구성요소.
suggestedRef는 10, 20, 30...처럼 서로 겹치지 않는 숫자로 제안하세요.
labelRecommended는 특허도면에서 독립된 구성요소로 부호를 붙이는 것이 유용하면 true, 단순 경계/입구/바닥처럼 별도 부호의 실익이 낮으면 false로 제안하세요.
이는 교육용 초안이며 최종 구성요소명과 부호는 학생이 수정·확정합니다.`;
  const r=await ai.models.generateContent({
    model:MODEL,
    contents:[{inlineData:{mimeType:imageMime,data:imageBase64}},{text:prompt}],
    config:{responseMimeType:"application/json"}
  });
  const parsed=JSON.parse((r.text||"{}").replace(/```json|```/g,"").trim());
  res.status(200).json({analysis:parsed});
 }catch(e){sendError(res,e);}
}
