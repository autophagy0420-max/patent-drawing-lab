import { getAI, sendError, allowPost } from "./_gemini.js";
const MODEL="gemini-3.1-flash-image";

export default async function handler(req,res){
 if(!allowPost(req,res))return;
 try{
  const {description="",figureType="전체 사시도",components=[],imageBase64,imageMime="image/jpeg"}=req.body||{};
  if(!imageBase64)return res.status(400).json({error:"스케치 이미지가 없습니다."});
  const ai=getAI();
  const comps=components.map(c=>`${c.ref}: ${c.name}`).join(", ");
  const prompt=`Transform the supplied student's invention sketch into a clean black-and-white patent-style technical line drawing.
STRICT PRESERVATION RULES:
- Preserve the student's invention structure and component relationships.
- Do NOT add components, remove components, redesign, beautify, or invent hidden structures.
- If a detail is ambiguous, simplify it rather than inventing it.
- Remove paper texture, shadows, handwriting noise, colors and photographic background.
- Use clean black technical outlines on a pure white background, minimal or no shading.
- Do NOT render reference numerals, labels, arrows, titles, captions, dimensions, logos, or explanatory text.
- Keep generous white space around the invention.
Requested view: ${figureType}.
Confirmed components: ${comps}.
Student description: ${description}
This is an educational draft; fidelity to the supplied sketch is more important than visual attractiveness.`;

  const response=await ai.models.generateContent({
    model:MODEL,
    contents:[
      {text:prompt},
      {inlineData:{mimeType:imageMime,data:imageBase64}}
    ],
    config:{
      responseModalities:["IMAGE"],
      responseFormat:{image:{imageSize:"1K"}}
    }
  });

  const parts=response?.candidates?.[0]?.content?.parts||[];
  const imagePart=parts.find(p=>p.inlineData?.data);
  if(!imagePart)throw new Error("Gemini가 이미지 결과를 반환하지 않았습니다.");
  res.status(200).json({
    imageBase64:imagePart.inlineData.data,
    mimeType:imagePart.inlineData.mimeType||"image/png"
  });
 }catch(e){sendError(res,e);}
}
