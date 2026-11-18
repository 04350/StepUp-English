const fs = require("node:fs");
const vm = require("node:vm");
const html = fs.readFileSync("index.html", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function readConstant(name, nextName) {
  const marker = `const ${name} = `;
  const start = html.indexOf(marker);
  assert(start >= 0, `Missing constant: ${name}`);
  const bodyStart = start + marker.length;
  const end = html.indexOf(`;
const ${nextName}`, bodyStart);
  assert(end >= 0, `Cannot delimit constant: ${name}`);
  return JSON.parse(html.slice(bodyStart, end));
}

const words = readConstant("WORDS", "WORD_EXAMPLES");
const examples = readConstant("WORD_EXAMPLES", "PHRASES");
const letters = readConstant("LETTERS", "WORDS");
const lessons = readConstant("LESSONS", "STAGES");
const stages = readConstant("STAGES", "QUESTIONS");
const stageQuestions = readConstant("QUESTIONS", "LESSON_QUESTIONS");
const lessonQuestions = readConstant("LESSON_QUESTIONS", "STORE_KEY");
const speech = readConstant("SPEECH_TEXT", "LETTERS");

assert(words.length >= 150, `Expected at least 150 vocabulary entries, got ${words.length}`);
const wordMap = new Map(words.map(row => [row[0].toLowerCase(), row]));
assert(wordMap.size === words.length, "Duplicate vocabulary entries found");
for (const [word, meaning] of wordMap.entries()) {
  assert(meaning[1] && meaning[1].trim(), `Missing Hebrew translation for ${word}`);
  const key = "word_" + word.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  assert(speech[key], `Missing speech text mapping for ${word}`);
}

assert(lessons.length === 16, `Expected 16 lessons, got ${lessons.length}`);
assert(Object.keys(stages).length === 4, "Expected four learning stages");
for (const [letter, info] of Object.entries(letters)) {
  assert(info[0] && wordMap.has(info[0].toLowerCase()), `Alphabet example word for ${letter} has no translation`);
}
for (const lesson of lessons) {
  for (const word of lesson.vocab || []) {
    const entry = wordMap.get(word.toLowerCase());
    assert(entry && entry[1], `Lesson ${lesson.id} has untranslated vocabulary: ${word}`);
  }
  const bank = lessonQuestions[lesson.id];
  assert(Array.isArray(bank) && bank.length === 10, `Lesson ${lesson.id} must have 10 dedicated questions`);
  const prompts = new Set();
  for (const [index, q] of bank.entries()) {
    assert(typeof q[0] === "string" && q[0].trim(), `Empty prompt in ${lesson.id} question ${index + 1}`);
    assert(Array.isArray(q[1]) && q[1].length === 4, `Question ${lesson.id}/${index + 1} must have four options`);
    assert(new Set(q[1]).size === 4, `Question ${lesson.id}/${index + 1} has duplicate options`);
    assert(Number.isInteger(q[2]) && q[2] >= 0 && q[2] < 4, `Invalid correct option in ${lesson.id}/${index + 1}`);
    assert(typeof q[3] === "string" && q[3].trim(), `Missing explanation in ${lesson.id}/${index + 1}`);
    assert(!prompts.has(q[0]), `Duplicate question in ${lesson.id}: ${q[0]}`);
    prompts.add(q[0]);
  }
}
for (const [stage, bank] of Object.entries(stageQuestions)) {
  assert(bank.length === 12, `Stage ${stage} should retain 12 review questions`);
}
for (const [word, sample] of Object.entries(examples)) {
  assert(wordMap.has(word.toLowerCase()), `Example sentence references unknown word: ${word}`);
  assert(Array.isArray(sample) && sample.length === 2 && sample.every(Boolean), `Invalid example sentence: ${word}`);
}

assert(html.includes("startQuiz(el.dataset.stage,'lesson',el.dataset.lesson||currentLesson)"),
  "Lesson check is not connected to its lesson ID");
assert(html.includes("data-deck=\"mistakes\""), "Mistake-review deck is missing");
assert(html.includes("data-mode=\"final\""), "Comprehensive exam control is missing");
assert(!html.includes("מילת הדוגמה של האות"), "Old generic vocabulary fallback is still present");

const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(match => !/\bsrc\s*=/.test(match[1]));
assert(scripts.length > 0, "No inline application script found");
scripts.forEach((match, index) => new vm.Script(match[2], {filename: `inline-${index + 1}.js`}));

console.log(JSON.stringify({
  lessons: lessons.length,
  vocabulary: words.length,
  dedicatedLessonQuestions: Object.values(lessonQuestions).reduce((sum, bank) => sum + bank.length, 0),
  stageReviewQuestions: Object.values(stageQuestions).reduce((sum, bank) => sum + bank.length, 0),
  speechMappings: Object.keys(speech).length,
  examples: Object.keys(examples).length,
  javascriptSyntax: "passed"
}, null, 2));
