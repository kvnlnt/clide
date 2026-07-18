import type { Workflow, WorkflowStep } from "./types";

// ---------------------------------------------------------------------------
// Workflow expression language (ticket 88). Minimal and safe — no eval, no
// arbitrary JS. Grammar (documented in docs/workflow-schema.md):
//
//   expr    := or
//   or      := and ( "||" and )*
//   and     := unary ( "&&" unary )*
//   unary   := "!" unary | comparison
//   compare := primary ( ("==" | "!=" | "<=" | ">=" | "<" | ">") primary )?
//   primary := literal | path | "(" expr ")"
//   path    := ident ( "." (ident | integer) )*      // ".length" works on strings/arrays
//   literal := number | "..." | '...' | true | false | null
//
// Semantics are strict by design: `==`/`!=` are strict equality; ordering
// comparisons return false unless BOTH sides are numbers; missing properties
// evaluate to undefined (never a throw).
// ---------------------------------------------------------------------------

type Token =
  | { kind: "ident"; value: string }
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "op"; value: string };

const OPS = ["==", "!=", "<=", ">=", "&&", "||", "<", ">", "!", "(", ")", "."];

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (OPS.includes(two)) {
      tokens.push({ kind: "op", value: two });
      i += 2;
      continue;
    }
    if (OPS.includes(ch)) {
      tokens.push({ kind: "op", value: ch });
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let out = "";
      while (j < src.length && src[j] !== quote) {
        out += src[j];
        j++;
      }
      if (j >= src.length) throw new Error("unterminated string");
      tokens.push({ kind: "string", value: out });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      const match = /^\d+(\.\d+)?/.exec(src.slice(i))!;
      tokens.push({ kind: "number", value: Number(match[0]) });
      i += match[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const match = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(src.slice(i))!;
      tokens.push({ kind: "ident", value: match[0] });
      i += match[0].length;
      continue;
    }
    throw new Error(`unexpected character "${ch}"`);
  }
  return tokens;
}

type Expr =
  | { type: "literal"; value: unknown }
  | { type: "path"; root: string; segments: string[] }
  | { type: "unary"; op: "!"; operand: Expr }
  | { type: "binary"; op: string; left: Expr; right: Expr };

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  parse(): Expr {
    const expr = this.parseOr();
    if (this.pos < this.tokens.length) throw new Error(`unexpected "${this.describe(this.tokens[this.pos]!)}"`);
    return expr;
  }

  private describe(t: Token): string {
    return t.kind === "op" ? t.value : String(t.value);
  }

  private peekOp(...ops: string[]): string | null {
    const t = this.tokens[this.pos];
    if (t?.kind === "op" && ops.includes(t.value)) return t.value;
    return null;
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.peekOp("||")) {
      this.pos++;
      left = { type: "binary", op: "||", left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseUnary();
    while (this.peekOp("&&")) {
      this.pos++;
      left = { type: "binary", op: "&&", left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.peekOp("!")) {
      this.pos++;
      return { type: "unary", op: "!", operand: this.parseUnary() };
    }
    return this.parseComparison();
  }

  private parseComparison(): Expr {
    const left = this.parsePrimary();
    const op = this.peekOp("==", "!=", "<=", ">=", "<", ">");
    if (!op) return left;
    this.pos++;
    return { type: "binary", op, left, right: this.parsePrimary() };
  }

  private parsePrimary(): Expr {
    const t = this.tokens[this.pos];
    if (!t) throw new Error("unexpected end of expression");
    if (t.kind === "number" || t.kind === "string") {
      this.pos++;
      return { type: "literal", value: t.value };
    }
    if (t.kind === "op" && t.value === "(") {
      this.pos++;
      const inner = this.parseOr();
      if (!this.peekOp(")")) throw new Error('missing ")"');
      this.pos++;
      return inner;
    }
    if (t.kind === "ident") {
      if (t.value === "true" || t.value === "false") {
        this.pos++;
        return { type: "literal", value: t.value === "true" };
      }
      if (t.value === "null") {
        this.pos++;
        return { type: "literal", value: null };
      }
      this.pos++;
      const segments: string[] = [];
      while (this.peekOp(".")) {
        this.pos++;
        const seg = this.tokens[this.pos];
        if (!seg || (seg.kind !== "ident" && seg.kind !== "number")) {
          throw new Error('expected a property name after "."');
        }
        segments.push(String(seg.value));
        this.pos++;
      }
      return { type: "path", root: t.value, segments };
    }
    throw new Error(`unexpected "${this.describe(t)}"`);
  }
}

/** Parses an expression, throwing `Error` with a human message on bad syntax. */
export function parseExpression(src: string): Expr {
  const trimmed = src.trim();
  if (!trimmed) throw new Error("empty expression");
  return new Parser(tokenize(trimmed)).parse();
}

function truthy(v: unknown): boolean {
  return !(v === false || v === 0 || v === "" || v === null || v === undefined);
}

function resolvePath(env: Record<string, unknown>, root: string, segments: string[]): unknown {
  let cur: unknown = env[root];
  for (const seg of segments) {
    if (seg === "length") {
      if (typeof cur === "string" || Array.isArray(cur)) {
        cur = cur.length;
        continue;
      }
    }
    if (Array.isArray(cur) && /^\d+$/.test(seg)) {
      cur = cur[Number(seg)];
      continue;
    }
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/** Evaluates a parsed expression against a scope env. Never throws. */
export function evaluateExpression(expr: Expr, env: Record<string, unknown>): unknown {
  switch (expr.type) {
    case "literal":
      return expr.value;
    case "path":
      return resolvePath(env, expr.root, expr.segments);
    case "unary":
      return !truthy(evaluateExpression(expr.operand, env));
    case "binary": {
      if (expr.op === "&&") {
        return truthy(evaluateExpression(expr.left, env)) ? evaluateExpression(expr.right, env) : false;
      }
      if (expr.op === "||") {
        const left = evaluateExpression(expr.left, env);
        return truthy(left) ? left : evaluateExpression(expr.right, env);
      }
      const l = evaluateExpression(expr.left, env);
      const r = evaluateExpression(expr.right, env);
      switch (expr.op) {
        case "==":
          return l === r;
        case "!=":
          return l !== r;
        case "<":
          return typeof l === "number" && typeof r === "number" ? l < r : false;
        case "<=":
          return typeof l === "number" && typeof r === "number" ? l <= r : false;
        case ">":
          return typeof l === "number" && typeof r === "number" ? l > r : false;
        case ">=":
          return typeof l === "number" && typeof r === "number" ? l >= r : false;
        default:
          return undefined;
      }
    }
  }
}

/** Evaluates an expression string; `ok: false` carries the syntax/evaluation problem. */
export function evalExpressionString(
  src: string,
  env: Record<string, unknown>,
): { ok: boolean; value?: unknown; error?: string } {
  try {
    return { ok: true, value: evaluateExpression(parseExpression(src), env) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export { truthy as isTruthy };

// ---------------------------------------------------------------------------
// {{…}} templates in step input strings.
// ---------------------------------------------------------------------------

const TEMPLATE_RE = /\{\{([^}]*)\}\}/g;

/** A field that is exactly one {{expr}} resolves to the raw value; otherwise interpolates. */
export function resolveTemplate(
  input: string,
  env: Record<string, unknown>,
): { ok: boolean; value?: unknown; error?: string } {
  const whole = /^\s*\{\{([^}]*)\}\}\s*$/.exec(input);
  if (whole) {
    const res = evalExpressionString(whole[1]!, env);
    if (!res.ok) return res;
    if (res.value === undefined) return { ok: false, error: `"${whole[1]!.trim()}" resolved to nothing` };
    return { ok: true, value: res.value };
  }
  let error: string | undefined;
  const out = input.replace(TEMPLATE_RE, (_, exprSrc: string) => {
    const res = evalExpressionString(exprSrc, env);
    if (!res.ok || res.value === undefined) {
      error = res.error ?? `"${exprSrc.trim()}" resolved to nothing`;
      return "";
    }
    return typeof res.value === "string" ? res.value : JSON.stringify(res.value);
  });
  if (error) return { ok: false, error };
  return { ok: true, value: out };
}

/** Root identifiers referenced by every {{…}} in a string; syntax errors reported per-expression. */
export function templateRefs(input: string): { roots: string[]; errors: string[] } {
  const roots = new Set<string>();
  const errors: string[] = [];
  for (const match of input.matchAll(TEMPLATE_RE)) {
    try {
      const expr = parseExpression(match[1]!);
      const walk = (e: Expr): void => {
        if (e.type === "path") roots.add(e.root);
        else if (e.type === "unary") walk(e.operand);
        else if (e.type === "binary") {
          walk(e.left);
          walk(e.right);
        }
      };
      walk(expr);
    } catch (err) {
      errors.push(`{{${match[1]!.trim()}}}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { roots: Array.from(roots), errors };
}

export function expressionRefs(src: string): { roots: string[]; error?: string } {
  try {
    const roots = new Set<string>();
    const walk = (e: Expr): void => {
      if (e.type === "path") roots.add(e.root);
      else if (e.type === "unary") walk(e.operand);
      else if (e.type === "binary") {
        walk(e.left);
        walk(e.right);
      }
    };
    walk(parseExpression(src));
    return { roots: Array.from(roots) };
  } catch (err) {
    return { roots: [], error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Scope rules (ticket 88): the single source of truth for what a step may
// reference — earlier siblings and ancestors' earlier siblings. Steps inside
// a parallel sibling branch or an unexecuted decision branch are out of
// scope; after a parallel joins, its branches' form steps ARE in scope
// (guaranteed complete); after a decision or loop, its inner steps are NOT
// (which branch ran / whether any iteration ran is runtime-dependent).
// ---------------------------------------------------------------------------

export const ITEM_NAME = "item";
export const TRIGGER_NAME = "trigger";

/**
 * Referenceable form-step names per step, keyed by step name. Every scope
 * includes `trigger`; steps inside loops also get `item`.
 */
export function computeScopes(workflow: Workflow): Map<string, string[]> {
  const scopes = new Map<string, string[]>();

  const formNamesIn = (steps: WorkflowStep[]): string[] => {
    const names: string[] = [];
    for (const s of steps) {
      if (s.type === "form") names.push(s.name);
      else if (s.type === "decision") names.push(...formNamesIn(s.then), ...formNamesIn(s.else ?? []));
      else if (s.type === "loop") names.push(...formNamesIn(s.steps));
      else names.push(...s.branches.flatMap(formNamesIn));
    }
    return names;
  };

  const walk = (steps: WorkflowStep[], inherited: string[], inLoop: boolean): string[] => {
    const avail = [...inherited];
    for (const step of steps) {
      const scope = [...avail, TRIGGER_NAME, ...(inLoop ? [ITEM_NAME] : [])];
      scopes.set(step.name, scope);
      switch (step.type) {
        case "form":
          avail.push(step.name);
          break;
        case "decision":
          walk(step.then, avail, inLoop);
          walk(step.else ?? [], avail, inLoop);
          break;
        case "loop":
          walk(step.steps, avail, true);
          break;
        case "parallel":
          for (const branch of step.branches) walk(branch, avail, inLoop);
          // Joined: every branch's form steps are guaranteed complete.
          avail.push(...step.branches.flatMap(formNamesIn));
          break;
      }
    }
    return avail;
  };

  walk(workflow.steps, [], false);
  return scopes;
}

/** Flat list of every step (any type, any depth) — for name-uniqueness checks. */
export function allSteps(steps: WorkflowStep[]): WorkflowStep[] {
  const out: WorkflowStep[] = [];
  for (const s of steps) {
    out.push(s);
    if (s.type === "decision") out.push(...allSteps(s.then), ...allSteps(s.else ?? []));
    else if (s.type === "loop") out.push(...allSteps(s.steps));
    else if (s.type === "parallel") out.push(...s.branches.flatMap(allSteps));
  }
  return out;
}

export const STEP_NAME_RE = /^[a-z][a-z0-9_-]*$/;
