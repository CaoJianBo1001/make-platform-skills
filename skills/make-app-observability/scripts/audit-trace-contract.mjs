#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const usage = `Usage: node audit-trace-contract.mjs <project-root> [--mode auto|direct|service-fronted]
Checks the default Make App Trace ID wiring. Run behavior and real AppShell visibility tests as well; source inspection cannot prove runtime correlation or card visibility.`;
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(usage);
  process.exit(0);
}

let projectRoot;
let mode = 'auto';
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--mode') {
    mode = args[++index];
  } else if (arg.startsWith('--mode=')) {
    mode = arg.slice('--mode='.length);
  } else if (!arg.startsWith('-') && !projectRoot) {
    projectRoot = arg;
  } else {
    console.error(`Unexpected argument: ${arg}\n${usage}`);
    process.exit(2);
  }
}
if (!['auto', 'direct', 'service-fronted'].includes(mode)) {
  console.error(`Invalid --mode: ${mode}\n${usage}`);
  process.exit(2);
}

const root = path.resolve(projectRoot ?? '.');
if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  console.error(`Project root is not a directory: ${root}`);
  process.exit(2);
}

const firstDirectory = (candidates) => candidates
  .map((candidate) => path.join(root, candidate))
  .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isDirectory());
const uiDirectory = firstDirectory(['apps/ui/src', 'ui/src', 'src']);
const serviceDirectory = firstDirectory(['apps/service/src', 'service/src', 'server/src']);
const resolvedMode = mode === 'auto'
  ? (serviceDirectory ? 'service-fronted' : 'direct')
  : mode;
const sourceExtension = /\.(?:[cm]?js|[cm]?ts|jsx|tsx)$/i;
const excludedDirectory = /^(?:node_modules|dist|build|coverage|\.git|__fixtures__)$/;
const excludedFile = /(?:\.(?:test|spec|stories)\.|\.d\.ts$)/i;
const collect = (directory) => {
  if (!directory) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) return excludedDirectory.test(entry.name) ? [] : collect(location);
    return entry.isFile() && sourceExtension.test(entry.name) && !excludedFile.test(entry.name)
      ? [{ path: location, text: fs.readFileSync(location, 'utf8') }]
      : [];
  });
};

const uiFiles = collect(uiDirectory);
const serviceFiles = collect(serviceDirectory);
const uiText = uiFiles.map((file) => file.text).join('\n');
const serviceText = serviceFiles.map((file) => file.text).join('\n');
const failures = [];
const hasBothHeaders = (text) => /traceparent/i.test(text) && /x-log-id/i.test(text);
const writesHeader = (text, name) => new RegExp(`(?:\\.set|\\.setHeader|\\.append|\\.header)\\s*\\(\\s*['\"\\x60]${name}['\"\\x60]`, 'i').test(text)
  || new RegExp(`(?:\\{|,)\\s*['\"\\x60]?${name}['\"\\x60]?\\s*:`, 'i').test(text);
const writesResponseTrace = (text) => {
  const responseNames = new Set(['res', 'response', 'reply']);
  const assignments = [...text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\b/g)];
  let size;
  do {
    size = responseNames.size;
    for (const [, alias, source] of assignments) {
      if (responseNames.has(source)) responseNames.add(alias);
    }
  } while (responseNames.size !== size);
  return [...text.matchAll(/\b([A-Za-z_$][\w$]*)\s*\.\s*(?:setHeader|header|set)\s*\(\s*['"`]x-log-id['"`]/gi)]
    .some(([, receiver]) => responseNames.has(receiver));
};

if (!uiFiles.length) failures.push('ui_source_missing: no Make App UI source found');
const uiPackage = ['apps/ui/package.json', 'ui/package.json', 'package.json']
  .map((name) => path.join(root, name))
  .find((name) => fs.existsSync(name));
let version;
if (uiPackage) {
  try {
    const manifest = JSON.parse(fs.readFileSync(uiPackage, 'utf8'));
    version = manifest.dependencies?.['@qfei-design/make-app-observability']
      ?? manifest.devDependencies?.['@qfei-design/make-app-observability'];
  } catch {
    failures.push('ui_package_invalid: cannot parse the UI package.json');
  }
}
if (!version) {
  failures.push('observability_dependency_missing: UI must declare @qfei-design/make-app-observability');
} else {
  const match = /^(\^|~|>=|>|=)?(\d+)\.(\d+)\.(\d+)(?:\s+<\s*\d+\.\d+\.\d+)?$/.exec(version);
  if (!match) {
    failures.push('observability_version_unverifiable: use a registry version range with a verifiable minimum');
  } else {
    const [, operator, rawMajor, rawMinor, rawPatch] = match;
    const major = Number(rawMajor);
    const minor = Number(rawMinor);
    const patch = Number(rawPatch) + (operator === '>' ? 1 : 0);
    if (major === 0 && (minor < 1 || (minor === 1 && patch < 5))) {
      failures.push('observability_version_too_old: require @qfei-design/make-app-observability >= 0.1.5');
    }
  }
}
if (!/@qfei-design\/make-app-observability\/styles\.css/.test(uiText)) {
  failures.push('observability_styles_missing: import the public styles once at the UI entry');
}
if (!/@qfei-design\/make-app-observability\/react/.test(uiText)
    || !/MakeAppErrorNotice\b/.test(uiText)) {
  failures.push('observability_notice_missing: use the public React error notice');
}
if (!uiFiles.some((file) => writesHeader(file.text, 'traceparent')
    && writesHeader(file.text, 'x-log-id'))) {
  failures.push('ui_trace_headers_missing: the shared request adapter must write traceparent and X-Log-Id together');
}
if (/__traceparent/i.test(uiText)) {
  failures.push('query_trace_present: carry Trace ID in headers, not a URL query parameter');
}

const directAiFetch = /\bfetch\s*\(\s*(['"`])[^'"`]*\/ai\/v1\/[^'"`]*\1\s*(?:,\s*(\{[^{}]*\}))?\s*\)/gi;
const hasUntracedDirectAiFetch = (text) => [...text.matchAll(directAiFetch)]
  .some(([, , options]) => !options || !/\bheaders\b/i.test(options));
if (uiFiles.some((file) => hasUntracedDirectAiFetch(file.text))) {
  failures.push('ai_trace_headers_missing: a direct AI fetch has no headers; use the traced shared transport');
}

if (resolvedMode === 'service-fronted') {
  if (!serviceFiles.length) {
    failures.push('service_source_missing: Service-fronted mode requires Service source');
  } else {
    if (!/(?:resolveRequestTrace|normalizeTraceId|validateTraceId|isValidTraceId|TRACE_ID_PATTERN)/i.test(serviceText)) {
      failures.push('service_trace_validation_missing: validate or generate a request Trace ID');
    }
    if (!serviceFiles.some((file) => writesResponseTrace(file.text))) {
      failures.push('service_response_trace_missing: return X-Log-Id in Service responses');
    }
    if (!serviceFiles.some((file) => hasBothHeaders(file.text)
      && writesHeader(file.text, 'x-log-id')
      && writesHeader(file.text, 'traceparent'))) {
      failures.push('service_gateway_trace_missing: forward the validated trace headers to Make Gateway');
    }
    if (serviceFiles.some((file) => /(?:\.set|\.setHeader|\.append)\s*\(\s*['"`]traceparent['"`]\s*,\s*(?:req|request)\.headers(?:\.traceparent|\[\s*['"`]traceparent['"`]\s*\]|\.get\s*\(\s*['"`]traceparent['"`]\s*\))/i.test(file.text))) {
      failures.push('service_raw_traceparent_forwarding: forward only a validated traceparent from request context');
    }
    if (!/traceId/.test(serviceText) || !/(?:logger|console)\s*\./.test(serviceText)) {
      failures.push('service_trace_log_missing: correlate safe Service logs with traceId');
    }
  }
}

console.log(`mode: ${resolvedMode}`);
console.log('scope: trace wiring only; verify error notice visibility in a real AppShell test');
for (const failure of failures) console.error(`FAIL ${failure}`);
console.log(`status: ${failures.length ? 'FAIL' : 'PASS'}`);
process.exitCode = failures.length ? 1 : 0;
