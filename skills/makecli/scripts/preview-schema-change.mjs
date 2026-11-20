#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const statuses = ['added', 'removed', 'changed', 'unchanged'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const failure = reason => ({ verified: false, reason });
const isDiffItem = (item, nameKey, allowed = statuses) => isObject(item)
  && typeof item[nameKey] === 'string' && Boolean(item[nameKey].trim())
  && allowed.includes(item.status) && (item.detail === undefined || typeof item.detail === 'string');
const hasValidDetails = (item, key, nameKey) => item[key] === undefined || item[key] === null
  || (Array.isArray(item[key]) && item[key].every(detail => isDiffItem(detail, nameKey, statuses.slice(0, 3))));

// Pure result validation; CLI execution and diagnostics stay in runPreview.
const verifyDiff = result => {
  if (result.error || result.signal || ![0, 1].includes(result.status)) return failure('command_failed');
  if (result.stderr.trim()) return failure('cli_diagnostics_present');
  let diff;
  try { diff = JSON.parse(result.stdout); }
  catch { return failure('invalid_json'); }
  if (!isObject(diff) || typeof diff.appKey !== 'string' || !diff.appKey.trim()
    || !isObject(diff.summary)
    || !['entities', 'relations'].every(key => diff[key] === null || Array.isArray(diff[key]))
    || !statuses.every(key => Number.isSafeInteger(diff.summary[key]) && diff.summary[key] >= 0)) {
    return failure('invalid_diff_result');
  }
  const items = [...(diff.entities ?? []), ...(diff.relations ?? [])];
  if (!items.every(item => isDiffItem(item, 'key'))
    || !(diff.entities ?? []).every(item => hasValidDetails(item, 'fields', 'key')
      && hasValidDetails(item, 'constraints', 'name'))) return failure('invalid_diff_item');
  const counts = items.reduce((total, item) => ({ ...total, [item.status]: total[item.status] + 1 }),
    { added: 0, removed: 0, changed: 0, unchanged: 0 });
  if (!statuses.every(key => diff.summary[key] === counts[key])) return failure('inconsistent_summary');
  const hasChanges = statuses.slice(0, 3).some(key => diff.summary[key] > 0);
  if (result.status !== Number(hasChanges)) return failure('inconsistent_exit_code');
  return { verified: true, hasChanges };
};

const stop = reason => {
  // Do not echo unverified CLI output: it can contain request or credential details.
  console.error(`[schema-preview] failed: ${reason}; no verified diff, stop before apply`);
  return 2;
};

const runPreview = args => {
  console.error('[schema-preview] start: read-only diff');
  let result;
  try {
    result = spawnSync('makecli', ['diff', ...args, '--output', 'json'], {
      encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    });
  } catch { return stop('command_start_failed'); }
  const verification = verifyDiff(result);
  if (!verification.verified) return stop(verification.reason);
  console.error(`[schema-preview] verified: ${verification.hasChanges ? 'changes' : 'no_changes'}; apply was not run`);
  process.stdout.write(result.stdout.endsWith('\n') ? result.stdout : `${result.stdout}\n`);
  return Number(verification.hasChanges);
};

process.exitCode = runPreview(process.argv.slice(2));
