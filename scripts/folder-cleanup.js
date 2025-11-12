/**
 * Folder Structure Cleanup Script
 * Moves non-critical files to /others directory as per test_and_validation_plan.txt
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const OTHERS_DIR = path.join(ROOT_DIR, 'others');

// Files and directories to move to /others
const FILES_TO_MOVE = [
  // Documentation files (keep README.md and LICENSE)
  'ANALYSIS_AND_ENHANCEMENT_PLAN.md',
  'CHROME_DEPS_FIX.md',
  'COMPLETE_ERROR_FIX_REPORT.md',
  'DELTA_CACHING_IMPLEMENTATION.md',
  'ERROR_ANALYSIS_AND_FIXES.md',
  'ERROR_FIXES_SUMMARY.md',
  'FRONTEND_IMPLEMENTATION_COMPLETE.md',
  'IMPLEMENTATION_COMPLETE.md',
  'IMPLEMENTATION_SUMMARY.md',
  'KSA_SCRAPERS_ADDED.md',
  'MODERNIZATION_IMPLEMENTATION_STATUS.md',
  'MODERN_UI_REDESIGN.md',
  'NEXT_STEPS.md',
  'ROAR_ADMIN_SYSTEM.md',
  'ROAR_SETUP_GUIDE.md',
  'SCRAPER_ENHANCEMENTS.md',
  'SCRAPER_STATUS.md',
  'SECURITY_AUDIT_COMPLETE.md',
  'SECURITY_AUDIT.md',
  'SECURITY_IMPLEMENTATION.md',
  'SECURITY_SUMMARY.md',
  'THREAD_MANAGEMENT.md',
  'UGREEN_MOUSE_VALIDATION.md',
  'UI_FIX_SUMMARY.md',
  'UI_IMPROVEMENTS_SUMMARY.md',
  'WORKERS_AND_CACHE.md',
  'COMPREHENSIVE_REASSESSMENT_REPORT.md',
  'REASSESSMENT_ACTION_PLAN.md',
  'ERROR_ANALYSIS_REPORT.md',
  'lootqa_modernaztion_desing_implementation_plan.txt',
  'test_and_validation_plan.txt',
  'HIGH_EFFICIENCY_SCRAPER_IMPLEMENTATION.md',
  // Backend directory files
  'backend/CHROME_DEPS_FIX.md',
  'backend/SCRAPER_STATUS.md',
  'backend/SECURITY_AUDIT.md',
  'backend/SECURITY_IMPLEMENTATION.md',
  'backend/SECURITY_SUMMARY.md',
  'backend/THREAD_MANAGEMENT.md',
  'backend/WORKERS_AND_CACHE.md',
  // Frontend directory files
  'frontend/UI_DESIGN.md'
];

const DIRS_TO_CREATE = [
  'others/test_plans',
  'others/mocks',
  'others/legacy_docs'
];

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dirPath}`);
  }
}

function moveFile(sourcePath, destPath) {
  try {
    if (fs.existsSync(sourcePath)) {
      const destDir = path.dirname(destPath);
      ensureDirectoryExists(destDir);
      
      // Skip if file already exists in destination
      if (fs.existsSync(destPath)) {
        console.log(`⚠️  Already exists in /others: ${path.basename(sourcePath)}`);
        return false;
      }
      
      fs.renameSync(sourcePath, destPath);
      console.log(`✅ Moved: ${path.relative(ROOT_DIR, sourcePath)}`);
      return true;
    } else {
      console.log(`⚠️  File not found: ${path.relative(ROOT_DIR, sourcePath)}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error moving ${path.relative(ROOT_DIR, sourcePath)}:`, error.message);
    return false;
  }
}

function cleanup() {
  console.log('🧹 Starting Folder Structure Cleanup...\n');
  console.log('This will move non-critical documentation files to /others\n');

  // Create /others directory structure
  console.log('1️⃣ Creating /others directory structure...');
  DIRS_TO_CREATE.forEach(dir => {
    ensureDirectoryExists(path.join(ROOT_DIR, dir));
  });

  // Move files
  console.log('\n2️⃣ Moving files to /others...');
  let moved = 0;
  let skipped = 0;
  let errors = 0;
  let alreadyExists = 0;

  FILES_TO_MOVE.forEach(fileName => {
    const sourcePath = path.join(ROOT_DIR, fileName);
    const destPath = path.join(ROOT_DIR, 'others', path.basename(fileName));

    if (fs.existsSync(sourcePath)) {
      if (fs.existsSync(destPath)) {
        alreadyExists++;
        console.log(`⚠️  Already in /others: ${fileName}`);
      } else if (moveFile(sourcePath, destPath)) {
        moved++;
      } else {
        errors++;
      }
    } else {
      skipped++;
    }
  });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 CLEANUP SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Moved: ${moved}`);
  console.log(`⚠️  Skipped (not found): ${skipped}`);
  console.log(`⚠️  Already in /others: ${alreadyExists}`);
  console.log(`❌ Errors: ${errors}`);
  console.log('='.repeat(60));

  console.log('\n✅ Cleanup complete!');
  console.log('Non-critical files moved to /others directory.');
  console.log('Deleting /others should have zero impact on app functionality.');
}

// Run if called directly
if (require.main === module) {
  cleanup();
}

module.exports = { cleanup };
