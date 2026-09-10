import { GoogleGenAI } from "@google/genai";

export function getAI(){
  const apiKey=process.env.GEMINI_API_KEY;
  if(!apiKey) throw new Error("서버의 GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
  return new GoogleGenAI({apiKey});
}
export function sendError(res,error){
  console.error(error);
  const status=error?.status||500;
  res.status(status>=400&&status<600?status:500).json({error:error?.message||"Gemini API 호출에 실패했습니다."});
}
export function allowPost(req,res){
  if(req.method!=="POST"){res.setHeader("Allow","POST");res.status(405).json({error:"POST 요청만 허용됩니다."});return false;}
  return true;
}
