import fs from 'node:fs';
import { dialogues } from '../../src/content/shared/dialogues/companions_u55';
import { quests } from '../../src/content/shared/quests/companions_u55';

const STORY = fs.readFileSync('docs/STORY.md', 'utf8');
const STORY_FLAT = STORY.replace(/\n\s*>?\s*/g, ' ').replace(/\*/g, '').replace(/\s+/g, ' ');
const inStory = (text: string): boolean => text.split('\n').every((line) => STORY_FLAT.includes(line));
for (const s of dialogues) {
  for (const n of s.nodes) {
    if (n.tags?.[0] === 'story' && !inStory(n.text)) console.log('NOT IN STORY node', s.id, n.id, n.text);
    for (const c of n.choices ?? []) if (!inStory(c.text)) console.log('choice not in story (fine if written):', s.id, n.id, c.text);
  }
}
for (const q of quests) {
  const first = q.stages[0]!;
  if (!inStory(first.journal)) console.log('NOT IN STORY journal', q.id, first.journal);
}
console.log('done');
