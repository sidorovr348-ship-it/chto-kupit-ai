'use strict';
function sanitizeSpeechText(value){
 let text=String(value??'');
 text=text.replace(/!\\[([^\\]]*)\\]\\([^)]+\\)/g,'$1').replace(/\\[([^\\]]+)\\]\\([^)]+\\)/g,'$1');
 text=text.replace(/```[^\\n]*\\n?([\\s\\S]*?)```/g,'$1').replace(/`([^`]+)`/g,'$1');
 text=text.replace(/^\\s{0,3}#{1,6}\\s*/gm,'').replace(/^\\s*>\\s?/gm,'');
 text=text.replace(/^\\s*(?:[-*+]\\s+|\\d+[.)]\\s+)/gm,'');
 text=text.replace(/^\\s*\\|?\\s*:?-{3,}:?\\s*(?:\\|\\s*:?-{3,}:?\\s*)+\\|?\\s*$/gm,'');
 text=text.replace(/\\*\\*|__|~~/g,'').replace(/[*_~]/g,'').replace(/<[^>]*>/g,'');
 text=text.replace(/https?:\\/\\/\\S+/gi,'ссылка').replace(/\\|/g,', ');
 text=text.replace(/[ \\t]+/g,' ').replace(/\\s*\\n\\s*/g,'. ').replace(/(?:\\.\\s*){2,}/g,'. ');
 text=text.replace(/\\s+([,.;!?])/g,'$1').replace(/([,;])(?:\\s*[,;])+/g,'$1');
 return text.trim();
}
module.exports={sanitizeSpeechText};
