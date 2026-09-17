const fs = require('fs');
const file = process.argv[2] || 'local-gateway.js';
let s = fs.readFileSync(file, 'utf8');
if (!s.includes('VISION_IMAGE_NORMALIZE_MIDDLEWARE')) {
  const marker = "app.post('/photo'";
  const at = s.indexOf(marker);
  if (at < 0) throw new Error('photo route marker not found');
  const middleware = `// VISION_IMAGE_NORMALIZE_MIDDLEWARE\napp.use(['/photo','/chat'],async(req,res,next)=>{try{const raw=Array.isArray(req.body?.images)?req.body.images:(req.body?.image?[req.body.image]:[]);if(!raw.length)return next();const out=[];for(const value of raw.slice(0,5)){const src=String(value||'').trim();if(!src){continue;}if(/^https?:\\/\\//i.test(src)||/^data:image\\/jpe?g;base64,/i.test(src)){out.push(src);continue;}const m=src.match(/^data:image\\/[^;]+;base64,(.+)$/is);if(!m){out.push(src);continue;}const dir=await fs.mkdtemp(path.join(os.tmpdir(),'my-ai-vision-'));try{const input=path.join(dir,'input');const output=path.join(dir,'output.jpg');await fs.writeFile(input,Buffer.from(m[1],'base64'));await execFileP('magick',[input,'-auto-orient','-strip','-background','white','-alpha','remove','-alpha','off','-quality','85',output],{timeout:30000});const jpeg=await fs.readFile(output);out.push('data:image/jpeg;base64,'+jpeg.toString('base64'));}finally{await fs.rm(dir,{recursive:true,force:true}).catch(()=>{});}}if(Array.isArray(req.body?.images))req.body.images=out;else if(req.body?.image)req.body.image=out[0]||req.body.image;return next();}catch(e){console.error('VISION_IMAGE_NORMALIZE_ERROR',e.message);return next();}});\n`;
  s = s.slice(0, at) + middleware + s.slice(at);
}
// The configured Mistral key is already rate-limited; do not spend the photo request on a known 429 before Groq.
s = s.replace("const mk=keyOf('MISTRAL_API_KEY','MISTRAL_KEY');if(!mk)return next();", "const mk=keyOf('MISTRAL_API_KEY','MISTRAL_KEY');if(true)return next();");
s = s.replace("const mk=keyOf('MISTRAL_API_KEY','MISTRAL_KEY');if(!mk || keyOf('GROQ_API_KEY'))return next();", "const mk=keyOf('MISTRAL_API_KEY','MISTRAL_KEY');if(true)return next();");
fs.writeFileSync(file, s);
console.log('VISION_RUNTIME_HOTFIX_OK');