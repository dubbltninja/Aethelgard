# How agents commit their own deliverable

Several agents share one working copy. Commit ONLY your own files, with explicit paths, and retry
on lock contention. Never run `git add -A`, `git add .`, `git stash`, `git reset`, `git checkout`,
`git pull`, `git rebase`, or anything that touches other files. Never push to `main`.

```bash
cd /home/claude/aethelgard
FILES="docs/reviews/REVIEW-EXAMPLE.md"          # your file(s) only, space-separated
MSG="docs: <one-line summary of your deliverable>"
for i in 1 2 3 4 5 6 7 8; do
  git add -- $FILES && git commit -q -m "$MSG" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014WPUyNWhiU78rnjBrdg3qz" -- $FILES && break
  sleep $((3 + RANDOM % 8))
done
for i in 1 2 3 4 5 6 7 8; do
  git push -q origin unraveling && break
  sleep $((5 + RANDOM % 10))
done
git log --oneline -1 -- $FILES
```

If the commit loop reports "nothing to commit", your file is already committed; just push.
