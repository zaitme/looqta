/**
 * Script to add a sample Google AdSense ad to the database
 * This is for testing purposes
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./src/db/mysql');
const logger = require('./src/utils/logger');

async function addSampleAdSenseAd() {
  try {
    // Sample Google AdSense ad code (this is a placeholder - replace with real ad code)
    const sampleAdSenseCode = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-sample123456789"
     crossorigin="anonymous"></script>
<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="ca-pub-sample123456789"
     data-ad-slot="1234567890"
     data-ad-format="auto"
     data-full-width-responsive="true"></ins>
<script>
     (adsbygoogle = window.adsbygoogle || []).push({});
</script>`;

    // Check if sample ad already exists
    const [existing] = await db.execute(
      'SELECT id FROM ad_placements WHERE name = ?',
      ['Sample Google AdSense Ad']
    );

    if (existing.length > 0) {
      console.log('Sample Google AdSense ad already exists. Updating it...');
      await db.execute(
        `UPDATE ad_placements 
         SET position = ?, 
             ad_type = ?, 
             content = ?, 
             is_active = 1,
             start_date = NULL,
             end_date = NULL,
             priority = 10
         WHERE name = ?`,
        ['header', 'banner', sampleAdSenseCode, 'Sample Google AdSense Ad']
      );
      console.log('✅ Sample Google AdSense ad updated successfully!');
    } else {
      // Insert new sample ad
      await db.execute(
        `INSERT INTO ad_placements 
         (name, position, ad_type, content, image_url, link_url, is_active, priority, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'Sample Google AdSense Ad',
          'header',
          'banner',
          sampleAdSenseCode,
          null, // No image URL for Google AdSense
          null, // No link URL
          1,    // is_active
          10,   // High priority
          null, // No start date (active immediately)
          null  // No end date (never expires)
        ]
      );
      console.log('✅ Sample Google AdSense ad added successfully!');
    }

    // Also add a footer ad
    const [existingFooter] = await db.execute(
      'SELECT id FROM ad_placements WHERE name = ?',
      ['Sample Google AdSense Footer Ad']
    );

    if (existingFooter.length > 0) {
      console.log('Sample Google AdSense footer ad already exists. Updating it...');
      await db.execute(
        `UPDATE ad_placements 
         SET position = ?, 
             ad_type = ?, 
             content = ?, 
             is_active = 1,
             start_date = NULL,
             end_date = NULL,
             priority = 10
         WHERE name = ?`,
        ['footer', 'banner', sampleAdSenseCode, 'Sample Google AdSense Footer Ad']
      );
      console.log('✅ Sample Google AdSense footer ad updated successfully!');
    } else {
      await db.execute(
        `INSERT INTO ad_placements 
         (name, position, ad_type, content, image_url, link_url, is_active, priority, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'Sample Google AdSense Footer Ad',
          'footer',
          'banner',
          sampleAdSenseCode,
          null,
          null,
          1,
          10,
          null,
          null
        ]
      );
      console.log('✅ Sample Google AdSense footer ad added successfully!');
    }

    // Verify the ads were added
    const [ads] = await db.execute(
      'SELECT id, name, position, is_active FROM ad_placements WHERE name LIKE ?',
      ['Sample Google AdSense%']
    );

    console.log('\n📊 Sample ads in database:');
    ads.forEach(ad => {
      console.log(`  - ${ad.name} (ID: ${ad.id}, Position: ${ad.position}, Active: ${ad.is_active})`);
    });

    console.log('\n✅ Done! You can now check the frontend to see the ads.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding sample ad:', error);
    process.exit(1);
  }
}

addSampleAdSenseAd();
