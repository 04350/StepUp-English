const fs = require("node:fs");
const vm = require("node:vm");
const html = fs.readFileSync("index.html", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function normalize(value) {
  return String(value ?? "").normalize("NFKC").trim().toLowerCase().replace(/\\s+/g, " ");
}
function readConstant(name, nextName) {
  const marker = "const " + name + " = ";
  const start = html.indexOf(marker);
  assert(start >= 0, "Missing constant: " + name);
  const bodyStart = start + marker.length;
  const nextMarker = "const " + nextName + " = ";
  const nextStart = html.indexOf(nextMarker, bodyStart);
  assert(nextStart >= 0, "Cannot locate next constant after: " + name);
  const end = html.lastIndexOf(";", nextStart);
  assert(end >= bodyStart, "Cannot delimit constant: " + name);
  return JSON.parse(html.slice(bodyStart, end));
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

const audio = readConstant("AUDIO", "SPEECH_TEXT");
const speech = readConstant("SPEECH_TEXT", "LETTERS");
const letters = readConstant("LETTERS", "WORDS");
const words = readConstant("WORDS", "WORD_EXAMPLES");
const examples = readConstant("WORD_EXAMPLES", "PHRASES");
const phrases = readConstant("PHRASES", "LESSONS");
const lessons = readConstant("LESSONS", "STAGES");
const stages = readConstant("STAGES", "QUESTIONS");
const stageQuestions = readConstant("QUESTIONS", "LESSON_QUESTIONS");
const lessonQuestions = readConstant("LESSON_QUESTIONS", "STORE_KEY");

assert(words.length >= 150, "Expected at least 150 vocabulary entries, got " + words.length);
const wordMap = new Map(words.map(row => [normalize(row[0]), row]));
assert(wordMap.size === words.length, "Duplicate vocabulary entries found");
for (const row of words) {
  const word = row[0], meaning = row[1], category = row[2];
  assert(word && meaning && String(meaning).trim(), "Missing Hebrew translation for " + word);
  assert(category, "Missing vocabulary category for " + word);
  const audioKey = "word_" + normalize(word).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  assert(speech[audioKey], "Missing local speech text for " + word);
}

assert(lessons.length === 16, "Expected 16 lessons, got " + lessons.length);
assert(Object.keys(stages).length === 4, "Expected four learning stages");
assert(Object.keys(letters).length === 26, "Expected all 26 alphabet letters");
for (const [letter, info] of Object.entries(letters)) {
  assert(info[0] && wordMap.has(normalize(info[0])), "Alphabet example word for " + letter + " has no Hebrew translation");
  assert(info[1] && info[2], "Alphabet letter " + letter + " is missing its Hebrew name or pronunciation tip");
  const audioKey = "word_" + normalize(info[0]).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  assert(speech[audioKey], "Alphabet example word for " + letter + " has no pronunciation mapping");
}

for (const lesson of lessons) {
  assert(lesson.title && lesson.desc && lesson.goal, "Lesson " + lesson.id + " is missing core teaching text");
  assert(Array.isArray(lesson.tips) && lesson.tips.length > 0, "Lesson " + lesson.id + " has no learning tips");
  for (const word of lesson.vocab || []) {
    const entry = wordMap.get(normalize(word));
    assert(entry && entry[1], "Lesson " + lesson.id + " has untranslated vocabulary: " + word);
    const audioKey = "word_" + normalize(word).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    assert(speech[audioKey], "Lesson " + lesson.id + " has no pronunciation mapping for: " + word);
  }
  const bank = lessonQuestions[lesson.id];
  assert(Array.isArray(bank) && bank.length === 10, "Lesson " + lesson.id + " must have 10 dedicated questions");
  const prompts = new Set();
  for (const [index, q] of bank.entries()) {
    assert(typeof q[0] === "string" && q[0].trim(), "Empty prompt in " + lesson.id + " question " + (index + 1));
    assert(Array.isArray(q[1]) && q[1].length === 4, "Question " + lesson.id + "/" + (index + 1) + " must have four options");
    assert(new Set(q[1]).size === 4, "Question " + lesson.id + "/" + (index + 1) + " has duplicate options");
    assert(Number.isInteger(q[2]) && q[2] >= 0 && q[2] < 4, "Invalid correct option in " + lesson.id + "/" + (index + 1));
    assert(typeof q[3] === "string" && q[3].trim(), "Missing explanation in " + lesson.id + "/" + (index + 1));
    assert(!prompts.has(q[0]), "Duplicate question in " + lesson.id + ": " + q[0]);
    prompts.add(q[0]);
  }
}
for (const [stage, bank] of Object.entries(stageQuestions)) {
  assert(bank.length === 12, "Stage " + stage + " should retain 12 review questions");
  for (const [index, q] of bank.entries()) {
    assert(q[1]?.length === 4 && new Set(q[1]).size === 4, "Invalid stage question " + stage + "/" + (index + 1));
    assert(Number.isInteger(q[2]) && q[2] >= 0 && q[2] < 4, "Invalid stage answer " + stage + "/" + (index + 1));
    assert(q[3] && q[3].trim(), "Missing stage explanation " + stage + "/" + (index + 1));
  }
}

assert(phrases.length === 9, "Expected 9 useful phrases, got " + phrases.length);
for (const [index, phrase] of phrases.entries()) {
  const key = phrase[0], english = phrase[1], hebrew = phrase[2];
  assert(key && english && hebrew && hebrew.trim(), "Phrase " + (index + 1) + " is missing an English or Hebrew side");
  assert(speech[key] === english, "Phrase speech mapping does not match: " + key);
  assert(audio[key], "Phrase is missing its bundled audio fallback: " + key);
}

for (const [word, sample] of Object.entries(examples)) {
  assert(wordMap.has(normalize(word)), "Example sentence references unknown word: " + word);
  assert(Array.isArray(sample) && sample.length === 2 && sample.every(Boolean), "Invalid example sentence: " + word);
}
for (const key of ["good morning", "good night", "excuse me"]) {
  assert(wordMap.has(key), "Lesson 5 translation is missing: " + key);
}
for (const key of ["yes", "no"]) {
  assert(examples[key], "Lesson 5 basic word is missing its example sentence: " + key);
}
assert(html.includes("function normalizeTerm"), "Shared vocabulary normalization is missing");
assert(html.includes("translation-missing"), "Missing-translation visual fallback is missing");
assert(html.includes('data-deck="phrases"'), "Translated phrase practice deck is missing");
assert(html.includes("window.StepUpNative.speakEnglish"), "Android offline TTS bridge is not used");
assert(html.includes("startQuiz(el.dataset.stage,'lesson',el.dataset.lesson||currentLesson)"),
  "Lesson check is not connected to its lesson ID");
assert(html.includes('data-deck="mistakes"'), "Mistake-review deck is missing");
assert(html.includes('data-mode="final"'), "Comprehensive exam control is missing");
assert(!html.includes("מילת הדוגמה של האות"), "Old generic vocabulary fallback is still present");

const scriptMatches = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(match => !/\bsrc\s*=/.test(match[1]));
assert(scriptMatches.length > 0, "No inline application script found");
scriptMatches.forEach((match, index) => new vm.Script(match[2], {filename: "inline-" + (index + 1) + ".js"}));

// Run the actual app script in a small DOM stub to verify rendered screens.
const elements = new Map();
function element(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      innerHTML: "",
      textContent: "",
      value: "",
      disabled: false,
      classList: { toggle() {} },
      addEventListener() {}
    });
  }
  return elements.get(id);
}
const storage = new Map();
const sandbox = {
  document: {
    getElementById: element,
    querySelectorAll: () => [],
    addEventListener() {},
    createElement: () => ({ click() {}, style: {}, setAttribute() {} })
  },
  localStorage: {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key)
  },
  window: {},
  console,
  confirm: () => true,
  setTimeout,
  clearTimeout
};
vm.createContext(sandbox);
new vm.Script(scriptMatches[0][2], {filename: "StepUp-English-app.js"}).runInContext(sandbox);

for (const lesson of lessons) {
  vm.runInContext('currentLesson = "' + lesson.id + '"; view = "lesson"; render();', sandbox);
  const page = element("app").innerHTML;
  assert(page.includes(lesson.title), "Lesson screen did not render: " + lesson.id);
  assert(!page.includes("translation-missing"), "Lesson " + lesson.id + " rendered an untranslated word");
  for (const word of lesson.vocab || []) {
    const meaning = wordMap.get(normalize(word))[1];
    assert(page.includes(escapeHtml(meaning)), "Lesson " + lesson.id + " does not visibly render translation for " + word);
  }
}
vm.runInContext('currentLesson = "l5"; view = "lesson"; render();', sandbox);
const lessonFiveHtml = element("app").innerHTML;
for (const meaning of ["בוקר טוב", "לילה טוב", "סליחה / אפשר לבקש?"]) {
  assert(lessonFiveHtml.includes(meaning), "Lesson 5 screen does not show translation: " + meaning);
}
vm.runInContext('initFlash("phrases"); flash.show = true; render();', sandbox);
const phraseCards = JSON.parse(vm.runInContext("JSON.stringify(flash.items)", sandbox));
assert(phraseCards.length === phrases.length, "Phrase practice deck count mismatch");
for (const phrase of phrases) {
  assert(phraseCards.some(card => card.front === phrase[1] && card.back === phrase[2]),
    "Phrase practice deck has no Hebrew translation for " + phrase[0]);
}

vm.runInContext('startQuiz("foundation", "lesson", "l5");', sandbox);
const lessonQuiz = JSON.parse(vm.runInContext("JSON.stringify(quiz.questions)", sandbox));
assert(lessonQuiz.length === 8 && lessonQuiz.every(q => q.lessonId === "l5"),
  "Lesson 5 check is not using its own dedicated question bank");
vm.runInContext('startQuiz("foundation", "test");', sandbox);
const levelQuiz = JSON.parse(vm.runInContext("JSON.stringify(quiz.questions)", sandbox));
assert(levelQuiz.length === 12 && levelQuiz.every(q => !q.lessonId || ["l5", "l6", "l7", "l8"].includes(q.lessonId)),
  "Foundation level test includes questions from the wrong level");
vm.runInContext('startQuiz("all", "final");', sandbox);
const finalQuiz = JSON.parse(vm.runInContext("JSON.stringify(quiz.questions)", sandbox));
assert(finalQuiz.length === 20, "Comprehensive test must contain 20 questions");

vm.runInContext('startQuiz("foundation", "lesson", "l5");', sandbox);
const firstQuestion = JSON.parse(vm.runInContext("JSON.stringify(quiz.questions[0])", sandbox));
vm.runInContext("answerQuestion(" + ((firstQuestion.answer + 1) % 4) + ");", sandbox);
const mistakeCount = vm.runInContext("(progress.mistakes || []).length", sandbox);
assert(mistakeCount === 1, "An incorrect answer was not saved for review");
vm.runInContext('initFlash("mistakes");', sandbox);
assert(vm.runInContext("flash.items.length", sandbox) === 1, "Mistake review deck did not load the saved error");

console.log(JSON.stringify({
  lessons: lessons.length,
  vocabulary: words.length,
  lessonFiveTranslations: ["בוקר טוב", "לילה טוב", "סליחה / אפשר לבקש?"],
  translatedPhrases: phrases.length,
  dedicatedLessonQuestions: Object.values(lessonQuestions).reduce((sum, bank) => sum + bank.length, 0),
  stageReviewQuestions: Object.values(stageQuestions).reduce((sum, bank) => sum + bank.length, 0),
  embeddedAudioKeys: Object.keys(audio).length,
  speechMappings: Object.keys(speech).length,
  exampleSentences: Object.keys(examples).length,
  runtimeScreens: "16/16 lessons rendered",
  quizFlows: "lesson, level, comprehensive and mistake review passed",
  javascriptSyntax: "passed"
}, null, 2));
