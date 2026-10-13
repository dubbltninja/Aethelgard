// React 19 type surface used by this repo (PLAN §3.7, D-065).
//
// `@types/react` cannot be installed (the npm registry is blocked), so the repo declares exactly the React API it
// uses — nothing more. Adding an API means adding its declaration here in the same commit.
// `any` is allowed only under src/types/ (lint rule no-explicit-any); keep it to signatures that genuinely need it.
// tests/unit/tools/types.test.ts holds @ts-expect-error cases that keep this shim strict.

/** The DOM's own event types, named before the React module shadows `MouseEvent` & co. */
declare namespace ReactShimNative {
  type Event = globalThis.Event;
  type UIEvent = globalThis.UIEvent;
  type MouseEvent = globalThis.MouseEvent;
  type PointerEvent = globalThis.PointerEvent;
  type KeyboardEvent = globalThis.KeyboardEvent;
  type FocusEvent = globalThis.FocusEvent;
  type TouchEvent = globalThis.TouchEvent;
  type WheelEvent = globalThis.WheelEvent;
  type AnimationEvent = globalThis.AnimationEvent;
  type TransitionEvent = globalThis.TransitionEvent;
  type InputEvent = globalThis.InputEvent;
  type SubmitEvent = globalThis.SubmitEvent;
}

declare module 'react' {
  // ---- Elements and nodes -------------------------------------------------------------------------------------
  export type Key = string | number | bigint;
  export type JSXElementConstructor<P> = (props: P) => ReactNode;
  export interface ReactElement<P = unknown, T = string | JSXElementConstructor<any>> {
    type: T;
    props: P;
    key: string | null;
  }
  export type ReactNode =
    | ReactElement
    | string
    | number
    | bigint
    | boolean
    | null
    | undefined
    | Iterable<ReactNode>
    | Promise<ReactNode>;
  export type PropsWithChildren<P = unknown> = P & { children?: ReactNode };
  /** `key` on any element (JSX.IntrinsicAttributes covers components; intrinsic elements get it from here). */
  export interface Attributes {
    key?: Key | null | undefined;
  }

  export const Fragment: (props: { children?: ReactNode }) => ReactNode;
  export const StrictMode: (props: { children?: ReactNode }) => ReactNode;

  // ---- Refs ---------------------------------------------------------------------------------------------------
  export interface RefObject<T> {
    current: T;
  }
  /** React 19: a ref callback may return a cleanup function. */
  export type RefCallback<T> = (instance: T | null) => void | (() => void);
  export type Ref<T> = RefCallback<T> | RefObject<T | null> | null;

  // ---- Hooks --------------------------------------------------------------------------------------------------
  export type SetStateAction<S> = S | ((prev: S) => S);
  export type Dispatch<A> = (value: A) => void;
  export type DependencyList = readonly unknown[];
  export type EffectCallback = () => void | (() => void);
  export type Reducer<S, A> = (state: S, action: A) => S;

  export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
  export function useReducer<S, A>(reducer: Reducer<S, A>, initialState: S): [S, Dispatch<A>];
  export function useReducer<S, A, I>(reducer: Reducer<S, A>, initialArg: I, init: (arg: I) => S): [S, Dispatch<A>];
  export function useEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useMemo<T>(factory: () => T, deps: DependencyList): T;
  export function useCallback<T extends (...args: any[]) => unknown>(callback: T, deps: DependencyList): T;
  export function useRef<T>(initialValue: T): RefObject<T>;
  export function useRef<T>(initialValue: T | null): RefObject<T | null>;
  export function useRef<T>(initialValue: T | undefined): RefObject<T | undefined>;
  export function useId(): string;
  export function useSyncExternalStore<T>(
    subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => T,
    getServerSnapshot?: () => T,
  ): T;

  // ---- Context ------------------------------------------------------------------------------------------------
  export interface ProviderProps<T> {
    value: T;
    children?: ReactNode;
  }
  export interface Provider<T> {
    (props: ProviderProps<T>): ReactNode;
  }
  export interface Consumer<T> {
    (props: { children: (value: T) => ReactNode }): ReactNode;
  }
  /** React 19 renders `<Ctx value={…}>` directly, so a Context is itself a provider component. */
  export interface Context<T> extends Provider<T> {
    Provider: Provider<T>;
    Consumer: Consumer<T>;
    displayName?: string | undefined;
  }
  export function createContext<T>(defaultValue: T): Context<T>;
  export function useContext<T>(context: Context<T>): T;

  export function memo<P extends object>(
    component: (props: P) => ReactNode,
    propsAreEqual?: (prev: Readonly<P>, next: Readonly<P>) => boolean,
  ): (props: P) => ReactNode;

  // ---- Styles -------------------------------------------------------------------------------------------------
  type CSSPropertyName = {
    [K in keyof CSSStyleDeclaration]: CSSStyleDeclaration[K] extends string ? (K extends string ? K : never) : never;
  }[keyof CSSStyleDeclaration];
  /** Known CSS properties (camelCase) plus custom properties (`--token`). */
  export type CSSProperties = { [K in CSSPropertyName]?: string | number | undefined } & {
    [custom: `--${string}`]: string | number | undefined;
  };

  // ---- Events -------------------------------------------------------------------------------------------------
  export interface SyntheticEvent<T = Element, E = ReactShimNative.Event> {
    nativeEvent: E;
    currentTarget: T;
    target: EventTarget;
    bubbles: boolean;
    cancelable: boolean;
    defaultPrevented: boolean;
    eventPhase: number;
    isTrusted: boolean;
    timeStamp: number;
    type: string;
    preventDefault(): void;
    isDefaultPrevented(): boolean;
    stopPropagation(): void;
    isPropagationStopped(): boolean;
  }
  interface ModifierState {
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    getModifierState(key: string): boolean;
  }
  export interface UIEvent<T = Element, E = ReactShimNative.UIEvent> extends SyntheticEvent<T, E> {
    detail: number;
  }
  export interface MouseEvent<T = Element, E = ReactShimNative.MouseEvent> extends UIEvent<T, E>, ModifierState {
    button: number;
    buttons: number;
    clientX: number;
    clientY: number;
    pageX: number;
    pageY: number;
    screenX: number;
    screenY: number;
    movementX: number;
    movementY: number;
    relatedTarget: EventTarget | null;
  }
  export interface PointerEvent<T = Element> extends MouseEvent<T, ReactShimNative.PointerEvent> {
    pointerId: number;
    pointerType: 'mouse' | 'pen' | 'touch';
    pressure: number;
    width: number;
    height: number;
    isPrimary: boolean;
  }
  export interface WheelEvent<T = Element> extends MouseEvent<T, ReactShimNative.WheelEvent> {
    deltaX: number;
    deltaY: number;
    deltaZ: number;
    deltaMode: number;
  }
  export interface KeyboardEvent<T = Element> extends UIEvent<T, ReactShimNative.KeyboardEvent>, ModifierState {
    key: string;
    code: string;
    location: number;
    repeat: boolean;
  }
  export interface FocusEvent<T = Element, R = Element> extends UIEvent<T, ReactShimNative.FocusEvent> {
    relatedTarget: (EventTarget & R) | null;
    target: EventTarget & T;
  }
  export interface TouchEvent<T = Element> extends UIEvent<T, ReactShimNative.TouchEvent>, ModifierState {
    changedTouches: TouchList;
    targetTouches: TouchList;
    touches: TouchList;
  }
  export interface ChangeEvent<T = Element> extends SyntheticEvent<T> {
    target: EventTarget & T;
  }
  export interface FormEvent<T = Element> extends SyntheticEvent<T> {}
  export interface AnimationEvent<T = Element> extends SyntheticEvent<T, ReactShimNative.AnimationEvent> {
    animationName: string;
    elapsedTime: number;
    pseudoElement: string;
  }
  export interface TransitionEvent<T = Element> extends SyntheticEvent<T, ReactShimNative.TransitionEvent> {
    propertyName: string;
    elapsedTime: number;
    pseudoElement: string;
  }

  export type EventHandler<E> = (event: E) => void;
  export type ReactEventHandler<T = Element> = EventHandler<SyntheticEvent<T>>;
  export type MouseEventHandler<T = Element> = EventHandler<MouseEvent<T>>;
  export type PointerEventHandler<T = Element> = EventHandler<PointerEvent<T>>;
  export type WheelEventHandler<T = Element> = EventHandler<WheelEvent<T>>;
  export type KeyboardEventHandler<T = Element> = EventHandler<KeyboardEvent<T>>;
  export type FocusEventHandler<T = Element> = EventHandler<FocusEvent<T>>;
  export type TouchEventHandler<T = Element> = EventHandler<TouchEvent<T>>;
  export type ChangeEventHandler<T = Element> = EventHandler<ChangeEvent<T>>;
  export type FormEventHandler<T = Element> = EventHandler<FormEvent<T>>;
  export type AnimationEventHandler<T = Element> = EventHandler<AnimationEvent<T>>;
  export type TransitionEventHandler<T = Element> = EventHandler<TransitionEvent<T>>;
  export type UIEventHandler<T = Element> = EventHandler<UIEvent<T>>;

  // ---- Attributes ---------------------------------------------------------------------------------------------
  type Booleanish = boolean | 'true' | 'false';
  export interface AriaAttributes {
    'aria-activedescendant'?: string | undefined;
    'aria-atomic'?: Booleanish | undefined;
    'aria-autocomplete'?: 'none' | 'inline' | 'list' | 'both' | undefined;
    'aria-busy'?: Booleanish | undefined;
    'aria-checked'?: boolean | 'false' | 'mixed' | 'true' | undefined;
    'aria-colcount'?: number | undefined;
    'aria-colindex'?: number | undefined;
    'aria-controls'?: string | undefined;
    'aria-current'?: boolean | 'false' | 'true' | 'page' | 'step' | 'location' | 'date' | 'time' | undefined;
    'aria-describedby'?: string | undefined;
    'aria-description'?: string | undefined;
    'aria-details'?: string | undefined;
    'aria-disabled'?: Booleanish | undefined;
    'aria-errormessage'?: string | undefined;
    'aria-expanded'?: Booleanish | undefined;
    'aria-haspopup'?: boolean | 'false' | 'true' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog' | undefined;
    'aria-hidden'?: Booleanish | undefined;
    'aria-invalid'?: boolean | 'false' | 'true' | 'grammar' | 'spelling' | undefined;
    'aria-keyshortcuts'?: string | undefined;
    'aria-label'?: string | undefined;
    'aria-labelledby'?: string | undefined;
    'aria-level'?: number | undefined;
    'aria-live'?: 'off' | 'assertive' | 'polite' | undefined;
    'aria-modal'?: Booleanish | undefined;
    'aria-multiselectable'?: Booleanish | undefined;
    'aria-orientation'?: 'horizontal' | 'vertical' | undefined;
    'aria-owns'?: string | undefined;
    'aria-placeholder'?: string | undefined;
    'aria-posinset'?: number | undefined;
    'aria-pressed'?: boolean | 'false' | 'mixed' | 'true' | undefined;
    'aria-readonly'?: Booleanish | undefined;
    'aria-relevant'?: string | undefined;
    'aria-required'?: Booleanish | undefined;
    'aria-roledescription'?: string | undefined;
    'aria-rowcount'?: number | undefined;
    'aria-rowindex'?: number | undefined;
    'aria-selected'?: Booleanish | undefined;
    'aria-setsize'?: number | undefined;
    'aria-sort'?: 'none' | 'ascending' | 'descending' | 'other' | undefined;
    'aria-valuemax'?: number | undefined;
    'aria-valuemin'?: number | undefined;
    'aria-valuenow'?: number | undefined;
    'aria-valuetext'?: string | undefined;
  }

  export interface DOMAttributes<T> {
    children?: ReactNode;
    dangerouslySetInnerHTML?: { __html: string } | undefined;
    onClick?: MouseEventHandler<T> | undefined;
    onDoubleClick?: MouseEventHandler<T> | undefined;
    onContextMenu?: MouseEventHandler<T> | undefined;
    onMouseDown?: MouseEventHandler<T> | undefined;
    onMouseUp?: MouseEventHandler<T> | undefined;
    onMouseEnter?: MouseEventHandler<T> | undefined;
    onMouseLeave?: MouseEventHandler<T> | undefined;
    onMouseMove?: MouseEventHandler<T> | undefined;
    onPointerDown?: PointerEventHandler<T> | undefined;
    onPointerUp?: PointerEventHandler<T> | undefined;
    onPointerMove?: PointerEventHandler<T> | undefined;
    onPointerEnter?: PointerEventHandler<T> | undefined;
    onPointerLeave?: PointerEventHandler<T> | undefined;
    onPointerCancel?: PointerEventHandler<T> | undefined;
    onWheel?: WheelEventHandler<T> | undefined;
    onKeyDown?: KeyboardEventHandler<T> | undefined;
    onKeyUp?: KeyboardEventHandler<T> | undefined;
    onFocus?: FocusEventHandler<T> | undefined;
    onBlur?: FocusEventHandler<T> | undefined;
    onTouchStart?: TouchEventHandler<T> | undefined;
    onTouchMove?: TouchEventHandler<T> | undefined;
    onTouchEnd?: TouchEventHandler<T> | undefined;
    onTouchCancel?: TouchEventHandler<T> | undefined;
    onChange?: FormEventHandler<T> | undefined;
    onInput?: FormEventHandler<T> | undefined;
    onSubmit?: FormEventHandler<T> | undefined;
    onReset?: FormEventHandler<T> | undefined;
    onScroll?: UIEventHandler<T> | undefined;
    onLoad?: ReactEventHandler<T> | undefined;
    onError?: ReactEventHandler<T> | undefined;
    onAnimationStart?: AnimationEventHandler<T> | undefined;
    onAnimationEnd?: AnimationEventHandler<T> | undefined;
    onTransitionEnd?: TransitionEventHandler<T> | undefined;
  }

  /** `data-*` attributes. */
  export type DataAttributes = { [data: `data-${string}`]: string | number | boolean | undefined };

  export interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    ref?: Ref<T> | undefined;
    accessKey?: string | undefined;
    autoFocus?: boolean | undefined;
    className?: string | undefined;
    contentEditable?: Booleanish | 'plaintext-only' | undefined;
    dir?: 'ltr' | 'rtl' | 'auto' | undefined;
    draggable?: Booleanish | undefined;
    hidden?: boolean | undefined;
    id?: string | undefined;
    inert?: boolean | undefined;
    inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search' | undefined;
    lang?: string | undefined;
    role?: string | undefined;
    slot?: string | undefined;
    spellCheck?: Booleanish | undefined;
    style?: CSSProperties | undefined;
    tabIndex?: number | undefined;
    title?: string | undefined;
    translate?: 'yes' | 'no' | undefined;
  }
  export interface AnchorHTMLAttributes<T> extends HTMLAttributes<T> {
    download?: string | boolean | undefined;
    href?: string | undefined;
    hrefLang?: string | undefined;
    rel?: string | undefined;
    target?: string | undefined;
    type?: string | undefined;
  }
  export interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {
    disabled?: boolean | undefined;
    form?: string | undefined;
    name?: string | undefined;
    type?: 'submit' | 'reset' | 'button' | undefined;
    value?: string | number | undefined;
  }
  export interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    accept?: string | undefined;
    alt?: string | undefined;
    autoComplete?: string | undefined;
    checked?: boolean | undefined;
    defaultChecked?: boolean | undefined;
    defaultValue?: string | number | undefined;
    disabled?: boolean | undefined;
    form?: string | undefined;
    list?: string | undefined;
    max?: number | string | undefined;
    maxLength?: number | undefined;
    min?: number | string | undefined;
    minLength?: number | undefined;
    multiple?: boolean | undefined;
    name?: string | undefined;
    onChange?: ChangeEventHandler<T> | undefined;
    pattern?: string | undefined;
    placeholder?: string | undefined;
    readOnly?: boolean | undefined;
    required?: boolean | undefined;
    size?: number | undefined;
    step?: number | string | undefined;
    type?: string | undefined;
    value?: string | number | readonly string[] | undefined;
  }
  export interface LabelHTMLAttributes<T> extends HTMLAttributes<T> {
    form?: string | undefined;
    htmlFor?: string | undefined;
  }
  export interface SelectHTMLAttributes<T> extends HTMLAttributes<T> {
    autoComplete?: string | undefined;
    defaultValue?: string | number | readonly string[] | undefined;
    disabled?: boolean | undefined;
    form?: string | undefined;
    multiple?: boolean | undefined;
    name?: string | undefined;
    onChange?: ChangeEventHandler<T> | undefined;
    required?: boolean | undefined;
    size?: number | undefined;
    value?: string | number | readonly string[] | undefined;
  }
  export interface OptionHTMLAttributes<T> extends HTMLAttributes<T> {
    disabled?: boolean | undefined;
    label?: string | undefined;
    selected?: boolean | undefined;
    value?: string | number | undefined;
  }
  export interface OptgroupHTMLAttributes<T> extends HTMLAttributes<T> {
    disabled?: boolean | undefined;
    label?: string | undefined;
  }
  export interface TextareaHTMLAttributes<T> extends HTMLAttributes<T> {
    autoComplete?: string | undefined;
    cols?: number | undefined;
    defaultValue?: string | undefined;
    disabled?: boolean | undefined;
    form?: string | undefined;
    maxLength?: number | undefined;
    minLength?: number | undefined;
    name?: string | undefined;
    onChange?: ChangeEventHandler<T> | undefined;
    placeholder?: string | undefined;
    readOnly?: boolean | undefined;
    required?: boolean | undefined;
    rows?: number | undefined;
    value?: string | undefined;
    wrap?: 'hard' | 'soft' | 'off' | undefined;
  }
  export interface FormHTMLAttributes<T> extends HTMLAttributes<T> {
    action?: string | undefined;
    autoComplete?: string | undefined;
    method?: 'get' | 'post' | 'dialog' | undefined;
    name?: string | undefined;
    noValidate?: boolean | undefined;
  }
  export interface FieldsetHTMLAttributes<T> extends HTMLAttributes<T> {
    disabled?: boolean | undefined;
    form?: string | undefined;
    name?: string | undefined;
  }
  export interface OutputHTMLAttributes<T> extends HTMLAttributes<T> {
    form?: string | undefined;
    htmlFor?: string | undefined;
    name?: string | undefined;
  }
  export interface ImgHTMLAttributes<T> extends HTMLAttributes<T> {
    alt?: string | undefined;
    decoding?: 'async' | 'auto' | 'sync' | undefined;
    height?: number | string | undefined;
    loading?: 'eager' | 'lazy' | undefined;
    src?: string | undefined;
    width?: number | string | undefined;
  }
  export interface MeterHTMLAttributes<T> extends HTMLAttributes<T> {
    high?: number | undefined;
    low?: number | undefined;
    max?: number | undefined;
    min?: number | undefined;
    optimum?: number | undefined;
    value?: number | undefined;
  }
  export interface ProgressHTMLAttributes<T> extends HTMLAttributes<T> {
    max?: number | undefined;
    value?: number | undefined;
  }
  export interface DetailsHTMLAttributes<T> extends HTMLAttributes<T> {
    open?: boolean | undefined;
    onToggle?: ReactEventHandler<T> | undefined;
  }
  export interface DialogHTMLAttributes<T> extends HTMLAttributes<T> {
    open?: boolean | undefined;
    onCancel?: ReactEventHandler<T> | undefined;
    onClose?: ReactEventHandler<T> | undefined;
  }
  export interface OlHTMLAttributes<T> extends HTMLAttributes<T> {
    reversed?: boolean | undefined;
    start?: number | undefined;
    type?: '1' | 'a' | 'A' | 'i' | 'I' | undefined;
  }
  export interface LiHTMLAttributes<T> extends HTMLAttributes<T> {
    value?: number | undefined;
  }
  export interface TableCellHTMLAttributes<T> extends HTMLAttributes<T> {
    colSpan?: number | undefined;
    headers?: string | undefined;
    rowSpan?: number | undefined;
    scope?: 'row' | 'col' | 'rowgroup' | 'colgroup' | undefined;
    abbr?: string | undefined;
  }
  export interface TimeHTMLAttributes<T> extends HTMLAttributes<T> {
    dateTime?: string | undefined;
  }
  export interface QuoteHTMLAttributes<T> extends HTMLAttributes<T> {
    cite?: string | undefined;
  }

  export interface SVGAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    ref?: Ref<T> | undefined;
    className?: string | undefined;
    id?: string | undefined;
    role?: string | undefined;
    style?: CSSProperties | undefined;
    tabIndex?: number | undefined;
    lang?: string | undefined;
    xmlns?: string | undefined;
    viewBox?: string | undefined;
    preserveAspectRatio?: string | undefined;
    focusable?: Booleanish | 'auto' | undefined;
    href?: string | undefined;
    width?: number | string | undefined;
    height?: number | string | undefined;
    x?: number | string | undefined;
    y?: number | string | undefined;
    x1?: number | string | undefined;
    x2?: number | string | undefined;
    y1?: number | string | undefined;
    y2?: number | string | undefined;
    cx?: number | string | undefined;
    cy?: number | string | undefined;
    r?: number | string | undefined;
    rx?: number | string | undefined;
    ry?: number | string | undefined;
    fx?: number | string | undefined;
    fy?: number | string | undefined;
    dx?: number | string | undefined;
    dy?: number | string | undefined;
    d?: string | undefined;
    points?: string | undefined;
    pathLength?: number | undefined;
    transform?: string | undefined;
    opacity?: number | string | undefined;
    fill?: string | undefined;
    fillOpacity?: number | string | undefined;
    fillRule?: 'nonzero' | 'evenodd' | 'inherit' | undefined;
    clipRule?: 'nonzero' | 'evenodd' | 'inherit' | undefined;
    stroke?: string | undefined;
    strokeWidth?: number | string | undefined;
    strokeLinecap?: 'butt' | 'round' | 'square' | 'inherit' | undefined;
    strokeLinejoin?: 'miter' | 'round' | 'bevel' | 'inherit' | undefined;
    strokeDasharray?: number | string | undefined;
    strokeDashoffset?: number | string | undefined;
    strokeMiterlimit?: number | string | undefined;
    strokeOpacity?: number | string | undefined;
    vectorEffect?: string | undefined;
    clipPath?: string | undefined;
    mask?: string | undefined;
    filter?: string | undefined;
    offset?: number | string | undefined;
    stopColor?: string | undefined;
    stopOpacity?: number | string | undefined;
    gradientUnits?: 'userSpaceOnUse' | 'objectBoundingBox' | undefined;
    gradientTransform?: string | undefined;
    patternUnits?: 'userSpaceOnUse' | 'objectBoundingBox' | undefined;
    patternTransform?: string | undefined;
    spreadMethod?: 'pad' | 'reflect' | 'repeat' | undefined;
    textAnchor?: 'start' | 'middle' | 'end' | 'inherit' | undefined;
    dominantBaseline?: string | undefined;
    fontFamily?: string | undefined;
    fontSize?: number | string | undefined;
    fontWeight?: number | string | undefined;
    letterSpacing?: number | string | undefined;
    // filter primitives
    in?: string | undefined;
    in2?: string | undefined;
    result?: string | undefined;
    stdDeviation?: number | string | undefined;
    type?: string | undefined;
    values?: string | undefined;
    baseFrequency?: number | string | undefined;
    numOctaves?: number | string | undefined;
    seed?: number | string | undefined;
    scale?: number | string | undefined;
    mode?: string | undefined;
    // SMIL animation
    attributeName?: string | undefined;
    begin?: string | undefined;
    dur?: string | undefined;
    from?: number | string | undefined;
    to?: number | string | undefined;
    by?: number | string | undefined;
    repeatCount?: number | 'indefinite' | undefined;
    keyTimes?: string | undefined;
    keySplines?: string | undefined;
    calcMode?: 'discrete' | 'linear' | 'paced' | 'spline' | undefined;
  }
}

declare module 'react/jsx-runtime' {
  import type { Key, ReactElement } from 'react';
  export { Fragment } from 'react';
  export function jsx(type: any, props: any, key?: Key): ReactElement;
  export function jsxs(type: any, props: any, key?: Key): ReactElement;
}

declare module 'react-dom/client' {
  import type { ReactNode } from 'react';
  export interface RootOptions {
    identifierPrefix?: string | undefined;
    onUncaughtError?: ((error: unknown, errorInfo: { componentStack?: string | undefined }) => void) | undefined;
    onCaughtError?: ((error: unknown, errorInfo: { componentStack?: string | undefined }) => void) | undefined;
    onRecoverableError?: ((error: unknown, errorInfo: { componentStack?: string | undefined }) => void) | undefined;
  }
  export interface Root {
    render(children: ReactNode): void;
    unmount(): void;
  }
  export function createRoot(container: Element | DocumentFragment, options?: RootOptions): Root;
}

declare module 'react-dom/server' {
  import type { ReactNode } from 'react';
  export function renderToStaticMarkup(node: ReactNode): string;
  export function renderToString(node: ReactNode): string;
}

/** The JSX namespace for `jsx: "react-jsx"`: element/children typing and the intrinsic elements the UI uses. */
declare namespace JSX {
  type Element = import('react').ReactElement;
  /** Function components may return any ReactNode (strings, arrays, null), as in React 19. */
  type ElementType = string | ((props: any) => import('react').ReactNode);
  interface ElementChildrenAttribute {
    children: {};
  }
  interface IntrinsicAttributes {
    key?: import('react').Key | null | undefined;
  }

  type H<T, A = import('react').HTMLAttributes<T>> = A & import('react').DataAttributes & import('react').Attributes;
  type S<T> = import('react').SVGAttributes<T> & import('react').DataAttributes & import('react').Attributes;

  interface IntrinsicElements {
    // sectioning and text
    a: H<HTMLAnchorElement, import('react').AnchorHTMLAttributes<HTMLAnchorElement>>;
    abbr: H<HTMLElement>;
    article: H<HTMLElement>;
    aside: H<HTMLElement>;
    b: H<HTMLElement>;
    blockquote: H<HTMLQuoteElement, import('react').QuoteHTMLAttributes<HTMLQuoteElement>>;
    br: H<HTMLBRElement>;
    caption: H<HTMLTableCaptionElement>;
    code: H<HTMLElement>;
    dd: H<HTMLElement>;
    del: H<HTMLModElement>;
    details: H<HTMLDetailsElement, import('react').DetailsHTMLAttributes<HTMLDetailsElement>>;
    dialog: H<HTMLDialogElement, import('react').DialogHTMLAttributes<HTMLDialogElement>>;
    div: H<HTMLDivElement>;
    dl: H<HTMLDListElement>;
    dt: H<HTMLElement>;
    em: H<HTMLElement>;
    figcaption: H<HTMLElement>;
    figure: H<HTMLElement>;
    footer: H<HTMLElement>;
    h1: H<HTMLHeadingElement>;
    h2: H<HTMLHeadingElement>;
    h3: H<HTMLHeadingElement>;
    h4: H<HTMLHeadingElement>;
    h5: H<HTMLHeadingElement>;
    h6: H<HTMLHeadingElement>;
    header: H<HTMLElement>;
    hr: H<HTMLHRElement>;
    i: H<HTMLElement>;
    img: H<HTMLImageElement, import('react').ImgHTMLAttributes<HTMLImageElement>>;
    ins: H<HTMLModElement>;
    kbd: H<HTMLElement>;
    li: H<HTMLLIElement, import('react').LiHTMLAttributes<HTMLLIElement>>;
    main: H<HTMLElement>;
    mark: H<HTMLElement>;
    nav: H<HTMLElement>;
    ol: H<HTMLOListElement, import('react').OlHTMLAttributes<HTMLOListElement>>;
    p: H<HTMLParagraphElement>;
    pre: H<HTMLPreElement>;
    q: H<HTMLQuoteElement, import('react').QuoteHTMLAttributes<HTMLQuoteElement>>;
    s: H<HTMLElement>;
    section: H<HTMLElement>;
    small: H<HTMLElement>;
    span: H<HTMLSpanElement>;
    strong: H<HTMLElement>;
    sub: H<HTMLElement>;
    summary: H<HTMLElement>;
    sup: H<HTMLElement>;
    time: H<HTMLTimeElement, import('react').TimeHTMLAttributes<HTMLTimeElement>>;
    u: H<HTMLElement>;
    ul: H<HTMLUListElement>;
    // tables
    table: H<HTMLTableElement>;
    tbody: H<HTMLTableSectionElement>;
    td: H<HTMLTableCellElement, import('react').TableCellHTMLAttributes<HTMLTableCellElement>>;
    tfoot: H<HTMLTableSectionElement>;
    th: H<HTMLTableCellElement, import('react').TableCellHTMLAttributes<HTMLTableCellElement>>;
    thead: H<HTMLTableSectionElement>;
    tr: H<HTMLTableRowElement>;
    // forms and widgets
    button: H<HTMLButtonElement, import('react').ButtonHTMLAttributes<HTMLButtonElement>>;
    fieldset: H<HTMLFieldSetElement, import('react').FieldsetHTMLAttributes<HTMLFieldSetElement>>;
    form: H<HTMLFormElement, import('react').FormHTMLAttributes<HTMLFormElement>>;
    input: H<HTMLInputElement, import('react').InputHTMLAttributes<HTMLInputElement>>;
    label: H<HTMLLabelElement, import('react').LabelHTMLAttributes<HTMLLabelElement>>;
    legend: H<HTMLLegendElement>;
    meter: H<HTMLMeterElement, import('react').MeterHTMLAttributes<HTMLMeterElement>>;
    optgroup: H<HTMLOptGroupElement, import('react').OptgroupHTMLAttributes<HTMLOptGroupElement>>;
    option: H<HTMLOptionElement, import('react').OptionHTMLAttributes<HTMLOptionElement>>;
    output: H<HTMLOutputElement, import('react').OutputHTMLAttributes<HTMLOutputElement>>;
    progress: H<HTMLProgressElement, import('react').ProgressHTMLAttributes<HTMLProgressElement>>;
    select: H<HTMLSelectElement, import('react').SelectHTMLAttributes<HTMLSelectElement>>;
    textarea: H<HTMLTextAreaElement, import('react').TextareaHTMLAttributes<HTMLTextAreaElement>>;
    // SVG
    svg: S<SVGSVGElement>;
    g: S<SVGGElement>;
    defs: S<SVGDefsElement>;
    symbol: S<SVGSymbolElement>;
    use: S<SVGUseElement>;
    title: S<SVGTitleElement>;
    desc: S<SVGDescElement>;
    path: S<SVGPathElement>;
    circle: S<SVGCircleElement>;
    ellipse: S<SVGEllipseElement>;
    line: S<SVGLineElement>;
    polyline: S<SVGPolylineElement>;
    polygon: S<SVGPolygonElement>;
    rect: S<SVGRectElement>;
    text: S<SVGTextElement>;
    tspan: S<SVGTSpanElement>;
    linearGradient: S<SVGLinearGradientElement>;
    radialGradient: S<SVGRadialGradientElement>;
    stop: S<SVGStopElement>;
    clipPath: S<SVGClipPathElement>;
    mask: S<SVGMaskElement>;
    pattern: S<SVGPatternElement>;
    filter: S<SVGFilterElement>;
    feBlend: S<SVGFEBlendElement>;
    feColorMatrix: S<SVGFEColorMatrixElement>;
    feDisplacementMap: S<SVGFEDisplacementMapElement>;
    feGaussianBlur: S<SVGFEGaussianBlurElement>;
    feMerge: S<SVGFEMergeElement>;
    feMergeNode: S<SVGFEMergeNodeElement>;
    feOffset: S<SVGFEOffsetElement>;
    feTurbulence: S<SVGFETurbulenceElement>;
    animate: S<SVGAnimateElement>;
    animateTransform: S<SVGAnimateTransformElement>;
  }
}
