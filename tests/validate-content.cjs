const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function ok(v,m){if(!v)throw new Error(m);}
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(x=>!/\bsrc\s*=/.test(x[1]));
ok(scripts.length>=2,'Missing application or v1.4.0 content script');
scripts.forEach((x,i)=>new vm.Script(x[2],{filename:'inline-'+(i+1)+'.js'}));
const elements=new Map(),handlers=[],store=new Map();
function el(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',disabled:false,classList:{toggle(){},add(){},remove(){}},addEventListener(){},appendChild(){},style:{}});return elements.get(id);}
const document={getElementById:el,querySelectorAll:()=>[],addEventListener:(type,fn)=>handlers.push({type,fn}),createElement:()=>({click(){},style:{},setAttribute(){},appendChild(){}}),head:{appendChild(){}}};
const ctx={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},console,confirm:()=>true,setTimeout:()=>0,clearTimeout(){},Date,Math,Map,Set,JSON,Blob:function(){},URL:{}};
ctx.window=ctx;ctx.navigator={};vm.createContext(ctx);
scripts.forEach((x,i)=>new vm.Script(x[2],{filename:'StepUp-'+(i+1)+'.js'}).runInContext(ctx));
const run=s=>vm.runInContext(s,ctx);
const d=JSON.parse(run("JSON.stringify({lessons:LESSONS,stages:STAGES,order:StepUpV14.stageOrder,banks:LESSON_QUESTIONS,words:WORDS,speech:SPEECH_TEXT,phrases:PHRASES,audio:AUDIO,wordExamples:WORD_EXAMPLES})"));
const lessons=d.lessons, order=d.order, banks=d.banks;
ok(lessons.length===46,'Expected 46 lessons, got '+lessons.length);
ok(order.length===7&&Object.keys(d.stages).length===7,'Expected seven stages');
for(const [stage,count] of [['beginner',4],['foundation',10],['intermediate',4],['advanced',4],['upper',8],['advanced2',8],['proficiency',8]])ok(lessons.filter(x=>x.stage===stage).length===count,'Wrong lesson count for '+stage);
const norm=x=>String(x??'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
const words=new Map(d.words.map(x=>[norm(x[0]),x]));
ok(words.size===d.words.length&&d.words.length>=250,'Dictionary duplicates or too small');
for(const row of d.words){ok(row[1]&&String(row[1]).trim(),'Missing translation: '+row[0]);const key='word_'+norm(row[0]).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');ok(d.speech[key],'Missing pronunciation key: '+row[0]);}
for(const lesson of lessons){
 ok(lesson.title&&lesson.desc&&lesson.goal,'Incomplete lesson: '+lesson.id);
 ok(lesson.tips?.length>=2&&lesson.topics?.length,'Missing teaching tips or topic tags: '+lesson.id);
 const bank=banks[lesson.id];ok(bank?.length===10,'Lesson test bank size: '+lesson.id);
 for(const q of bank){ok(q[1]?.length===4&&new Set(q[1]).size===4,'Bad choices: '+lesson.id);ok(Number.isInteger(q[2])&&q[2]>=0&&q[2]<4,'Bad answer index: '+lesson.id);ok(q[3]&&lesson.topics.includes(q[4]),'Question has no valid topic tag: '+lesson.id);}
 for(const item of lesson.vocab||[]){const w=Array.isArray(item)?item[0]:item;ok(words.has(norm(w)),'Untranslated lesson word: '+w);}
 if(lesson.v14){ok(lesson.examples?.length===8,'Missing 8 lesson examples: '+lesson.id);for(let i=0;i<8;i++){const ex=lesson.examples[i],q=bank[i];ok(q[4]===ex[2]&&q[0].includes(i%2===0?ex[0]:ex[1]),'Test question not based on its taught example: '+lesson.id+'/'+i);ok(d.speech['v14_sentence_'+lesson.id+'_'+i]===ex[0],'Missing sentence speech mapping: '+lesson.id+'/'+i);}}
}
ok(d.phrases.length===9,'Legacy phrases were not preserved');
for(const p of d.phrases)ok(p[0]&&p[1]&&p[2]&&d.speech[p[0]]===p[1]&&d.audio[p[0]],'Phrase data/audio mismatch: '+p[0]);
run("view='course';render()");
ok((el('app').innerHTML.match(/class="stage-block"/g)||[]).length===7,'Course screen does not show seven stages');
for(const l of lessons){run("currentLesson="+JSON.stringify(l.id)+";view='lesson';render()");const page=el('app').innerHTML;ok(page.includes(l.title)&&!page.includes('translation-missing'),'Lesson screen/translation failure: '+l.id);if(l.v14)ok(page.includes('v14-builder')&&(page.match(/class="v14-example"/g)||[]).length===8,'Builder or lesson examples missing: '+l.id);}
run("view='tests';render()");
ok((el('app').innerHTML.match(/data-action="start-quiz" data-stage="(?!all)/g)||[]).length===7,'Tests page does not show seven exams');
for(const stage of order){run("startQuiz("+JSON.stringify(stage)+",'test','')");const qs=JSON.parse(run("JSON.stringify(quiz.questions)"));ok(qs.length===12&&qs.every(q=>q.stage===stage),'Level exam not scoped: '+stage);}
for(const l of lessons){run("startQuiz("+JSON.stringify(l.stage)+",'lesson',"+JSON.stringify(l.id)+")");const qs=JSON.parse(run("JSON.stringify(quiz.questions)"));ok(qs.length===8&&qs.every(q=>q.lessonId===l.id&&q.stage===l.stage),'Lesson exam crossed lesson boundary: '+l.id);}
run("startQuiz('all','final','')");let qs=JSON.parse(run("JSON.stringify(quiz.questions)"));ok(qs.length===20&&new Set(qs.map(q=>q.stage)).size===7,'Final exam coverage failed');for(const s of order)ok(qs.filter(q=>q.stage===s).length>=2,'Final exam missing stage: '+s);
run("startQuiz('all','placement','')");qs=JSON.parse(run("JSON.stringify(quiz.questions)"));ok(qs.length===21,'Placement exam should have 21 questions');for(const s of order){const own=qs.filter(q=>q.stage===s);ok(own.length===3&&new Set(own.map(q=>q.lessonId)).size===3,'Placement coverage failed: '+s);}
for(let i=0;i<21;i++){const q=JSON.parse(run("JSON.stringify(quiz.questions[quiz.index])"));run("answerQuestion("+q.answer+")");run('nextQuestion()');}
ok(run("progress.placement&&progress.placement.recommended==='proficiency'"),'Placement recommendation failed');
run("currentLesson='l17';view='lesson';render()");
function click(action,extra={}){const node={dataset:{action,...extra}},event={target:{closest:()=>node}};for(const h of handlers)if(h.type==='click')h.fn(event);}
const tokens=JSON.parse(run("JSON.stringify(v14Builder.tokens)"));for(let i=0;i<tokens.length;i++)click('v14-builder-token',{tokenIndex:String(i)});click('v14-builder-check');ok(run('v14Builder.success===true'),'Sentence builder failed');
run("initFlash('sentences')");const cards=JSON.parse(run('JSON.stringify(flash.items)'));ok(cards.length===240&&cards.every(x=>x.front&&x.back&&x.audio),'Sentence practice deck incomplete');
console.log(JSON.stringify({version:'1.4.0',lessons:46,stages:7,dictionary:d.words.length,lessonQuestionBanks:Object.keys(banks).length,questions:Object.values(banks).reduce((n,x)=>n+x.length,0),sentences:cards.length,allScreens:'46/46',lessonAndLevelTests:'passed',finalAndPlacement:'passed',builder:'passed',syntax:'passed'},null,2));