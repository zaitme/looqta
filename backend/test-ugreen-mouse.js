/**
 * Validation script for "ugreen mouse" search
 * Tests scraper results, UI data structure, and efficiency
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const amazon = require('./src/scrapers/amazon');
const noon = require('./src/scrapers/noon');

const QUERY = 'ugreen mouse';

console.log('='.repeat(80));
console.log('UGREEN MOUSE SEARCH VALIDATION');
console.log('='.repeat(80));
console.log(`Query: "${QUERY}"\n`);

const startTime = Date.now();

Promise.allSettled([amazon.search(QUERY), noon.search(QUERY)])
  .then(([amazonResult, noonResult]) => {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n⏱️  Total Duration: ${duration}s\n`);
    
    // Amazon Results Validation
    console.log('📦 AMAZON RESULTS');
    console.log('-'.repeat(80));
    if (amazonResult.status === 'fulfilled' && amazonResult.value) {
      const amazonResults = amazonResult.value;
      console.log(`✅ Status: SUCCESS`);
      console.log(`📊 Count: ${amazonResults.length} products`);
      
      if (amazonResults.length > 0) {
        console.log('\n📋 Sample Results:');
        amazonResults.slice(0, 3).forEach((r, i) => {
          console.log(`\n  ${i + 1}. ${r.product_name || 'N/A'}`);
          console.log(`     💰 Price: ${r.currency || 'SAR'} ${r.price || 'N/A'}`);
          console.log(`     🔗 URL: ${r.url ? '✅' : '❌'} ${r.url || 'Missing'}`);
          console.log(`     🖼️  Image: ${r.image ? '✅' : '❌'} ${r.image ? r.image.substring(0, 60) + '...' : 'Missing'}`);
          console.log(`     🏪 Site: ${r.site || 'N/A'}`);
          
          // Validation checks
          const issues = [];
          if (!r.product_name || r.product_name.length < 10) {
            issues.push('⚠️  Product name too short or missing');
          }
          if (!r.url) {
            issues.push('⚠️  URL missing');
          }
          if (!r.image) {
            issues.push('⚠️  Image missing');
          }
          if (!r.price || r.price <= 0) {
            issues.push('⚠️  Price missing or invalid');
          }
          if (!r.site) {
            issues.push('⚠️  Site missing');
          }
          
          if (issues.length > 0) {
            console.log(`     ⚠️  Issues:`);
            issues.forEach(issue => console.log(`        ${issue}`));
          } else {
            console.log(`     ✅ All fields valid`);
          }
        });
        
        // Statistics
        const withImages = amazonResults.filter(r => r.image).length;
        const withUrls = amazonResults.filter(r => r.url).length;
        const avgNameLength = amazonResults.reduce((sum, r) => sum + (r.product_name?.length || 0), 0) / amazonResults.length;
        
        console.log(`\n📈 Statistics:`);
        console.log(`   • Products with images: ${withImages}/${amazonResults.length} (${((withImages/amazonResults.length)*100).toFixed(1)}%)`);
        console.log(`   • Products with URLs: ${withUrls}/${amazonResults.length} (${((withUrls/amazonResults.length)*100).toFixed(1)}%)`);
        console.log(`   • Average product name length: ${avgNameLength.toFixed(0)} characters`);
      }
    } else {
      console.log(`❌ Status: FAILED`);
      console.log(`   Error: ${amazonResult.reason?.message || 'Unknown error'}`);
    }
    
    // Noon Results Validation
    console.log('\n\n🌙 NOON RESULTS');
    console.log('-'.repeat(80));
    if (noonResult.status === 'fulfilled' && noonResult.value) {
      const noonResults = noonResult.value;
      console.log(`✅ Status: SUCCESS`);
      console.log(`📊 Count: ${noonResults.length} products`);
      
      if (noonResults.length > 0) {
        console.log('\n📋 Sample Results:');
        noonResults.slice(0, 3).forEach((r, i) => {
          console.log(`\n  ${i + 1}. ${r.product_name || 'N/A'}`);
          console.log(`     💰 Price: ${r.currency || 'SAR'} ${r.price || 'N/A'}`);
          console.log(`     🔗 URL: ${r.url ? '✅' : '❌'} ${r.url || 'Missing'}`);
          console.log(`     🖼️  Image: ${r.image ? '✅' : '❌'} ${r.image ? (r.image.includes('placeholder') ? '⚠️  Placeholder' : r.image.substring(0, 60) + '...') : 'Missing'}`);
          console.log(`     🏪 Site: ${r.site || 'N/A'}`);
          
          // Validation checks
          const issues = [];
          if (!r.product_name || r.product_name.length < 10) {
            issues.push('⚠️  Product name too short or missing');
          }
          if (!r.url) {
            issues.push('⚠️  URL missing');
          }
          if (!r.image || r.image.includes('placeholder')) {
            issues.push('⚠️  Image missing or placeholder');
          }
          if (!r.price || r.price <= 0) {
            issues.push('⚠️  Price missing or invalid');
          }
          if (!r.site) {
            issues.push('⚠️  Site missing');
          }
          
          if (issues.length > 0) {
            console.log(`     ⚠️  Issues:`);
            issues.forEach(issue => console.log(`        ${issue}`));
          } else {
            console.log(`     ✅ All fields valid`);
          }
        });
        
        // Statistics
        const withImages = noonResults.filter(r => r.image && !r.image.includes('placeholder')).length;
        const withUrls = noonResults.filter(r => r.url).length;
        const avgNameLength = noonResults.reduce((sum, r) => sum + (r.product_name?.length || 0), 0) / noonResults.length;
        
        console.log(`\n📈 Statistics:`);
        console.log(`   • Products with real images: ${withImages}/${noonResults.length} (${((withImages/noonResults.length)*100).toFixed(1)}%)`);
        console.log(`   • Products with URLs: ${withUrls}/${noonResults.length} (${((withUrls/noonResults.length)*100).toFixed(1)}%)`);
        console.log(`   • Average product name length: ${avgNameLength.toFixed(0)} characters`);
      }
    } else {
      console.log(`❌ Status: FAILED`);
      console.log(`   Error: ${noonResult.reason?.message || 'Unknown error'}`);
    }
    
    // Combined Results
    console.log('\n\n🎯 COMBINED RESULTS');
    console.log('-'.repeat(80));
    const allResults = [
      ...(amazonResult.status === 'fulfilled' ? amazonResult.value : []),
      ...(noonResult.status === 'fulfilled' ? noonResult.value : [])
    ];
    
    console.log(`📊 Total Products: ${allResults.length}`);
    console.log(`⏱️  Average Time per Product: ${(duration / Math.max(allResults.length, 1)).toFixed(2)}s`);
    
    // UI Data Structure Validation
    console.log('\n\n🖥️  UI DATA STRUCTURE VALIDATION');
    console.log('-'.repeat(80));
    const requiredFields = ['product_name', 'site', 'price', 'currency', 'url', 'image'];
    const validationResults = allResults.map((r, i) => {
      const missing = requiredFields.filter(field => !r[field] || (field === 'image' && r[field]?.includes('placeholder')));
      return { index: i, missing, valid: missing.length === 0 };
    });
    
    const validCount = validationResults.filter(r => r.valid).length;
    console.log(`✅ Valid for UI: ${validCount}/${allResults.length} (${((validCount/allResults.length)*100).toFixed(1)}%)`);
    
    if (validCount < allResults.length) {
      console.log('\n⚠️  Products with missing/invalid fields:');
      validationResults.filter(r => !r.valid).forEach(r => {
        console.log(`   ${r.index + 1}. Missing: ${r.missing.join(', ')}`);
      });
    }
    
    // Efficiency Metrics
    console.log('\n\n⚡ EFFICIENCY METRICS');
    console.log('-'.repeat(80));
    console.log(`⏱️  Total Time: ${duration}s`);
    console.log(`📦 Products Found: ${allResults.length}`);
    console.log(`🚀 Products/Second: ${(allResults.length / duration).toFixed(2)}`);
    console.log(`💰 Price Range: ${Math.min(...allResults.map(r => r.price || Infinity))} - ${Math.max(...allResults.map(r => r.price || 0))} ${allResults[0]?.currency || 'SAR'}`);
    
    // Recommendations
    console.log('\n\n💡 RECOMMENDATIONS');
    console.log('-'.repeat(80));
    const recommendations = [];
    
    if (duration > 30) {
      recommendations.push('⏱️  Consider optimizing scraper timeouts or using faster selectors');
    }
    
    const amazonImageRate = amazonResult.status === 'fulfilled' ? 
      (amazonResult.value.filter(r => r.image).length / amazonResult.value.length) : 0;
    if (amazonImageRate < 0.8) {
      recommendations.push('🖼️  Improve Amazon image extraction rate');
    }
    
    const noonImageRate = noonResult.status === 'fulfilled' ? 
      (noonResult.value.filter(r => r.image && !r.image.includes('placeholder')).length / noonResult.value.length) : 0;
    if (noonImageRate < 0.8) {
      recommendations.push('🖼️  Improve Noon image extraction (currently using placeholders)');
    }
    
    const avgNameLen = allResults.reduce((sum, r) => sum + (r.product_name?.length || 0), 0) / allResults.length;
    if (avgNameLen < 30) {
      recommendations.push('📝 Improve product name extraction (names seem truncated)');
    }
    
    if (recommendations.length === 0) {
      console.log('✅ All systems optimal!');
    } else {
      recommendations.forEach(rec => console.log(rec));
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('VALIDATION COMPLETE');
    console.log('='.repeat(80));
  })
  .catch(err => {
    console.error('Validation failed:', err);
    process.exit(1);
  });
