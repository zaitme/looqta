/**
 * Master Validation Runner
 * Runs all validation tests from test_and_validation_plan.txt
 * Part of test_and_validation_plan.txt implementation
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { validateSchema } = require('./schema-validation');
const { validateScrapers } = require('./scraper-validation');
const { validateROARAdmin } = require('./roar-admin-validation');
const { measurePerformance } = require('./performance-baseline');

async function runAllValidations() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     LOOQTA MASTER VALIDATION RUNNER                       ║');
  console.log('║     Test & Validation Plan Implementation                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const results = {
    schema: null,
    scrapers: null,
    roar: null,
    performance: null
  };

  let overallSuccess = true;

  // 1. Schema Validation
  console.log('\n' + '═'.repeat(60));
  console.log('STEP 1: Schema Validation');
  console.log('═'.repeat(60));
  try {
    results.schema = await validateSchema();
    if (!results.schema.success) overallSuccess = false;
  } catch (error) {
    console.error('❌ Schema validation crashed:', error.message);
    overallSuccess = false;
  }

  // 2. Scraper Validation
  console.log('\n' + '═'.repeat(60));
  console.log('STEP 2: Scraper Validation');
  console.log('═'.repeat(60));
  try {
    results.scrapers = await validateScrapers();
    if (!results.scrapers.success) overallSuccess = false;
  } catch (error) {
    console.error('❌ Scraper validation crashed:', error.message);
    overallSuccess = false;
  }

  // 3. ROAR Admin Validation
  console.log('\n' + '═'.repeat(60));
  console.log('STEP 3: ROAR Admin Console Validation');
  console.log('═'.repeat(60));
  try {
    results.roar = await validateROARAdmin();
    if (!results.roar.success) overallSuccess = false;
  } catch (error) {
    console.error('❌ ROAR validation crashed:', error.message);
    overallSuccess = false;
  }

  // 4. Performance Baseline
  console.log('\n' + '═'.repeat(60));
  console.log('STEP 4: Performance Baseline');
  console.log('═'.repeat(60));
  try {
    results.performance = await measurePerformance();
    if (!results.performance.success) overallSuccess = false;
  } catch (error) {
    console.error('❌ Performance measurement crashed:', error.message);
    overallSuccess = false;
  }

  // Final Summary
  console.log('\n\n' + '╔════════════════════════════════════════════════════════════╗');
  console.log('║                    FINAL SUMMARY                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const summary = {
    'Schema Validation': results.schema?.success ? '✅ PASS' : '❌ FAIL',
    'Scraper Validation': results.scrapers?.success ? '✅ PASS' : '❌ FAIL',
    'ROAR Admin Validation': results.roar?.success ? '✅ PASS' : '❌ FAIL',
    'Performance Baseline': results.performance?.success ? '✅ PASS' : '⚠️  WARN'
  };

  Object.entries(summary).forEach(([test, status]) => {
    console.log(`  ${status}  ${test}`);
  });

  console.log('');
  console.log('═'.repeat(60));
  
  const totalTests = Object.keys(summary).length;
  const passedTests = Object.values(summary).filter(s => s.includes('✅')).length;
  const failedTests = Object.values(summary).filter(s => s.includes('❌')).length;
  const warnedTests = Object.values(summary).filter(s => s.includes('⚠️')).length;

  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`⚠️  Warnings: ${warnedTests}`);
  console.log('═'.repeat(60));

  if (overallSuccess && failedTests === 0) {
    console.log('\n🎉 ALL VALIDATIONS PASSED!');
    return { success: true, results };
  } else {
    console.log('\n⚠️  SOME VALIDATIONS FAILED OR HAVE WARNINGS');
    console.log('Review the output above for details.');
    return { success: false, results };
  }
}

// Run if called directly
if (require.main === module) {
  runAllValidations()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { runAllValidations };
