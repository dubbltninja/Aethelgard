// In-repo accessibility checks for Playwright (PLAN §8.4, DESIGN §16.7; axe-core is unavailable, D-065).
// Each check has two forms: `...Problems(page)` returns plain-English findings (empty = pass) and `assert...` throws with
// them, so a spec reads `expect(await a11yProblems(page)).toEqual([])` and a failure says what and where.
//
//   accessibleControlProblems / assertAccessibleControls   every control has a role and a name that `getByRole` finds;
//                                                          HP bars are role="meter" with values; logs are named and the
//                                                          page has its polite live region; map nodes are named buttons
//   walkFocus                                              up to 200 Tabs: every tabbable reached once, never on <body>
//                                                          mid-walk, a visible >= 2 px ring on each, no trap
//   modalFocusProblems                                     a dialog traps Tab both ways and Esc returns focus to its opener
//   reducedMotionProblems                                  with prefers-reduced-motion: no animation over 150 ms
//   smallTargets / targetProblems                          visible controls under 44 x 44 px
//   textContrastProblems                                   rendered text against its effective background (not over art)
//   sidewaysOffenders / noHorizontalScroll                 nothing makes the page scroll sideways
//   a11yProblems                                           all of the above for the screen as it stands
import type { Locator, Page } from 'playwright/test';

/** WCAG sizes: a "large" text is 24 px, or 18.66 px bold. */
export const MIN_TARGET = 44;
export const MAX_ANIMATION_MS = 150;
export const MAX_TABS = 200;

// ---- in-page helpers, installed once per page and reused by the evaluate calls below -------------------------------------

interface WalkStop {
  id: number;
  body: boolean;
  inRoot: boolean;
  name: string;
  html: string;
  ring: string | null;
  scroller: boolean;
}
interface PageHelpers {
  expected(rootSel: string | null): { id: number; html: string }[];
  stop(rootSel: string | null): WalkStop;
  startAt(rootSel: string | null): void;
  visible(el: HTMLElement): boolean;
}
type HelperWindow = Window & { __a11y?: PageHelpers };

/** Installs `window.__a11y` (tabbable lists, focus stops, accessible names). Idempotent. */
async function installHelpers(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as HelperWindow & { __a11yIds?: WeakMap<Element, number>; __a11yN?: number };
    const ids = (w.__a11yIds ??= new WeakMap<Element, number>());
    const idOf = (el: Element): number => {
      let v = ids.get(el);
      if (v === undefined) {
        v = (w.__a11yN = (w.__a11yN ?? 0) + 1);
        ids.set(el, v);
      }
      return v;
    };
    /** Rendered and not hidden inside a closed <details> (Chrome keeps boxes there, but only the <summary> can take focus). */
    const visible = (el: HTMLElement): boolean => {
      if (el.getClientRects().length === 0) return false;
      for (let d = el.closest('details'); d !== null; d = d.parentElement?.closest('details') ?? null) {
        const summary = d.querySelector(':scope > summary');
        if (!d.open && !(summary !== null && summary.contains(el))) return false;
      }
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const textOf = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const nameOf = (el: HTMLElement): string => {
      const label = el.getAttribute('aria-label');
      if (label !== null && label.trim() !== '') return label.trim();
      const by = el.getAttribute('aria-labelledby');
      if (by !== null) return by.split(/\s+/).map((id) => textOf(document.getElementById(id))).join(' ').trim();
      return textOf(el) || (el.getAttribute('title') ?? '');
    };
    const sel = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex], [contenteditable="true"]';
    const rootFor = (rootSel: string | null): ParentNode => (rootSel === null ? document : (document.querySelector(rootSel) ?? document));
    const tabbable = (el: HTMLElement): boolean => {
      if ((el as HTMLInputElement).disabled === true) return false;
      if (el.closest('[inert]') !== null) return false;
      const ti = el.getAttribute('tabindex');
      if (ti !== null && parseInt(ti, 10) < 0) return false;
      if (el.tagName === 'SUMMARY' && el.parentElement?.tagName !== 'DETAILS') return false;
      if (el.tagName === 'A' && el.getAttribute('href') === null && ti === null) return false;
      return visible(el);
    };
    const expected = (rootSel: string | null): { id: number; html: string }[] => {
      const root = rootFor(rootSel);
      const all = [...root.querySelectorAll<HTMLElement>(sel)].filter(tabbable);
      // a radio group is one tab stop: its checked radio, else its first
      const seenGroups = new Set<string>();
      const out: HTMLElement[] = [];
      for (const el of all) {
        if (el instanceof HTMLInputElement && el.type === 'radio' && el.name !== '') {
          const group = [...document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(el.name)}"]`)].filter(tabbable);
          if (seenGroups.has(el.name)) continue;
          seenGroups.add(el.name);
          out.push(group.find((r) => r.checked) ?? group[0] ?? el);
        } else out.push(el);
      }
      return out.map((el) => ({ id: idOf(el), html: el.outerHTML.slice(0, 90) }));
    };
    const stop = (rootSel: string | null): WalkStop => {
      const el = document.activeElement;
      if (el === null || el === document.body || el === document.documentElement) {
        return { id: 0, body: true, inRoot: false, name: '', html: '<body>', ring: null, scroller: false };
      }
      const h = el as HTMLElement;
      const cs = getComputedStyle(h);
      const width = parseFloat(cs.outlineWidth);
      const ringOk = cs.outlineStyle !== 'none' && width >= 2 && !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(cs.outlineColor);
      const root = rootSel === null ? document : document.querySelector(rootSel);
      return {
        id: idOf(h),
        body: false,
        inRoot: root === null || root === document || (root as Element).contains(h),
        name: nameOf(h),
        html: h.outerHTML.slice(0, 90),
        ring: ringOk ? null : `outline ${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
        scroller: h.scrollHeight > h.clientHeight + 1 && !h.matches(sel.replace(', [tabindex]', '')) && !h.hasAttribute('tabindex'),
      };
    };
    /** Puts the sequential-focus starting point at the top of `rootSel` (or the document), so the next Tab is its first stop. */
    const startAt = (rootSel: string | null): void => {
      const start = (rootSel === null ? null : document.querySelector<HTMLElement>(rootSel)) ?? document.body;
      const had = start.getAttribute('tabindex');
      start.setAttribute('tabindex', '-1');
      start.focus({ preventScroll: true });
      if (had === null) start.removeAttribute('tabindex');
      else start.setAttribute('tabindex', had);
      if (document.activeElement === start) (document.activeElement as HTMLElement).blur();
      window.scrollTo(0, 0);
    };
    w.__a11y = { expected, stop, startAt, visible };
  });
}

// ---- names and roles --------------------------------------------------------------------------------------------------

interface ControlInfo {
  role: string | null;
  name: string;
  html: string;
}

/**
 * Every visible control, its role and its accessible name as the browser computes them from the DOM (aria-labelledby,
 * aria-label, a label, the text content without aria-hidden parts, alt, title). The pairs are then looked up with
 * `getByRole`, so a name the DOM approximation finds but Playwright does not is a finding too.
 */
export async function accessibleControlProblems(page: Page): Promise<string[]> {
  await installHelpers(page);
  const found = await page.evaluate(() => {
    const visible = (el: HTMLElement): boolean => (window as unknown as HelperWindow).__a11y!.visible(el);
    const out: { role: string | null; name: string; html: string; hiddenParent: boolean }[] = [];
    const problems: string[] = [];
    const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
    const contentName = (el: Element, skip?: Element): string => {
      let text = '';
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? '';
        else if (node instanceof HTMLElement) {
          if (node === skip || node.getAttribute('aria-hidden') === 'true' || node.hidden) continue;
          const cs = getComputedStyle(node);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          if (node.tagName === 'IMG') text += ` ${node.getAttribute('alt') ?? ''} `;
          else if (node.getAttribute('aria-label') !== null && node.getAttribute('role') !== null) text += ` ${node.getAttribute('aria-label')} `;
          else text += ` ${contentName(node, skip)} `;
        } else if (node instanceof SVGElement) {
          const t = node.querySelector('title');
          if (node.getAttribute('aria-hidden') !== 'true' && t !== null) text += ` ${t.textContent ?? ''} `;
        }
      }
      return norm(text);
    };
    const nameOf = (el: HTMLElement): string => {
      const by = el.getAttribute('aria-labelledby');
      if (by !== null) {
        const n = norm(
          by
            .split(/\s+/)
            .map((id) => {
              const t = document.getElementById(id);
              return t === null ? '' : (t.getAttribute('aria-label') ?? contentName(t));
            })
            .join(' '),
        );
        if (n !== '') return n;
      }
      const label = el.getAttribute('aria-label');
      if (label !== null && norm(label) !== '') return norm(label);
      const labels = (el as HTMLInputElement).labels;
      if (labels !== undefined && labels !== null && labels.length > 0) {
        const n = norm([...labels].map((l) => contentName(l, el)).join(' '));
        if (n !== '') return n;
      }
      const t = el.tagName;
      if (t === 'INPUT' && ['button', 'submit', 'reset'].includes((el as HTMLInputElement).type)) return (el as HTMLInputElement).value;
      const own = ['BUTTON', 'A', 'SUMMARY'].includes(t) || el.getAttribute('role') !== null ? contentName(el) : '';
      return own !== '' ? own : (el.getAttribute('title') ?? '');
    };
    const roleOf = (el: HTMLElement): string | null => {
      const explicit = el.getAttribute('role');
      if (explicit !== null && explicit !== '') return explicit.split(/\s+/)[0] as string;
      switch (el.tagName) {
        case 'BUTTON':
          return 'button';
        case 'A':
          return el.getAttribute('href') !== null ? 'link' : null;
        case 'SELECT':
          return (el as HTMLSelectElement).multiple || (el as HTMLSelectElement).size > 1 ? 'listbox' : 'combobox';
        case 'TEXTAREA':
          return 'textbox';
        case 'SUMMARY':
          return null; // no ARIA role in Playwright's tree; named, not looked up
        case 'INPUT': {
          const type = (el as HTMLInputElement).type;
          if (type === 'checkbox') return 'checkbox';
          if (type === 'radio') return 'radio';
          if (type === 'range') return 'slider';
          if (type === 'number') return 'spinbutton';
          if (type === 'search') return 'searchbox';
          if (['button', 'submit', 'reset', 'image'].includes(type)) return 'button';
          if (type === 'file') return 'button';
          return 'textbox';
        }
        default:
          return null;
      }
    };
    const controls = [...document.querySelectorAll<HTMLElement>('a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="radio"], [role="tab"], [role="checkbox"], [role="slider"], [role="switch"], [role="menuitem"], [tabindex]')];
    for (const el of controls) {
      if (!visible(el)) continue;
      const role = roleOf(el);
      const html = el.outerHTML.replace(/\s+/g, ' ').slice(0, 90);
      if (el.closest('[aria-hidden="true"]') !== null) {
        problems.push(`focusable inside aria-hidden: ${html}`);
        continue;
      }
      if (role === null && el.tagName !== 'SUMMARY') {
        if (el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1') problems.push(`tabindex on an element with no role: ${html}`);
        continue;
      }
      out.push({ role, name: nameOf(el), html, hiddenParent: false });
    }
    // roles that must carry values
    for (const el of document.querySelectorAll<HTMLElement>('[role="meter"], [role="progressbar"], [role="slider"]')) {
      if (!visible(el)) continue;
      const html = el.outerHTML.replace(/\s+/g, ' ').slice(0, 90);
      const num = (a: string): boolean => el.getAttribute(a) !== null && Number.isFinite(Number(el.getAttribute(a)));
      if (!num('aria-valuenow') || !num('aria-valuemin') || !num('aria-valuemax')) problems.push(`${el.getAttribute('role')} without numeric aria-valuenow/min/max: ${html}`);
      else if (Number(el.getAttribute('aria-valuenow')) > Number(el.getAttribute('aria-valuemax')) || Number(el.getAttribute('aria-valuenow')) < Number(el.getAttribute('aria-valuemin'))) problems.push(`meter value out of range: ${html}`);
      if (nameOf(el) === '') problems.push(`${el.getAttribute('role')} without a name: ${html}`);
    }
    for (const el of document.querySelectorAll<HTMLElement>('[class*="hp-bar"], [class*="resolve"]')) {
      if (el.getClientRects().length === 0 || !/(^|\s)(hp-bar|resolve)(\s|$)/.test(el.className)) continue;
      if (el.getAttribute('role') !== 'meter') problems.push(`a bar that is not role="meter": ${el.outerHTML.slice(0, 80)}`);
    }
    // logs and the live region
    const status = document.querySelectorAll('[data-testid="live-region"]');
    if (status.length !== 1 || status[0]?.getAttribute('aria-live') !== 'polite' || status[0]?.getAttribute('role') !== 'status') problems.push(`expected one polite role="status" live region, found ${status.length}`);
    for (const el of document.querySelectorAll<HTMLElement>('[role="log"]')) {
      if (el.getClientRects().length > 0 && nameOf(el) === '') problems.push(`role="log" without a name: ${el.outerHTML.slice(0, 80)}`);
    }
    // map nodes: buttons with names
    for (const el of document.querySelectorAll<HTMLElement>('.map-node')) {
      if (el.getClientRects().length === 0) continue;
      const name = nameOf(el);
      if (el.tagName !== 'BUTTON' || name === '') problems.push(`map node is not a named button: ${el.outerHTML.replace(/\s+/g, ' ').slice(0, 80)}`);
    }
    // landmarks, dialogs, images, ids, language, title
    if (document.querySelectorAll('main, [role="main"]').length !== 1) problems.push(`expected exactly one main landmark, found ${document.querySelectorAll('main, [role="main"]').length}`);
    if (document.title.trim() === '') problems.push('the page has no title');
    if (!document.documentElement.lang) problems.push('<html> has no lang');
    for (const el of document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')) {
      if (el.getAttribute('aria-modal') !== 'true') problems.push(`dialog without aria-modal: ${el.outerHTML.slice(0, 70)}`);
      if (nameOf(el) === '') problems.push(`dialog without a name: ${el.outerHTML.slice(0, 70)}`);
    }
    for (const el of document.querySelectorAll<HTMLImageElement>('img')) {
      if (el.getClientRects().length > 0 && el.getAttribute('alt') === null && el.getAttribute('aria-hidden') !== 'true' && el.getAttribute('role') !== 'presentation') problems.push(`<img> without alt: ${el.outerHTML.slice(0, 80)}`);
    }
    const seen = new Map<string, number>();
    for (const el of document.querySelectorAll('[id]')) seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
    for (const [id, n] of seen) if (n > 1) problems.push(`duplicate id "${id}" x${n}`);
    return { out, problems };
  });

  const problems = [...found.problems];
  const checked = new Set<string>();
  for (const c of found.out as ControlInfo[]) {
    if (c.name === '') {
      problems.push(`${c.role ?? 'summary'} without an accessible name: ${c.html}`);
      continue;
    }
    if (c.role === null) continue;
    const key = `${c.role}\u0000${c.name}`;
    if (checked.has(key)) continue;
    checked.add(key);
    const role = c.role as Parameters<Page['getByRole']>[0];
    // an embedded select or field adds its value to its label's text, so a substring match is accepted when the exact one finds nothing
    const found1 = (await page.getByRole(role, { name: c.name, exact: true }).count()) + (await page.getByRole(role, { name: c.name }).count());
    if (found1 === 0) {
      problems.push(`getByRole('${c.role}', { name: ${JSON.stringify(c.name)} }) finds nothing: ${c.html}`);
    }
  }
  return problems;
}

export async function assertAccessibleControls(page: Page): Promise<void> {
  const problems = await accessibleControlProblems(page);
  if (problems.length > 0) throw new Error(`accessible controls:\n  ${problems.join('\n  ')}`);
}

// ---- focus ---------------------------------------------------------------------------------------------------------------

export interface WalkResult {
  stops: number;
  problems: string[];
}

/**
 * Tabs through the page (or `root`, a dialog's selector) from its top, up to 200 presses. Passes when every tabbable
 * element is reached exactly once before focus wraps, focus is never on <body> mid-walk, never leaves `root`, and every
 * stop shows a focus ring (computed `outline` >= 2 px, not transparent).
 */
export async function walkFocus(page: Page, opts: { root?: string; max?: number } = {}): Promise<WalkResult> {
  const root = opts.root ?? null;
  const max = opts.max ?? MAX_TABS;
  await installHelpers(page);
  const expected = await page.evaluate((r) => (window as unknown as HelperWindow).__a11y!.expected(r), root);
  await page.evaluate((r) => (window as unknown as HelperWindow).__a11y!.startAt(r), root);
  const problems: string[] = [];
  const reached = new Set<number>();
  const want = new Set(expected.map((e) => e.id));
  let wrapped = false;
  let presses = 0;
  for (; presses < max; presses++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate((r) => (window as unknown as HelperWindow).__a11y!.stop(r), root);
    if (stop.body) {
      if (reached.size < want.size && !(reached.size === 0 && want.size === 0)) {
        problems.push(`focus fell to <body> after ${reached.size} of ${want.size} stops`);
      }
      wrapped = true;
      break;
    }
    if (!stop.inRoot) {
      problems.push(`focus left the dialog: ${stop.html}`);
      break;
    }
    if (reached.has(stop.id)) {
      // back where it started: the wrap-around of a page with no <body> stop
      wrapped = true;
      if (reached.size < want.size) problems.push(`focus cycled after ${reached.size} of ${want.size} stops (a trap?) at ${stop.html}`);
      break;
    }
    reached.add(stop.id);
    if (stop.ring !== null) problems.push(`no visible focus ring (${stop.ring}): ${stop.html}`);
    if (!want.has(stop.id) && !stop.scroller) problems.push(`focus reached an element that is not a listed tab stop: ${stop.html}`);
  }
  if (!wrapped) problems.push(`focus never wrapped within ${max} presses (${reached.size} stops of ${want.size})`);
  for (const e of expected) if (!reached.has(e.id)) problems.push(`never reached by Tab: ${e.html}`);
  return { stops: reached.size, problems: [...new Set(problems)] };
}

/**
 * A dialog open over the page: Tab and Shift+Tab never leave it, and Esc closes it and puts focus back on `opener`.
 * `close` defaults to Escape; the dialog is `dialog` (a locator).
 */
export async function modalFocusProblems(page: Page, dialog: Locator, opener: Locator | null, opts: { close?: () => Promise<void> } = {}): Promise<string[]> {
  const problems: string[] = [];
  const stops = await dialog.evaluate((el) => {
    const sel = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
    return [...el.querySelectorAll<HTMLElement>(sel)].filter((e) => e.getClientRects().length > 0).length;
  });
  const inside = (): Promise<boolean> => dialog.evaluate((el) => el.contains(document.activeElement));
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let i = 0; i < stops + 3; i++) {
      await page.keyboard.press(key);
      if (!(await inside())) {
        problems.push(`${key} left the dialog after ${i + 1} presses`);
        break;
      }
    }
  }
  if (opts.close) await opts.close();
  else await page.keyboard.press('Escape');
  if ((await dialog.count()) > 0) problems.push('Esc did not close the dialog');
  else if (opener !== null) {
    const back = await opener.evaluate((el) => el === document.activeElement).catch(() => false);
    if (!back) problems.push(`focus did not return to the opener (on ${await page.evaluate(() => (document.activeElement as HTMLElement | null)?.outerHTML.slice(0, 70) ?? 'nothing')})`);
  }
  return problems;
}

// ---- motion --------------------------------------------------------------------------------------------------------------

/**
 * With `prefers-reduced-motion: reduce` emulated, `document.getAnimations()` holds nothing longer than 150 ms (delay
 * and duration together) and nothing that runs forever; SMIL `<animate>` elements count too.
 */
export async function reducedMotionProblems(page: Page): Promise<string[]> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(50);
  return page.evaluate((limit) => {
    const out: string[] = [];
    for (const a of document.getAnimations()) {
      const end = a.effect?.getComputedTiming().endTime ?? 0;
      if (typeof end === 'number' && end > limit) {
        const target = (a.effect as KeyframeEffect | null)?.target as Element | null | undefined;
        const name = (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? '';
        out.push(`${Number.isFinite(end) ? `${Math.round(end)} ms` : 'endless'} animation ${name} on ${target?.tagName.toLowerCase() ?? '?'}.${String(target?.getAttribute('class') ?? '').slice(0, 40)}`);
      }
    }
    for (const el of document.querySelectorAll('animate, animateTransform, animateMotion, set')) out.push(`SMIL <${el.tagName.toLowerCase()}> in ${el.parentElement?.tagName.toLowerCase() ?? '?'}`);
    return out;
  }, MAX_ANIMATION_MS);
}

// ---- targets and layout --------------------------------------------------------------------------------------------------

/** Visible interactive elements smaller than `min` x `min` CSS px (a radio or checkbox is measured by its label). */
export async function smallTargets(page: Page, min: number = MIN_TARGET): Promise<string[]> {
  await installHelpers(page);
  return page.evaluate((m) => {
    const sel = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="radio"], [role="tab"]';
    return [...document.querySelectorAll<HTMLElement>(sel)]
      .filter((el) => (window as unknown as HelperWindow).__a11y!.visible(el) && !el.classList.contains('skip-link') && !el.closest('.sr-only'))
      .map((el) => ({ el, box: (el.closest('label') ?? el).getBoundingClientRect() }))
      .filter(({ box }) => box.width < m - 0.5 || box.height < m - 0.5)
      .map(({ el, box }) => `${el.outerHTML.replace(/\s+/g, ' ').slice(0, 70)} ${Math.round(box.width)}×${Math.round(box.height)}`);
  }, min);
}

/** Empty when the page does not scroll sideways; else the elements sticking out past the right edge. */
export async function sidewaysOffenders(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= width) return [];
    const out = [`scrollWidth ${document.documentElement.scrollWidth} > ${width}`];
    const sticking = [...document.querySelectorAll<HTMLElement>('body *')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.right > width + 1;
    });
    for (const el of sticking.filter((e) => !sticking.some((o) => o !== e && e.contains(o)))) {
      out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} right=${Math.round(el.getBoundingClientRect().right)} text="${(el.textContent ?? '').trim().slice(0, 30)}"`);
    }
    return out.slice(0, 8);
  });
}

export async function noHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

// ---- rendered text contrast ----------------------------------------------------------------------------------------------

/**
 * Rendered text against the colour behind it: for each visible element with text of its own, the computed `color`
 * (with opacity) over the stack of ancestor backgrounds; behind a gradient it must pass on every colour stop. Text with a
 * painted image (`url()`) behind it is skipped (the frames keep text off paintings, D-125; the count is returned). Disabled controls are exempt (WCAG
 * 1.4.3). 4.5:1, or 3:1 for large text; 7:1 and 4.5:1 in high contrast.
 */
export async function textContrastProblems(page: Page): Promise<{ problems: string[]; skippedOverArt: number; checked: number }> {
  await installHelpers(page);
  return page.evaluate(() => {
    // a toast fading in or a panel sliding up is mid-way between colours; settle every finite animation first
    for (const a of document.getAnimations()) {
      const end = a.effect?.getComputedTiming().endTime;
      if (typeof end === 'number' && Number.isFinite(end)) a.finish();
    }
    const visible = (el: HTMLElement): boolean => (window as unknown as HelperWindow).__a11y!.visible(el);
    type C = [number, number, number, number];
    const parse = (v: string): C => {
      const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/.exec(v);
      if (!m) {
        // color(srgb r g b / a) from color-mix
        const s = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\)/.exec(v);
        if (s) return [Number(s[1]) * 255, Number(s[2]) * 255, Number(s[3]) * 255, s[4] === undefined ? 1 : s[4].endsWith('%') ? parseFloat(s[4]) / 100 : Number(s[4])];
        return [0, 0, 0, 0];
      }
      const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4]);
      return [Number(m[1]), Number(m[2]), Number(m[3]), a];
    };
    const over = (top: C, under: C): C => {
      const a = top[3];
      return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1];
    };
    const lin = (c: number): number => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const lum = (c: C): number => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    const ratio = (a: C, b: C): number => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
      return (hi + 0.05) / (lo + 0.05);
    };
    const high = document.documentElement.getAttribute('data-theme') === 'high-contrast';
    const problems: string[] = [];
    let skipped = 0;
    let checked = 0;
    const seen = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = (node.textContent ?? '').trim();
      const el = node.parentElement;
      if (text === '' || el === null || el.closest('.sr-only, script, style, [aria-hidden="true"]') !== null) continue;
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      if (el.closest('button:disabled, input:disabled, [aria-disabled="true"], fieldset:disabled') !== null) continue;
      // the background stack, nearest first, until an opaque colour: solid fills and gradients (a gradient's colour stops
      // are the extremes of what it paints, so the text is checked against each; an image with url() is art and is skipped)
      let fgAlpha = 1;
      let art = false;
      const layers: ({ solid: C } | { stops: C[] })[] = [];
      for (let cur: HTMLElement | null = el; cur !== null; cur = cur.parentElement) {
        const s = getComputedStyle(cur);
        fgAlpha *= Number(s.opacity);
        if (s.backgroundImage.includes('url(')) {
          art = true;
          break;
        }
        if (s.backgroundImage !== 'none') {
          const stops = [...s.backgroundImage.matchAll(/color\(srgb [^)]*\)|rgba?\([^)]*\)/g)].map((m) => parse(m[0])).filter((c) => c[3] > 0);
          if (stops.length > 0) layers.push({ stops });
        }
        const bg = parse(s.backgroundColor);
        if (bg[3] > 0) layers.push({ solid: bg });
        if (bg[3] >= 1) break;
      }
      if (art) {
        skipped++;
        continue;
      }
      let first: C = [0, 0, 0, 1]; // an unpainted page is the browser's canvas, which the theme sets dark
      const canvas = parse(getComputedStyle(document.documentElement).backgroundColor);
      if (canvas[3] > 0) first = over(canvas, first);
      let bases: C[] = [first];
      for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i] as { solid: C } | { stops: C[] };
        bases = 'solid' in layer ? bases.map((b) => over(layer.solid, b)) : [...bases, ...bases.flatMap((b) => layer.stops.map((stop) => over(stop, b)))];
      }
      const fg0 = parse(cs.color);
      // the worst case: the backdrop that gives the lowest contrast
      let base = bases[0] as C;
      let fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * fgAlpha], base);
      for (const b of bases) {
        const f = over([fg0[0], fg0[1], fg0[2], fg0[3] * fgAlpha], b);
        if (ratio(f, b) < ratio(fg, base)) {
          base = b;
          fg = f;
        }
      }
      const px = parseFloat(cs.fontSize);
      const bold = parseInt(cs.fontWeight, 10) >= 700;
      const large = px >= 24 || (px >= 18.66 && bold);
      const min = high ? (large ? 4.5 : 7) : large ? 3 : 4.5;
      const r = ratio(fg, base);
      checked++;
      if (r < min) {
        const key = `${el.tagName}.${el.className}|${cs.color}|${text.slice(0, 20)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        problems.push(`${r.toFixed(2)}:1 < ${min} for "${text.slice(0, 40)}" in ${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '').slice(0, 40)} (${cs.color} on rgb(${base.slice(0, 3).map(Math.round).join(' ')}))`);
      }
    }
    return { problems, skippedOverArt: skipped, checked };
  });
}

// ---- everything for one screen --------------------------------------------------------------------------------------------

export interface A11yOptions {
  /** The mobile project: the 44 px targets are required (they are on desktop too, but this names the intent). */
  mobile?: boolean;
  /** Selector of the dialog to walk instead of the whole page. */
  root?: string;
  /** Skip the Tab walk (a screen whose walk a spec does separately). */
  noWalk?: boolean;
  /** Skip the text contrast scan. */
  noContrast?: boolean;
}

/** Every check above against the screen as it stands; findings are prefixed with the check's name. */
export async function a11yProblems(page: Page, opts: A11yOptions = {}): Promise<string[]> {
  const out: string[] = [];
  const tag = (name: string, list: readonly string[]): void => {
    for (const p of list) out.push(`${name}: ${p}`);
  };
  tag('controls', await accessibleControlProblems(page));
  if (opts.noWalk !== true) {
    const walk = await walkFocus(page, opts.root === undefined ? {} : { root: opts.root });
    tag('focus', walk.problems);
  }
  tag('targets', await smallTargets(page));
  tag('sideways', await sidewaysOffenders(page));
  if (opts.noContrast !== true) tag('contrast', (await textContrastProblems(page)).problems);
  return out;
}
