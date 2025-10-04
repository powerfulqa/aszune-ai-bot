#!/usr/bin/env node
/**
 * Automated License Key Generation Script
 * Generates license keys for Aszune AI Bot v1.6.0
 *
 * Usage:
 *   node scripts/generate-license.js personal 5
 *   node scripts/generate-license.js commercial 1 --save
 *   node scripts/generate-license.js enterprise 1 --email user@example.com --save
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class LicenseGenerator {
  constructor() {
    this.licenseTypes = {
      personal: {
        code: 'PERS',
        name: 'Personal License',
        price: 'FREE',
        features: ['Basic analytics', 'Dashboard access', 'Personal use only'],
        maxServers: 1,
        expires: null,
      },
      community: {
        code: 'COMM',
        name: 'Community License',
        price: '$29/month',
        features: ['Full analytics', 'Performance monitoring', 'Up to 5 servers'],
        maxServers: 5,
        expires: this.addMonths(new Date(), 1),
      },
      commercial: {
        code: 'BIZZ',
        name: 'Commercial License',
        price: '$299/month',
        features: ['Enterprise analytics', 'Priority support', 'Unlimited servers'],
        maxServers: -1, // unlimited
        expires: this.addMonths(new Date(), 1),
      },
      enterprise: {
        code: 'ENTR',
        name: 'Enterprise License',
        price: 'Custom pricing',
        features: ['Full platform', 'Custom integrations', 'Dedicated support'],
        maxServers: -1, // unlimited
        expires: this.addMonths(new Date(), 12),
      },
    };

    this.dataDir = path.join(__dirname, '../data');
    this.licensesFile = path.join(this.dataDir, 'licenses.json');
  }

  /**
   * Add months to date
   */
  addMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result.toISOString();
  }

  /**
   * Generate secure random string
   */
  generateSecureRandom(length = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, chars.length);
      result += chars[randomIndex];
    }

    return result;
  }

  /**
   * Generate license key
   */
  generateLicenseKey(type = 'personal') {
    if (!this.licenseTypes[type]) {
      throw new Error(
        `Invalid license type: ${type}. Valid types: ${Object.keys(this.licenseTypes).join(', ')}`
      );
    }

    const typeInfo = this.licenseTypes[type];
    const id = this.generateSecureRandom(4);
    const part1 = this.generateSecureRandom(4);
    const part2 = this.generateSecureRandom(4);

    return `ASZUNE-${typeInfo.code}-${id}-${part1}-${part2}`;
  }

  /**
   * Generate multiple license keys
   */
  generateMultipleKeys(type = 'personal', count = 1, options = {}) {
    const licenses = [];

    for (let i = 0; i < count; i++) {
      const key = this.generateLicenseKey(type);
      const typeInfo = this.licenseTypes[type];

      const license = {
        key,
        type,
        status: 'active',
        allowedServers: typeInfo.maxServers,
        owner: options.email || 'unassigned',
        createdAt: new Date().toISOString(),
        expiresAt: typeInfo.expires,
        features: typeInfo.features,
        price: typeInfo.price,
        instanceId: null, // Will be set when activated
        usage: {
          activatedAt: null,
          lastSeen: null,
          totalSessions: 0,
          totalCommands: 0,
        },
      };

      licenses.push(license);
    }

    return licenses;
  }

  /**
   * Save licenses to database
   */
  async saveLicenses(licenses) {
    try {
      // Ensure data directory exists
      await fs.mkdir(this.dataDir, { recursive: true });

      // Load existing licenses
      let existingLicenses = [];
      try {
        const data = await fs.readFile(this.licensesFile, 'utf8');
        existingLicenses = JSON.parse(data);
      } catch (error) {
        // File doesn't exist, start fresh
        console.log('📄 Creating new license database');
      }

      // Add new licenses
      const allLicenses = [...existingLicenses, ...licenses];

      // Save to file
      await fs.writeFile(this.licensesFile, JSON.stringify(allLicenses, null, 2));

      console.log(`💾 Saved ${licenses.length} license(s) to database`);
      console.log(`📊 Total licenses in database: ${allLicenses.length}`);
    } catch (error) {
      console.error('❌ Failed to save licenses:', error.message);
      throw error;
    }
  }

  /**
   * Generate GitHub issue template
   */
  generateGitHubResponse(licenses, type) {
    const license = licenses[0]; // Use first license for template
    const typeInfo = this.licenseTypes[type];

    return `🎉 **${typeInfo.name} Approved!**

**License Key:** \`${license.key}\`

## 🚀 **Setup Instructions**

### 1. **Add License to Environment**
\`\`\`bash
# Windows (Command Prompt)
set ASZUNE_LICENSE_KEY=${license.key}

# Windows (PowerShell)  
$env:ASZUNE_LICENSE_KEY="${license.key}"

# Linux/Mac
export ASZUNE_LICENSE_KEY="${license.key}"
\`\`\`

### 2. **Or Add to .env File**
\`\`\`env
ASZUNE_LICENSE_KEY=${license.key}
DISCORD_TOKEN=your_discord_token
PERPLEXITY_API_KEY=your_perplexity_key
\`\`\`

### 3. **Restart Your Bot**
\`\`\`bash
npm start
\`\`\`

## 📋 **License Details**
- **Type:** ${typeInfo.name}
- **Price:** ${typeInfo.price}
- **Max Servers:** ${typeInfo.maxServers === -1 ? 'Unlimited' : typeInfo.maxServers}
- **Expires:** ${license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : 'Never'}

## ✨ **Features Included**
${typeInfo.features.map((f) => `- ${f}`).join('\n')}

## 🔧 **Verification**
After setup, your bot will show:
\`\`\`
✅ License validated: ${typeInfo.name}
🚀 All features unlocked
\`\`\`

## 📞 **Support**
- Issues: [GitHub Issues](https://github.com/powerfulqa/aszune-ai-bot/issues)
- Documentation: [README.md](https://github.com/powerfulqa/aszune-ai-bot/blob/main/README.md)

**License Key:** \`${license.key}\`
**Status:** Active ✅`;
  }

  /**
   * Display license information
   */
  displayLicenses(licenses, type) {
    const typeInfo = this.licenseTypes[type];

    console.log(`\n🔑 Generated ${licenses.length} ${typeInfo.name}(s):`);
    console.log('═'.repeat(60));

    licenses.forEach((license, i) => {
      console.log(`\n📍 License ${i + 1}:`);
      console.log(`   Key: ${license.key}`);
      console.log(`   Type: ${typeInfo.name} (${typeInfo.price})`);
      console.log(`   Owner: ${license.owner}`);
      console.log(
        `   Max Servers: ${license.allowedServers === -1 ? 'Unlimited' : license.allowedServers}`
      );
      console.log(
        `   Expires: ${license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : 'Never'}`
      );
      console.log(`   Features: ${typeInfo.features.join(', ')}`);
    });

    console.log('\n' + '═'.repeat(60));
  }

  /**
   * Main execution
   */
  async run() {
    const args = process.argv.slice(2);

    // Parse arguments
    const type = args[0] || 'personal';
    const count = parseInt(args[1]) || 1;
    const shouldSave = args.includes('--save');
    const emailIndex = args.indexOf('--email');
    const email = emailIndex !== -1 ? args[emailIndex + 1] : null;

    // Validate inputs
    if (count < 1 || count > 100) {
      console.error('❌ Count must be between 1 and 100');
      process.exit(1);
    }

    try {
      // Generate licenses
      const licenses = this.generateMultipleKeys(type, count, { email });

      // Display results
      this.displayLicenses(licenses, type);

      // Save if requested
      if (shouldSave) {
        await this.saveLicenses(licenses);
      }

      // Generate GitHub response template for single licenses
      if (count === 1) {
        console.log('\n📝 GitHub Response Template:');
        console.log('═'.repeat(60));
        console.log(this.generateGitHubResponse(licenses, type));
        console.log('═'.repeat(60));
      }

      console.log('\n✅ License generation complete!');
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
}

// Show usage if no arguments
if (process.argv.length < 3) {
  console.log(`
🔑 **Aszune AI Bot - License Generator v1.6.0**

**Usage:**
  node scripts/generate-license.js <type> [count] [options]

**License Types:**
  personal    - Personal License (FREE) - 1 server
  community   - Community License ($29/month) - 5 servers  
  commercial  - Commercial License ($299/month) - Unlimited
  enterprise  - Enterprise License (Custom) - Unlimited

**Options:**
  --save              Save to license database
  --email <email>     Assign to specific email

**Examples:**
  node scripts/generate-license.js personal
  node scripts/generate-license.js commercial 1 --save
  node scripts/generate-license.js personal 5 --email user@example.com --save
  node scripts/generate-license.js enterprise 1 --email company@example.com --save

**Files:**
  - Licenses saved to: data/licenses.json
  - GitHub response template included for easy copy/paste
`);
  process.exit(0);
}

// Run the generator
const generator = new LicenseGenerator();
generator.run().catch(console.error);
