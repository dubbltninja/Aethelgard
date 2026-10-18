// Custom lint (PLAN §3.4, §2.3, D-065): ESLint is unavailable offline, so the repo's rules live here.
// One bun script, no plugins. TypeScript is parsed with the compiler API (`ts.createSourceFile`, no type-checking —
// tsc does that). Output: `path:line:col rule message`; exit 1 on any finding (there are no warnings).
//
//   bun tools/lint.ts              lint the repository
//   bun tools/lint.ts --root DIR   lint another tree laid out like the repo (used by the fixture test)
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export const REPO_ROOT = path.resolve(import.meta.dirname, '..');

export const RULES = [
  'layers',
  'engine-purity',
  'no-console',
  'no-explicit-any',
  'no-focused-tests',
  'no-debugger',
  'no-ts-ignore',
  'content-literals',
  'whitespace',
] as const;
export type RuleName = (typeof RULES)[number];

export interface Finding {
  file: string;
  line: number;
  col: number;
  rule: RuleName;
  message: string;
}

export interface LintOptions {
  /** Tree to lint (default: the repository). Paths in findings are relative to it, with `/` separators. */
  root?: string;
  /** tsconfig `paths` aliases; default: `<root>/tsconfig.json`, else the repository's tsconfig.json. */
  aliases?: Record<string, string>;
}

// ---- What gets linted ----------------------------------------------------------------------------------------------

const WALK_DIRS = ['src', 'tests', 'tools', 'public', '.github'];
const ROOT_FILES = /^(?:package\.json|tsconfig\.json|bunfig\.toml|playwright\.config\.ts|index\.html|\.editorconfig|\.npmrc|\.nvmrc)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-e2e', '.dev', 'coverage', 'test-results', 'playwright-report']);
/** Deliberate violations for tests/unit/tools/lint.test.ts; linted only when they are the root. */
const SKIP_PATHS = new Set(['tests/fixtures/lint']);
const TEXT_EXT = /\.(?:ts|tsx|mts|cts|js|mjs|cjs|css|json|md|html|yml|yaml|toml|svg|webmanifest)$/;
const CODE_EXT = /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/;
/** Tab indentation is an error in these (PLAN §3.4: TS/CSS; JS, JSON and HTML follow the same .editorconfig). */
const NO_TABS_EXT = /\.(?:ts|tsx|mts|cts|js|mjs|cjs|css|json|html)$/;

function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    if (SKIP_PATHS.has(rel)) return;
    for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(child);
      } else if (entry.isFile() && TEXT_EXT.test(entry.name)) {
        out.push(child);
      }
    }
  };
  for (const dir of WALK_DIRS) if (fs.existsSync(path.join(root, dir))) walk(dir);
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && ROOT_FILES.test(entry.name)) out.push(entry.name);
  }
  return out.sort();
}

// ---- Layers (PLAN §2.1, §2.3) ----------------------------------------------------------------------------------------

type Layer = 'engine' | 'schema' | 'content' | 'ui' | 'audio' | 'sim' | 'types' | 'app';

const LAYERS: readonly (readonly [Layer, RegExp])[] = [
  ['engine', /^src\/engine\//],
  ['schema', /^src\/content\/schema\//],
  ['content', /^src\/content\//],
  ['ui', /^src\/ui\//],
  ['audio', /^src\/audio\//],
  ['sim', /^src\/sim\//],
  ['types', /^src\/types\//],
  ['app', /^src\/main\.tsx?$/],
];

/** Which layers each layer may import. `engine/types` = only `src/engine/types/**`. `app` is the React root. */
const ALLOW: Record<Layer, readonly string[]> = {
  engine: ['engine', 'schema', 'types'],
  schema: ['schema', 'types'],
  content: ['content', 'schema', 'types'],
  ui: ['ui', 'engine', 'schema', 'content', 'audio', 'types'],
  audio: ['audio', 'types', 'engine/types'],
  sim: ['sim', 'engine', 'schema', 'content', 'types'],
  types: ['types'],
  app: ['app', 'ui', 'engine', 'schema', 'content', 'audio', 'types'],
};

/**
 * D-104 ruling 1 (U64): the app layer (src/main.tsx) — and no other — may import the scenario builders for the dev/e2e
 * `?scenario=` boot, behind `__DEV__ || __E2E__` (production drops them; tests/unit/ui/scenarioBoot.test.ts proves it).
 * Only this one module of sim: the runner, the bots and the CLI stay out of the app.
 */
export const APP_SCENARIOS = 'src/sim/scenarios.ts';

/** Bare packages allowed per layer (PLAN §2.3: engine and content import only zod). Absent = any package. */
const PACKAGES: Partial<Record<Layer, readonly string[]>> = {
  engine: ['zod'],
  schema: ['zod'],
  content: ['zod'],
};

export function layerOf(file: string): Layer | null {
  for (const [layer, re] of LAYERS) if (re.test(file)) return layer;
  return null;
}

function loadAliases(root: string): Record<string, string> {
  const config = [path.join(root, 'tsconfig.json'), path.join(REPO_ROOT, 'tsconfig.json')].find((f) => fs.existsSync(f));
  if (!config) return {};
  const parsed = ts.parseConfigFileTextToJson(config, fs.readFileSync(config, 'utf8'));
  const paths = (parsed.config as { compilerOptions?: { paths?: Record<string, string[]> } } | undefined)?.compilerOptions?.paths ?? {};
  const aliases: Record<string, string> = {};
  for (const [pattern, targets] of Object.entries(paths)) {
    const target = targets[0];
    if (target) aliases[pattern] = path.posix.normalize(target);
  }
  return aliases;
}

const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '.d.ts', '.mts', '.mjs', '.js', '/index.ts', '/index.tsx'];

type Target = { kind: 'file'; path: string } | { kind: 'package'; name: string };

function resolveImport(root: string, from: string, spec: string, aliases: Record<string, string>): Target {
  let base: string | null = null;
  if (spec.startsWith('./') || spec.startsWith('../') || spec === '.' || spec === '..') {
    base = path.posix.join(path.posix.dirname(from), spec);
  } else {
    for (const [pattern, target] of Object.entries(aliases)) {
      const star = pattern.indexOf('*');
      const prefix = star >= 0 ? pattern.slice(0, star) : pattern;
      if (star >= 0 ? spec.startsWith(prefix) : spec === pattern) {
        base = star >= 0 ? target.replace('*', spec.slice(prefix.length)) : target;
        break;
      }
    }
  }
  if (base === null) {
    const parts = spec.split('/');
    const name = spec.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? spec);
    return { kind: 'package', name };
  }
  base = path.posix.normalize(base);
  const stripped = base.replace(/\.(?:js|mjs|jsx)$/, '');
  for (const candidate of [base, stripped]) {
    for (const suffix of RESOLVE_SUFFIXES) {
      const file = candidate + suffix;
      if (fs.existsSync(path.join(root, file)) && fs.statSync(path.join(root, file)).isFile()) {
        return { kind: 'file', path: file };
      }
    }
  }
  return { kind: 'file', path: base };
}

// ---- Per-file AST rules ----------------------------------------------------------------------------------------------

interface ImportRef {
  spec: string;
  pos: number;
  typeOnly: boolean;
}

/** Globals the engine must not touch (D-032 determinism, D-031 no DOM). */
const ENGINE_GLOBALS = new Set([
  'crypto',
  'setTimeout',
  'setInterval',
  'localStorage',
  'sessionStorage',
  'window',
  'document',
  'navigator',
  'globalThis',
  'performance',
]);
const ENGINE_MEMBERS: Record<string, readonly string[]> = { Math: ['random'], Date: ['now'] };

/** D-044 type prefixes (PLAN §3.4) and plain ids. */
const ID_PREFIX =
  /^(?:region|loc|cr|item|mat|recipe|npc|q|echo|scene|codex|ending|closer|status|affix|att|ach|mod|sfx|screen|ev|flag|fam|pool|gate|ws|tyr|rgr|wiz|elf|wrd|wvr|comp|itm)_[a-z0-9_]+$/;
const PLAIN_IDS = new Set([
  'ranger', 'wizard', 'elf', 'ironclad_warden', 'shadow_weaver',
  'ilyra', 'brak', 'nyx', 'dask', 'mireya', 'caelum',
  'remnants', 'weavers', 'ironclad',
  'physical', 'fire', 'storm', 'ley', 'void', 'chrono',
  'strength', 'magic', 'agility',
]);

const FOCUS_TARGETS = new Set(['test', 'it', 'describe']);

function scriptKind(file: string): ts.ScriptKind {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (/\.(?:js|mjs|cjs)$/.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/** True when `id` is a reference to a (possibly global) binding, not a property name or a declaration name. */
function isFreeReference(id: ts.Identifier): boolean {
  const parent = id.parent;
  if (!parent) return true;
  if (ts.isPropertyAccessExpression(parent) && parent.name === id) return false;
  if (ts.isQualifiedName(parent) && parent.right === id) return false;
  if (
    (ts.isPropertyAssignment(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isMethodSignature(parent) ||
      ts.isGetAccessorDeclaration(parent) ||
      ts.isSetAccessorDeclaration(parent) ||
      ts.isEnumMember(parent)) &&
    parent.name === id
  ) {
    return false;
  }
  if (
    (ts.isVariableDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isFunctionDeclaration(parent) ||
      ts.isFunctionExpression(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isInterfaceDeclaration(parent) ||
      ts.isTypeAliasDeclaration(parent) ||
      ts.isEnumDeclaration(parent) ||
      ts.isImportSpecifier(parent) ||
      ts.isImportClause(parent) ||
      ts.isNamespaceImport(parent) ||
      ts.isExportSpecifier(parent) ||
      ts.isTypeParameterDeclaration(parent)) &&
    parent.name === id
  ) {
    return false;
  }
  if (ts.isBindingElement(parent) && (parent.name === id || parent.propertyName === id)) return false;
  if (ts.isLabeledStatement(parent) || ts.isBreakOrContinueStatement(parent)) return false;
  return true;
}

function unwrap(node: ts.Expression): ts.Expression {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

/** Content tables: object literals that are top-level exports (or elements of a top-level array / call argument). */
function topLevelEntities(sf: ts.SourceFile): ts.ObjectLiteralExpression[] {
  const out: ts.ObjectLiteralExpression[] = [];
  const collect = (expr: ts.Expression | undefined, depth: number) => {
    if (!expr) return;
    const node = unwrap(expr);
    if (ts.isObjectLiteralExpression(node)) out.push(node);
    else if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) {
        const inner = unwrap(element);
        if (ts.isObjectLiteralExpression(inner)) out.push(inner);
      }
    } else if (ts.isCallExpression(node) && depth === 0) {
      for (const arg of node.arguments) collect(arg, depth + 1);
    }
  };
  for (const statement of sf.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) collect(decl.initializer, 0);
    } else if (ts.isExportAssignment(statement)) {
      collect(statement.expression, 0);
    }
  }
  return out;
}

function collectComments(sf: ts.SourceFile): { pos: number; text: string }[] {
  const seen = new Set<number>();
  const out: { pos: number; text: string }[] = [];
  const add = (ranges: ts.CommentRange[] | undefined) => {
    for (const range of ranges ?? []) {
      if (seen.has(range.pos)) continue;
      seen.add(range.pos);
      out.push({ pos: range.pos, text: sf.text.slice(range.pos, range.end) });
    }
  };
  const visit = (node: ts.Node) => {
    if (node.kind === ts.SyntaxKind.JsxText) return;
    add(ts.getLeadingCommentRanges(sf.text, node.getFullStart()));
    add(ts.getTrailingCommentRanges(sf.text, node.getEnd()));
    for (const child of node.getChildren(sf)) visit(child);
  };
  visit(sf);
  return out;
}

/** A TypeScript comment directive, recognised the way tsc does: at the start of the comment (or of a line in a block comment). */
function tsDirective(comment: string): { kind: 'ignore' | 'nocheck' | 'expect-error'; rest: string } | null {
  const lines = comment.startsWith('//') ? [comment.replace(/^\/\/\/?/, '')] : comment.replace(/^\/\*+|\*+\/$/g, '').split('\n');
  for (const line of lines) {
    const match = /^[\s*]*@ts-(ignore|nocheck|expect-error)\b(.*)$/.exec(line);
    if (match) return { kind: match[1] as 'ignore' | 'nocheck' | 'expect-error', rest: (match[2] ?? '').replace(/^[\s:—–-]+/, '').trim() };
  }
  return null;
}

interface FileReport {
  imports: ImportRef[];
  sf: ts.SourceFile;
}

function lintCode(file: string, text: string, report: (pos: number, rule: RuleName, message: string) => void): FileReport {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
  const inEngine = file.startsWith('src/engine/');
  /** Determinism applies to the engine and to the sim bots (PLAN §7.1): same seed, same run. */
  const pureRoot = inEngine ? 'src/engine' : file.startsWith('src/sim/bots/') ? 'src/sim/bots' : undefined;
  const inContent = file.startsWith('src/content/');
  const inTypes = file.startsWith('src/types/');
  const inTests = file.startsWith('tests/');
  const imports: ImportRef[] = [];
  const at = (node: ts.Node) => node.getStart(sf);

  const visit = (node: ts.Node, inType: boolean) => {
    // imports and re-exports
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push({ spec: node.moduleSpecifier.text, pos: at(node), typeOnly: node.importClause?.isTypeOnly ?? false });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push({ spec: node.moduleSpecifier.text, pos: at(node), typeOnly: node.isTypeOnly });
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      imports.push({ spec: node.moduleReference.expression.text, pos: at(node), typeOnly: node.isTypeOnly });
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      imports.push({ spec: node.argument.literal.text, pos: at(node), typeOnly: true });
    } else if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const arg = node.arguments[0];
      const isDynamic = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      if ((isDynamic || isRequire) && arg && ts.isStringLiteralLike(arg)) {
        imports.push({ spec: arg.text, pos: at(node), typeOnly: false });
      }
    }

    if (node.kind === ts.SyntaxKind.AnyKeyword && !inTypes) {
      report(at(node), 'no-explicit-any', 'explicit `any` (allowed only in src/types/); use `unknown` or a real type');
    }
    if (node.kind === ts.SyntaxKind.DebuggerStatement) {
      report(at(node), 'no-debugger', '`debugger` statement');
    }
    if (inTests && ts.isPropertyAccessExpression(node) && node.name.text === 'only') {
      const called = ts.isCallExpression(node.parent) && node.parent.expression === node;
      const target = ts.isIdentifier(node.expression) && FOCUS_TARGETS.has(node.expression.text);
      if (called || target) report(at(node), 'no-focused-tests', `focused test \`${node.getText(sf)}\``);
    }

    if (pureRoot !== undefined && !inType) {
      if (ts.isIdentifier(node) && ENGINE_GLOBALS.has(node.text) && isFreeReference(node)) {
        report(at(node), 'engine-purity', `\`${node.text}\` in ${pureRoot} (no DOM, timers or ambient entropy — D-031/D-032)`);
      }
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
        const members = ENGINE_MEMBERS[node.expression.text];
        if (members?.includes(node.name.text)) {
          report(at(node), 'engine-purity', `\`${node.getText(sf)}\` in ${pureRoot} (use the seeded Rng / the game clock)`);
        }
      }
      if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) && ts.isStringLiteralLike(node.argumentExpression)) {
        const members = ENGINE_MEMBERS[node.expression.text];
        if (members?.includes(node.argumentExpression.text)) {
          report(at(node), 'engine-purity', `\`${node.getText(sf)}\` in ${pureRoot} (use the seeded Rng / the game clock)`);
        }
      }
      if ((ts.isNewExpression(node) || ts.isCallExpression(node)) && ts.isIdentifier(node.expression) && node.expression.text === 'Date') {
        report(at(node), 'engine-purity', `\`Date\` construction in ${pureRoot} (wall-clock time is not deterministic)`);
      }
    }

    if ((inEngine || inContent) && !inType && ts.isIdentifier(node) && node.text === 'console' && isFreeReference(node)) {
      report(at(node), 'no-console', '`console` in src/engine or src/content (emit a GameEvent or throw instead)');
    }

    const childInType = inType || ts.isTypeNode(node);
    ts.forEachChild(node, (child) => visit(child, childInType));
  };
  visit(sf, false);

  if (inContent) {
    for (const entity of topLevelEntities(sf)) {
      for (const prop of entity.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const name = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : null;
        if (name !== 'id' || !ts.isStringLiteralLike(prop.initializer)) continue;
        const id = prop.initializer.text;
        if (!ID_PREFIX.test(id) && !PLAIN_IDS.has(id)) {
          report(
            at(prop.initializer),
            'content-literals',
            `id '${id}' has no D-044 type prefix (loc_, cr_, item_, q_, echo_, …) and is not a plain id`,
          );
        }
      }
    }
  }

  if (/@ts-(?:ignore|nocheck|expect-error)/.test(text)) {
    for (const comment of collectComments(sf)) {
      const directive = tsDirective(comment.text);
      if (!directive) continue;
      if (directive.kind !== 'expect-error') {
        report(comment.pos, 'no-ts-ignore', `\`@ts-${directive.kind}\` hides type errors; fix the type instead`);
      } else if (!inTests) {
        report(comment.pos, 'no-ts-ignore', '`@ts-expect-error` is allowed only in tests/');
      } else if (!/[A-Za-z]{2,}/.test(directive.rest)) {
        report(comment.pos, 'no-ts-ignore', '`@ts-expect-error` needs a reason after it');
      }
    }
  }

  return { imports, sf };
}

// ---- Whitespace ------------------------------------------------------------------------------------------------------

function lintWhitespace(file: string, text: string, report: (line: number, col: number, message: string) => void): void {
  const crlf = text.indexOf('\r');
  if (crlf >= 0) report(text.slice(0, crlf).split('\n').length, 1, 'CRLF / CR line ending (use LF)');
  const lines = text.split('\n');
  const noTabs = NO_TABS_EXT.test(file);
  lines.forEach((raw, index) => {
    const line = raw.replace(/\r$/, '');
    const trailing = /[ \t]+$/.exec(line);
    if (trailing) report(index + 1, trailing.index + 1, 'trailing whitespace');
    if (noTabs && /^[ ]*\t/.test(line)) report(index + 1, 1, 'tab indentation (indent with 2 spaces)');
  });
  if (text.length > 0 && !text.endsWith('\n')) report(lines.length, 1, 'missing final newline');
  else if (/\n[ \t]*\r?\n$/.test(text)) report(text.replace(/\s+$/, '').split('\n').length + 1, 1, 'blank line(s) at end of file');
}

// ---- Driver ----------------------------------------------------------------------------------------------------------

export function lint(options: LintOptions = {}): { files: number; findings: Finding[] } {
  const root = path.resolve(options.root ?? REPO_ROOT);
  const aliases = options.aliases ?? loadAliases(root);
  const files = listFiles(root);
  const findings: Finding[] = [];
  const graph = new Map<string, { to: string; pos: number; typeOnly: boolean }[]>();
  const sources = new Map<string, ts.SourceFile>();

  for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    lintWhitespace(file, text, (line, col, message) => findings.push({ file, line, col, rule: 'whitespace', message }));
    if (!CODE_EXT.test(file)) continue;

    const pending: { pos: number; rule: RuleName; message: string }[] = [];
    const result = lintCode(file, text, (pos, rule, message) => pending.push({ pos, rule, message }));
    const sf = result.sf;
    sources.set(file, sf);
    const where = (pos: number) => {
      const { line, character } = sf.getLineAndCharacterOfPosition(pos);
      return { line: line + 1, col: character + 1 };
    };
    for (const p of pending) findings.push({ file, ...where(p.pos), rule: p.rule, message: p.message });

    // layer rule (src only); tests and tools may import anything
    const from = layerOf(file);
    if (!from) continue;
    const edges: { to: string; pos: number; typeOnly: boolean }[] = [];
    for (const ref of result.imports) {
      const target = resolveImport(root, file, ref.spec, aliases);
      if (target.kind === 'package') {
        const allowed = PACKAGES[from];
        if (allowed && !allowed.includes(target.name)) {
          const rule: RuleName = from === 'engine' ? 'engine-purity' : 'layers';
          findings.push({ file, ...where(ref.pos), rule, message: `${from} may import only ${allowed.join(', ')} — not '${ref.spec}'` });
        }
        continue;
      }
      const to = layerOf(target.path);
      if (!to) {
        findings.push({ file, ...where(ref.pos), rule: 'layers', message: `src/ must not import '${ref.spec}' (${target.path} is outside the layers)` });
        continue;
      }
      const grants = ALLOW[from];
      const ok =
        grants.includes(to) ||
        (to === 'engine' && grants.includes('engine/types') && target.path.startsWith('src/engine/types/')) ||
        (from === 'app' && target.path === APP_SCENARIOS);
      if (!ok) {
        findings.push({ file, ...where(ref.pos), rule: 'layers', message: `${from} must not import ${to} ('${ref.spec}', PLAN §2.1)` });
      }
      if (from === 'engine' && to === 'engine') edges.push({ to: target.path, pos: ref.pos, typeOnly: ref.typeOnly });
    }
    if (from === 'engine') graph.set(file, edges);
  }

  // import cycles inside src/engine (runtime edges only: `import type` is erased)
  const state = new Map<string, 'active' | 'done'>();
  const stack: string[] = [];
  const reported = new Set<string>();
  const dfs = (file: string) => {
    state.set(file, 'active');
    stack.push(file);
    for (const edge of graph.get(file) ?? []) {
      if (edge.typeOnly) continue;
      const seen = state.get(edge.to);
      if (seen === 'active') {
        const cycle = stack.slice(stack.indexOf(edge.to));
        const key = [...cycle].sort().join('|');
        if (!reported.has(key)) {
          reported.add(key);
          const sf = sources.get(file);
          const { line, character } = sf ? sf.getLineAndCharacterOfPosition(edge.pos) : { line: 0, character: 0 };
          findings.push({
            file,
            line: line + 1,
            col: character + 1,
            rule: 'layers',
            message: `import cycle in src/engine: ${[...cycle, edge.to].join(' → ')}`,
          });
        }
      } else if (seen === undefined && graph.has(edge.to)) {
        dfs(edge.to);
      }
    }
    stack.pop();
    state.set(file, 'done');
  };
  for (const file of graph.keys()) if (!state.has(file)) dfs(file);

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col || a.rule.localeCompare(b.rule));
  return { files: files.length, findings };
}

export function formatFinding(f: Finding): string {
  return `${f.file}:${f.line}:${f.col} ${f.rule} ${f.message}`;
}

export function main(argv: readonly string[], write: (line: string) => void = (line) => process.stdout.write(`${line}\n`)): number {
  const rootIndex = argv.indexOf('--root');
  const root = rootIndex >= 0 ? argv[rootIndex + 1] : undefined;
  const { files, findings } = lint(root ? { root } : {});
  for (const finding of findings) write(formatFinding(finding));
  write(findings.length === 0 ? `lint: ok — ${files} files, ${RULES.length} rules` : `lint: ${findings.length} problem(s) in ${files} files`);
  return findings.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
