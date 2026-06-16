#!/usr/bin/env node
const mode = process.argv[2];
const marker = process.env.TEST_DATA_MARKER || 'dripmetric_test_generated';
const useExisting = String(process.env.USE_EXISTING_TEST_DATA ?? 'true').toLowerCase() === 'true';

if (mode === 'seed' && useExisting) {
  console.log('USE_EXISTING_TEST_DATA=true; skipping seed.');
  process.exit(0);
}
if (mode === 'cleanup' && useExisting) {
  console.log('USE_EXISTING_TEST_DATA=true; skipping cleanup.');
  process.exit(0);
}
console.log(`${mode} would operate only on records tagged with ${marker}. Configure DATABASE_URL and USE_EXISTING_TEST_DATA=false to enable generated fixtures.`);
