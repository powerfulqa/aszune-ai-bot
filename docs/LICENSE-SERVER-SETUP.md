# License Server Setup & Monitoring Guide

## 🖥️ Setting Up Your License Server

### 1. Server Requirements
- **VPS/Cloud Server** (DigitalOcean, AWS, etc.)
- **Node.js 18+**
- **Domain name** (optional but recommended)
- **SSL Certificate** (Let's Encrypt)

### 2. Environment Setup

Create `.env` file on your server:
```env
LICENSE_SERVER_API_KEY=your-secure-api-key-here
PORT=3001
NODE_ENV=production
```

### 3. Running the License Server

```bash
# On your server
git clone https://github.com/chrishaycock/aszune-ai-bot.git
cd aszune-ai-bot
npm install
node src/utils/license-server.js
```

### 4. Process Management (Production)

```bash
# Using PM2 for auto-restart
npm install -g pm2
pm2 start src/utils/license-server.js --name "license-server"
pm2 startup
pm2 save
```

## 📊 Monitoring Dashboard

### Access Your Dashboard
- **Local**: http://localhost:3001/dashboard
- **Production**: https://your-domain.com:3001/dashboard

### Real-time Monitoring
The dashboard shows:
- ✅ **Total Licenses**: How many you've issued
- ✅ **Active Instances**: Currently running bots
- ❌ **Violations**: Unauthorized usage attempts
- 📈 **Usage Stats**: Performance and activity data

## 🚨 Violation Detection

### What Gets Reported
```json
{
  "instanceId": "abc123def456",
  "timestamp": "2025-10-01T12:00:00.000Z",
  "hostname": "unauthorized-server",
  "platform": "linux",
  "violation": "unlicensed_usage",
  "serverInfo": {
    "nodeVersion": "v20.18.1",
    "uptime": 3600
  }
}
```

### Automatic Actions
1. **Immediate**: Bot logs violation locally
2. **Phone Home**: Reports to your license server
3. **Grace Period**: 7 days for new users
4. **Termination**: Bot shuts down after grace period

## 🔍 How to Handle Violations

### 1. Monitor Dashboard
- Check `/dashboard` daily for new violations
- Review violation reports in real-time
- Track repeat offenders

### 2. Investigation Steps
```bash
# Check violation logs
tail -f data/violations/*.json

# Look up hostname/IP
nslookup unauthorized-server

# Check GitHub for forks/issues
```

### 3. Enforcement Actions

#### Option A: Contact Direct
```
Hi there,

I noticed you're running Aszune AI Bot without a license. 
The software detected instance ID: abc123def456

Please register for a free personal license at:
https://github.com/chrishaycock/aszune-ai-bot/issues

Or contact me for commercial licensing options.

Best regards,
Chris
```

#### Option B: DMCA Takedown (if hosted publicly)
- File DMCA with hosting provider
- Report to Discord if it's a public bot
- Document for legal action

#### Option C: Legal Notice (commercial violations)
```
NOTICE OF LICENSE VIOLATION

Your use of Aszune AI Bot software without proper licensing 
violates our terms of service. 

Commercial use requires a $299/month license.
Please contact us within 7 days to resolve this matter.

Continued violation may result in legal action and damages 
up to $100,000 as specified in our license terms.
```

## 📧 License Management Workflow

### Issuing New Licenses

1. **Personal License** (Free):
```bash
# Generate license key
ASZUNE-PERS-$(date +%Y%m%d)-$(openssl rand -hex 4 | tr '[:lower:]' '[:upper:]')

# Add to licenses.json
{
  "key": "ASZUNE-PERS-20251001-A1B2C3D4",
  "type": "personal",
  "status": "active",
  "allowedServers": 1,
  "owner": "user@email.com",
  "createdAt": "2025-10-01T12:00:00Z",
  "expiresAt": null
}
```

2. **Commercial License** ($299/month):
```bash
# Generate commercial key
ASZUNE-COMM-$(date +%Y%m%d)-$(openssl rand -hex 4 | tr '[:lower:]' '[:upper:]')
```

### License Validation API

Your bots will call:
```http
POST https://your-server.com/api/validate
Authorization: Bearer your-api-key
Content-Type: application/json

{
  "licenseKey": "ASZUNE-PERS-20251001-A1B2C3D4",
  "instanceId": "abc123def456",
  "systemInfo": { "hostname": "...", "platform": "..." }
}
```

Response:
```json
{
  "valid": true,
  "licenseType": "personal", 
  "allowedServers": 1,
  "features": ["basic_analytics"]
}
```

## 🔧 Configuration for Bot Users

### Personal License Setup
```bash
# User sets environment variable
export ASZUNE_LICENSE_KEY="ASZUNE-PERS-20251001-A1B2C3D4"
export ASZUNE_LICENSE_SERVER="https://your-server.com"
export ASZUNE_LICENSE_API_KEY="your-api-key"

# Bot validates on startup
npm start
```

## 📈 Revenue Tracking

### Monthly Revenue Dashboard
```javascript
// Calculate monthly recurring revenue
const monthlyRevenue = {
  personal: freeLicenses * 0,      // Free
  community: communityLicenses * 29,   // $29/month
  commercial: commercialLicenses * 299, // $299/month
  enterprise: enterpriseDeals          // Custom pricing
};
```

## ⚠️ Privacy & Legal Considerations

### Data Collected
- **Instance ID**: Unique machine fingerprint
- **Hostname**: For violation tracking
- **Platform/OS**: System information
- **Usage Stats**: Performance metrics
- **License Key**: For validation

### Data Protection
- Store minimal necessary data
- Hash sensitive information
- Delete old violation reports (90 days)
- Provide data deletion on request

### Legal Compliance
- Include data collection notice in license
- Provide privacy policy
- Honor data deletion requests
- Document license violations for legal action

## 🚀 Scaling Your License Server

### High Availability
```bash
# Load balancer + multiple instances
pm2 start ecosystem.config.js
```

### Database Integration
```javascript
// Replace Map() with proper database
const licenses = await db.licenses.findAll();
const violations = await db.violations.create(report);
```

### Monitoring & Alerts
```bash
# Set up monitoring
curl -f http://localhost:3001/health || alert-script.sh
```

This setup gives you complete control and visibility into who's using your bot! 🎯