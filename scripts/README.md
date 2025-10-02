# Aszune AI Bot - License Generation Scripts

Automated license key generation and management tools for Aszune AI Bot v1.6.0.

## 🔑 **Quick Start**

### **Windows (Command Prompt)**
```cmd
# Generate personal license (FREE)
scripts\generate-license.bat personal

# Generate and save commercial license
scripts\generate-license.bat commercial 1 save user@company.com
```

### **Windows (PowerShell)**
```powershell
# Generate personal license
.\scripts\generate-license.ps1 -Type personal

# Generate and save enterprise license
.\scripts\generate-license.ps1 -Type enterprise -Count 1 -Save -Email "user@company.com"
```

### **Cross-Platform (Node.js)**
```bash
# Generate personal license
node scripts/generate-license.js personal

# Generate multiple community licenses and save
node scripts/generate-license.js community 5 --save

# Generate enterprise license with email assignment
node scripts/generate-license.js enterprise 1 --email "ceo@company.com" --save
```

## 📋 **License Types**

| Type | Code | Price | Max Servers | Features |
|------|------|-------|-------------|----------|
| **Personal** | `PERS` | FREE | 1 | Basic analytics, Dashboard access |
| **Community** | `COMM` | $29/month | 5 | Full analytics, Performance monitoring |
| **Commercial** | `BIZZ` | $299/month | Unlimited | Enterprise analytics, Priority support |
| **Enterprise** | `ENTR` | Custom | Unlimited | Full platform, Custom integrations |

## 🚀 **Usage Examples**

### **Personal License (Free)**
```bash
# Generate single personal license
node scripts/generate-license.js personal

# Output includes GitHub response template for easy copy/paste
```

### **Commercial License**
```bash
# Generate commercial license and save to database
node scripts/generate-license.js commercial 1 --email "customer@business.com" --save

# Creates license in data/licenses.json with 1-month expiry
```

### **Bulk Generation**
```bash
# Generate 10 personal licenses for giveaway
node scripts/generate-license.js personal 10 --save

# Generate 5 community licenses for beta testers
node scripts/generate-license.js community 5 --save
```

## 📁 **Files Created**

- **`data/licenses.json`** - License database (auto-created)
- **`data/violations/`** - Violation reports directory
- **GitHub response template** - Ready-to-copy license approval message

## 🎯 **Workflow Integration**

### **1. GitHub Issue Response**
When someone requests a license via GitHub issue:
```bash
# Generate appropriate license
node scripts/generate-license.js personal 1 --email "user@example.com" --save

# Copy the GitHub response template from output
# Paste into GitHub issue as reply
```

### **2. License Database Management**
```bash
# View license database
type data\licenses.json

# Or use license server dashboard
node src/utils/license-server.js
# Visit: http://localhost:3001/dashboard
```

### **3. Automated Distribution**
The script generates ready-to-use templates with:
- ✅ License key
- ✅ Setup instructions (Windows/Linux/Mac)
- ✅ Feature details
- ✅ Expiry information
- ✅ Support links

## 🔐 **Security Features**

- **Crypto-secure random generation** using Node.js `crypto.randomInt()`
- **Unique format validation** `ASZUNE-XXXX-XXXX-XXXX-XXXX`
- **Database persistence** with JSON storage
- **Usage tracking** for compliance monitoring
- **Expiry management** for paid licenses

## 📊 **License Database Format**

```json
{
  "key": "ASZUNE-BIZZ-A1B2-C3D4-E5F6",
  "type": "commercial",
  "status": "active",
  "allowedServers": -1,
  "owner": "customer@company.com",
  "createdAt": "2025-10-02T12:00:00.000Z",
  "expiresAt": "2025-11-02T12:00:00.000Z",
  "features": ["Enterprise analytics", "Priority support"],
  "price": "$299/month",
  "instanceId": null,
  "usage": {
    "activatedAt": null,
    "lastSeen": null,
    "totalSessions": 0,
    "totalCommands": 0
  }
}
```

## ⚡ **Tips & Best Practices**

1. **Always use `--save`** for production licenses to maintain database
2. **Include email assignment** for tracking and support
3. **Use GitHub response template** for consistent communication
4. **Monitor license database** regularly for compliance
5. **Set up license server** for automated validation

## 🔧 **Integration with License System**

Generated licenses work seamlessly with:
- **License Validator** (`src/utils/license-validator.js`)
- **License Server** (`src/utils/license-server.js`)
- **Bot startup validation** (automatic license checking)
- **Analytics features** (feature gating by license tier)

## 📞 **Support**

- **Issues**: [GitHub Issues](https://github.com/powerfulqa/aszune-ai-bot/issues)
- **Documentation**: [Main README](../README.md)
- **License Server**: `http://localhost:3001/dashboard`

---

**🎉 You now have a complete automated license generation system for professional Discord bot licensing!**