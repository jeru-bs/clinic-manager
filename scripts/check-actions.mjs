// Guards the delegated event handler maps in docs/app.js: every data-action value rendered by a
// template must have a click handler, every handler key must be rendered somewhere, and every
// data-form value must have a submit handler.
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../docs/app.js", import.meta.url), "utf8");
const failures = [];

function handlerKeys(mapName) {
  const match = source.match(new RegExp(`^const ${mapName} = \\{\\n([\\s\\S]*?)^\\};`, "m"));
  if (!match) {
    failures.push(`handler map not found: ${mapName}`);
    return [];
  }
  return [...match[1].matchAll(/^ {2}"([a-z-]+)":/gm)].map((entry) => entry[1]);
}

// ---- click actions ----
const usedActions = new Set();
for (const match of source.matchAll(/data-action="([a-z-]+)"/g)) usedActions.add(match[1]);
// Row menus render data-action from item objects declared as `action: "..."`.
for (const match of source.matchAll(/\baction: "([a-z-]+)"/g)) usedActions.add(match[1]);
// Dynamic attributes such as data-action="${flag ? "a" : "b"}" contribute every literal in the expression.
for (const match of source.matchAll(/data-action="\$\{([^}]*)\}"/g)) {
  for (const literal of match[1].matchAll(/"([a-z-]+)"/g)) usedActions.add(literal[1]);
}

const clickMapMatch = source.match(/^const clickActions = \{\n([\s\S]*?)^\};/m);
const domainMaps = clickMapMatch ? [...clickMapMatch[1].matchAll(/\.\.\.(\w+Actions)/g)].map((entry) => entry[1]) : [];
if (!domainMaps.length) failures.push("clickActions must spread at least one domain map");

const handledActions = new Map();
for (const mapName of domainMaps) {
  for (const key of handlerKeys(mapName)) {
    if (handledActions.has(key)) failures.push(`action "${key}" is handled in both ${handledActions.get(key)} and ${mapName}`);
    handledActions.set(key, mapName);
  }
}
for (const action of [...usedActions].sort()) {
  if (!handledActions.has(action)) failures.push(`data-action "${action}" has no click handler`);
}
for (const action of [...handledActions.keys()].sort()) {
  if (!usedActions.has(action)) failures.push(`click handler "${action}" is never rendered`);
}

// ---- form submits ----
const usedForms = new Set([...source.matchAll(/data-form="([a-z-]+)"/g)].map((match) => match[1]));
// business-range is a filter form handled inline before the busy-form guard, not a save.
const INLINE_FORMS = new Set(["business-range"]);
if (!source.includes('if (form.dataset.form === "business-range")')) failures.push("business-range inline submit branch missing");
const submitKeys = handlerKeys("submitActions");
for (const form of [...usedForms].sort()) {
  if (!submitKeys.includes(form) && !INLINE_FORMS.has(form)) failures.push(`data-form "${form}" has no submit handler`);
}
for (const form of submitKeys) {
  if (!usedForms.has(form)) failures.push(`submit handler "${form}" is never rendered`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Click actions: ${usedActions.size} data-action values, ${handledActions.size} handlers in ${domainMaps.length} domain maps: ok`);
  console.log(`Form submits: ${usedForms.size} data-form values, ${submitKeys.length} handlers + ${INLINE_FORMS.size} inline: ok`);
}
