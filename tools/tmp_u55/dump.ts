import fs from 'node:fs';
import { dialogues } from '../../src/content/shared/dialogues/companions_u55';
import { quests } from '../../src/content/shared/quests/companions_u55';

const words = (t: string): number => t.split(/\s+/).filter(Boolean).length;
const nodes: string[] = [];
const choices: string[] = [];
const storyNodes: string[] = [];
let n = 0;
let nStory = 0;
let nWritten = 0;
const bySpeaker: Record<string, number> = {};
let variants = 0;
for (const s of dialogues) {
  for (const nd of s.nodes) {
    n++;
    if (nd.tags?.[0] === 'story') {
      nStory++;
      storyNodes.push(nd.text);
    } else {
      nWritten++;
      nodes.push(nd.text);
      bySpeaker[nd.speaker] = (bySpeaker[nd.speaker] ?? 0) + 1;
    }
    variants += nd.textVariants?.length ?? 0;
    for (const c of nd.choices ?? []) choices.push(c.text);
  }
}
const uniq = (a: string[]): string[] => [...new Set(a)];
console.log(JSON.stringify({ nodes: n, story: nStory, written: nWritten, variants, bySpeaker, scenes: dialogues.length, choices: uniq(choices).length }));
console.log('MAXWORDS', Math.max(...nodes.map(words)), nodes.filter((t) => words(t) > 45).map((t) => `${words(t)}: ${t.slice(0, 50)}`));
const journals = quests.flatMap((q) => q.stages.filter((st) => st.tags?.[0] === 'written').map((st) => st.journal));
const other = quests.map((q) => q.description);
console.log('JOURNALS', journals.length, 'MAXJ', Math.max(...journals.map(words)));
fs.writeFileSync('tools/tmp_u55/written.json', JSON.stringify({ nodes: uniq(nodes), choices: uniq(choices), journals: uniq(journals), other: uniq(other), storyNodes: uniq(storyNodes) }, null, 2));
