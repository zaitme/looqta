/**
 * Verify and fix ROAR admin password hash
 * This script checks if the password hash matches the expected password
 * and regenerates it if needed
 */

const db = require('./src/db/mysql');
const bcrypt = require('bcrypt');
const logger = require('./src/utils/logger');

async function verifyAndFixPassword() {
  try {
    console.log('🔍 Verifying ROAR admin password...\n');
    
    // Get the user from database
    const [users] = await db.execute(
      `SELECT id, username, password_hash, salt FROM admin_users WHERE username = 'zaitme'`
    );
    
    if (users.length === 0) {
      console.log('❌ User "zaitme" not found in database');
      process.exit(1);
    }
    
    const user = users[0];
    console.log('📋 Current User Data:');
    console.log(`   Username: ${user.username}`);
    console.log(`   Password Hash: ${user.password_hash}`);
    console.log(`   Salt: ${user.salt}`);
    console.log('');
    
    // Expected password from .env and documentation
    const expectedPassword = 'highrise';
    
    // Test if current hash matches expected password
    console.log('🔐 Testing password verification...');
    const isValid = await bcrypt.compare(expectedPassword, user.password_hash);
    
    if (isValid) {
      console.log('✅ Password hash is valid! Login should work.');
      console.log(`   Password "${expectedPassword}" matches the stored hash.\n`);
    } else {
      console.log('❌ Password hash does NOT match expected password!');
      console.log('   Regenerating password hash...\n');
      
      // Generate new hash
      const saltRounds = 12;
      const salt = await bcrypt.genSalt(saltRounds);
      const hash = await bcrypt.hash(expectedPassword, salt);
      
      console.log('📝 New Hash Generated:');
      console.log(`   Hash: ${hash}`);
      console.log(`   Salt: ${salt}`);
      console.log('');
      
      // Update database
      await db.execute(
        `UPDATE admin_users 
         SET password_hash = ?, salt = ?, failed_login_attempts = 0, locked_until = NULL
         WHERE username = 'zaitme'`,
        [hash, salt]
      );
      
      console.log('✅ Password hash updated in database!');
      
      // Verify the update worked
      const [updated] = await db.execute(
        `SELECT password_hash FROM admin_users WHERE username = 'zaitme'`
      );
      
      const verifyNew = await bcrypt.compare(expectedPassword, updated[0].password_hash);
      if (verifyNew) {
        console.log('✅ Verification: New password hash works correctly!\n');
      } else {
        console.log('❌ Verification failed: New hash still does not work!\n');
        process.exit(1);
      }
    }
    
    console.log('✨ Password verification complete!');
    console.log('\n📝 Login Credentials:');
    console.log('   Username: zaitme');
    console.log('   Password: highrise');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

verifyAndFixPassword();
