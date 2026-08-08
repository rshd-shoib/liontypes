/* Word corpora + quote bank ------------------------------------------------ */

export const COMMON = `the be to of and a in that have I it for not on with he as you do at this
but his by from they we say her she or an will my one all would there their what so up out if about who get
which go me when make can like time no just him know take people into year your good some could them see other
than then now look only come its over think also back after use two how our work first well way even new want
because any these give day most us man find here thing tell very great old life little world own under last
never place same tell high need feel three state hand school still such begin call every between school might
open point next few small change plan learn keep write start might play move night live believe hold bring
happen must write provide sit stand lose pay meet include continue set learn lead understand watch follow stop
create speak read allow add spend grow walk win offer remember love consider appear buy wait serve die send
build stay fall cut reach kill remain suggest raise pass sell require report decide pull return explain hope
develop carry break receive agree support hit produce eat cover catch draw choose cause point listen wonder
push reduce protect prepare form share test finish notice enter wear settle claim compare argue design train
apply prove attack rest measure express fill press collect drive relate accept forget teach avoid discuss
manage arrive introduce imagine deliver replace attend perform mention observe survive achieve maintain
recognize represent establish determine indicate encourage identify contribute demonstrate participate`
  .split(/\s+/).filter(Boolean);

export const ADVANCED = `algorithm architecture asynchronous bandwidth benchmark bootstrap cache cascade
cipher cluster compile concurrency container cryptography daemon debug dependency deployment deterministic
encapsulation entropy ephemeral firmware framework gradient heuristic idempotent immutable inheritance
instantiate interface iteration kernel latency lexical middleware modular mutation namespace normalization
obfuscate optimize orchestration overhead parallel parameter persistence pipeline polymorphism precision
protocol quantum queue recursion refactor regression rendering repository resolution runtime scalability
schema semantics serialization singleton stochastic synchronous syntax telemetry threshold throughput
tokenize topology transpile traversal validation variance velocity virtualization volatile wireframe`
  .split(/\s+/).filter(Boolean);

export const QUOTES = [
  { text: "The lion does not turn around when a small dog barks.", author: "African proverb" },
  { text: "It is better to live one day as a lion than a hundred years as a sheep.", author: "Italian proverb" },
  { text: "Speed is a byproduct of precision. Chase the clean stroke and the clock will follow on its own.", author: "LionTypes" },
  { text: "Everything you can imagine is real, and everything real was once only imagined by someone stubborn enough to keep going.", author: "Pablo Picasso" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit formed one small repetition at a time.", author: "Will Durant" },
  { text: "The best time to plant a tree was twenty years ago. The second best time is now, so stop reading and start moving.", author: "Proverb" },
  { text: "A ship in harbor is safe, but that is not what ships are built for, and it is certainly not what you were built for either.", author: "John A. Shedd" },
  { text: "Simplicity is the ultimate sophistication, and it takes far more work to remove a thing than it ever takes to add one.", author: "Leonardo da Vinci" },
  { text: "Do not go where the path may lead; go instead where there is no path and leave a trail behind you for the rest.", author: "Ralph Waldo Emerson" },
  { text: "The obstacle in the path becomes the path. Never forget, within every obstacle is an opportunity to improve our condition.", author: "Ryan Holiday" },
  { text: "Amateurs sit and wait for inspiration, the rest of us just get up and go to work before the sun is fully awake.", author: "Stephen King" },
  { text: "Courage is not the absence of fear, but rather the judgement that something else is more important than fear itself.", author: "Ambrose Redmoon" },
];

const PUNCT_WRAP = [['"', '"'], ['(', ')'], ["'", "'"], ['[', ']']];
const PUNCT_END = ['.', ',', '.', '!', '?', ';', ':', ',', '.'];

function rint(n) { return Math.floor(Math.random() * n); }
function pick(a) { return a[rint(a.length)]; }

/**
 * Build a word list for a test.
 * @param {{count:number, punctuation:boolean, numbers:boolean, hard:boolean}} opts
 */
export function generateWords({ count = 60, punctuation = false, numbers = false, hard = false } = {}) {
  const pool = hard ? COMMON.concat(ADVANCED) : COMMON;
  const out = [];
  let sentenceStart = true;

  for (let i = 0; i < count; i++) {
    if (numbers && Math.random() < 0.09) {
      out.push(String(rint(9000) + 10));
      continue;
    }
    let w = pick(pool);

    if (punctuation) {
      if (sentenceStart) { w = w[0].toUpperCase() + w.slice(1); sentenceStart = false; }
      if (Math.random() < 0.035) { const [a, b] = pick(PUNCT_WRAP); w = a + w + b; }
      if (Math.random() < 0.028) w += "'s";
      if (Math.random() < 0.14 && i < count - 1) {
        const p = pick(PUNCT_END);
        w += p;
        if (p === '.' || p === '!' || p === '?') sentenceStart = true;
      }
    }
    out.push(w);
  }
  if (punctuation && out.length) {
    const last = out[out.length - 1];
    if (!/[.!?]$/.test(last)) out[out.length - 1] = last + '.';
  }
  return out;
}

export function randomQuote() {
  const q = pick(QUOTES);
  return { words: q.text.split(' '), author: q.author, raw: q.text };
}
