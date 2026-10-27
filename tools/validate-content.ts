// `npm run validate` (PLAN §5.19, §9.2 U19): loads the authored content (`contentTables` in src/content/index.ts), parses every
// table with its zod schema and runs `validateContent` in strict mode, printing a summary. Exit 0 = no errors.
//
//   bun tools/validate-content.ts [--lenient] [--verbose]
//
// While content is still being authored (`INCOMPLETE_TABLES` in src/content/progress.ts is non-empty, D-090) the
// completeness-count rules (15 abilities per class, 8 endings, six companions, 73 locations …) and references into the
// incomplete tables are reported as "pending — content not yet authored" warnings and the exit code stays 0. Once every
// table is complete they are errors. `--lenient` skips the completeness rules entirely (what the unit
// tests use); `--verbose` lists every pending warning instead of one line per rule.
import { contentTables, formatIssue, parseContentPack, type ContentTables } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { RULES, validateContent } from '@content/validate';
import { TABLE_NAMES, type ContentIssue } from '@schema/contentPack';

const PENDING_MARK = 'pending — content not yet authored';
const PENDING_REF_MARK = 'pending — content not yet authored (reference)';

/** Groups issues by rule, keeping first-seen order: `[rule, issues][]`. */
function byRule(issues: readonly ContentIssue[]): [string, ContentIssue[]][] {
  const groups = new Map<string, ContentIssue[]>();
  for (const issue of issues) {
    const list = groups.get(issue.rule) ?? [];
    list.push(issue);
    groups.set(issue.rule, list);
  }
  return [...groups];
}

export function main(
  argv: readonly string[],
  write: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
  tables: Partial<ContentTables> = contentTables,
): number {
  const lenient = argv.includes('--lenient');
  const verbose = argv.includes('--verbose');

  // Parse first, without cross-validation: a record that fails its schema makes every reference to it noise.
  const { pack, report: parsed } = parseContentPack(tables, { validate: false });
  const counts = TABLE_NAMES.map((name) => `${name} ${Object.keys(pack[name]).length}`).join(' · ');
  if (parsed.errors.length > 0) {
    write(`validate: ${counts}`);
    for (const issue of parsed.errors) write(`  error ${formatIssue(issue)}`);
    write(`validate: FAILED — ${parsed.errors.length} schema error(s); cross-reference rules not run`);
    return 1;
  }

  // The authored tables use the authoring progress list; a test passing its own tables gets a fully resolved check.
  const incompleteTables = tables === contentTables ? INCOMPLETE_TABLES : [];
  const { errors, warnings } = validateContent(pack, { strict: !lenient, pending: incompleteTables.length > 0, incompleteTables });
  write(`validate: ${RULES.length} rules, ${lenient ? 'lenient' : 'strict'} — ${counts}`);

  const pending = warnings.filter((w) => w.message.startsWith(PENDING_MARK));
  const real = warnings.filter((w) => !w.message.startsWith(PENDING_MARK));
  for (const issue of real) write(`  warning ${formatIssue(issue)}`);
  if (verbose) for (const issue of pending) write(`  pending ${formatIssue(issue)}`);
  else {
    for (const [rule, list] of byRule(pending)) {
      const refs = list.filter((w) => w.message.startsWith(PENDING_REF_MARK)).length;
      const checks = list.length - refs;
      const parts = [checks > 0 ? `${checks} completeness check(s)` : '', refs > 0 ? `${refs} reference(s) into tables still being authored` : ''].filter(Boolean);
      write(`  pending ${rule}: ${parts.join(', ')} — content not yet authored`);
    }
  }
  for (const issue of errors) write(`  error ${formatIssue(issue)}`);

  if (errors.length > 0) {
    write(`validate: FAILED — ${errors.length} error(s), ${real.length} warning(s)`);
    return 1;
  }
  const refCount = pending.filter((w) => w.message.startsWith(PENDING_REF_MARK)).length;
  const checkCount = pending.length - refCount;
  const note =
    pending.length > 0
      ? `, ${checkCount} pending completeness check(s), ${refCount} pending reference(s) (${incompleteTables.length} table(s) still being authored)`
      : '';
  write(`validate: ok — 0 errors, ${real.length} warning(s)${note}`);
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
