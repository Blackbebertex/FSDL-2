# 🎯 MASTER SETUP GUIDE - Everything Automated

## 📌 TL;DR (3 Steps)

### For Windows
```batch
setup.bat
```

### For Mac/Linux
```bash
bash setup.sh
```

### For Everyone
```bash
npm run setup && npm run dev
```

Then add your API key to `.env` and you're done!

Note: Demo credentials are included only for local development when `EXAMFLOW_USERS_JSON` is not configured. For production, populate `EXAMFLOW_USERS_JSON` with your users and roles — the server will refuse to start in production without this setting to prevent unsecured fallback accounts.

---

## 🎬 START HERE

### Step 1: Get API Key (2 min)
1. Visit: https://console.anthropic.com/
2. Create account if needed
3. Create new API key
4. Copy the key

### Step 2: Add API Key (1 min)
Edit `.env` file:
```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### Step 3: Run Setup (2 min)

**Windows Users:**
- Double-click `setup.bat`

**Mac/Linux Users:**
- Run: `bash setup.sh`

**Everyone:**
- Run: `npm run setup`

That's it! 🎉

---

## 📊 What Gets Automated

### Automatic Installation
```
setup.bat / setup.sh / npm run setup
    ↓
Checks Node.js & npm
    ↓
Installs dependencies (npm install)
    ↓
Creates .env file
    ↓
Builds project
    ↓
Runs linting
    ↓
✅ Ready to use!
```

### After Setup
```bash
npm run dev
```

Then:
- Open browser: http://localhost:5173
- Login to app
- Go to Exams section
- Click "📄 Upload Syllabus"
- Upload PDF
- Test extraction

Note about cookies & cross-origin requests:
- The server sets an httpOnly cookie `examflow.session` on login. For local development this works out-of-the-box; for cross-origin setups (frontend on a different host), ensure `CLIENT_ORIGIN` is set and that your frontend requests use `fetch(..., { credentials: 'include' })`.
- In production, if frontend and backend are on different domains, configure the cookie with `SameSite=None; Secure` and serve over HTTPS.

---

## 🎯 Setup Methods

### Method 1: Windows Only (Easiest)
```
Right-click setup.bat → Run
```
**Pro**: Double-click, nothing else needed  
**Con**: Windows only

### Method 2: Mac/Linux Only (Easiest)
```bash
bash setup.sh
```
**Pro**: Built-in shell script  
**Con**: Unix only

### Method 3: Cross-Platform (Recommended)
```bash
npm run setup
npm run dev
```
**Pro**: Works on all OS, simple commands  
**Con**: Need to run two commands

### Method 4: Docker (Most Complete)
```bash
docker-compose -f docker-compose.prod.yml up -d
```
**Pro**: Everything included (app + MongoDB)  
**Con**: Requires Docker installation

### Method 5: Manual (If others fail)
```bash
npm install
npm run build
npm run dev
```
**Pro**: Maximum control  
**Con**: More steps

---

## 📋 Automated Features

### ✅ Installation
- Node.js check
- npm check  
- Dependency install
- Build verification

### ✅ Configuration
- .env creation
- API key validation
- Port configuration
- Database setup

### ✅ Quality Assurance
- Code linting
- Build checks
- Health verification

### ✅ Docker (Optional)
- Container building
- MongoDB setup
- Volume mounting
- Health checks

---

## ⏱️ Time Breakdown

| Step | Time | What Happens |
|------|------|--------------|
| Get API key | 2 min | Manual (visit website) |
| Add to .env | 1 min | Edit file |
| Run setup | 2 min | Automated |
| **TOTAL** | **5 min** | Ready to use |

---

## 🎁 What's Included

### 📦 Installation Scripts
- `setup.bat` - Windows automated setup
- `setup.sh` - Mac/Linux automated setup
- `npm run setup` - Cross-platform setup

### 🐳 Docker Files
- `Dockerfile.prod` - Production container
- `docker-compose.prod.yml` - Full stack

### 📚 Documentation
- `AUTO_SETUP.md` - Quick auto setup guide
- `DOCKER_SETUP.md` - Docker deployment guide
- `AUTOMATED_SETUP.md` - Automation details
- `QUICK_START.md` - Quick reference
- Plus 5 more guides

### ✅ Verified & Tested
- npm install ✅
- npm run build ✅
- npm run lint ✅
- Code quality ✅
- Security review ✅

---

## 🚀 Quick Commands

```bash
# Setup everything
npm run setup

# Start development
npm run dev

# Build for production  
npm run build

# Start production server
npm start

# Check code quality
npm run lint

# Run tests
npm run test

# Docker (after setup)
docker-compose -f docker-compose.prod.yml up -d
```

---

## 🔍 File Overview

### Setup Files
- `setup.bat` - Windows setup script
- `setup.sh` - Mac/Linux setup script
- `AUTO_SETUP.md` - Setup documentation

### Docker Files  
- `Dockerfile.prod` - Container config
- `docker-compose.prod.yml` - Stack config
- `DOCKER_SETUP.md` - Docker guide

### Documentation
- `AUTOMATED_SETUP.md` - Automation guide
- `QUICK_START.md` - Quick reference
- `SYLLABUS_UPLOAD_GUIDE.md` - Full guide
- Plus others...

---

## ✨ Features Included

### Syllabus Upload
- PDF file upload
- Claude AI extraction
- Auto form population
- Error handling

### Security
- Authentication required
- API key protection
- Input validation
- File cleanup

### UI/UX
- Modal interface
- Error messages
- Responsive design
- Progress feedback

---

## 🎯 Your Next Action

### 1. Choose Your Method

- **Windows?** → Run `setup.bat`
- **Mac/Linux?** → Run `bash setup.sh`
- **Any OS?** → Run `npm run setup`
- **Want Docker?** → See DOCKER_SETUP.md

### 2. Add API Key
Edit `.env` and add your Anthropic API key

### 3. Start Server
Run `npm run dev`

### 4. Test Feature
Upload a PDF and test extraction

---

## 🆘 Help

| Problem | Solution |
|---------|----------|
| setup.bat won't run | Right-click → "Run as Administrator" |
| npm command not found | Install Node.js from nodejs.org |
| Build fails | Run: `npm install` then try again |
| API key error | Add key to .env and restart |
| Port 3001 in use | Change PORT in .env |

---

## ✅ Verification Checklist

After setup, you should have:
- ✅ Node.js installed
- ✅ Dependencies installed
- ✅ .env file created
- ✅ Project built
- ✅ Ready to run

---

## 🎉 Summary

**Everything is automated.** Just:

1. Get API key (2 min - manual)
2. Add to .env (1 min - manual)
3. Run setup (2 min - automated)
4. Run dev server (1 min - manual)
5. Test in browser (instant)

**Total: ~5 minutes to working app** ⚡

---

## 📞 Final Notes

- Scripts handle all setup
- Docker available for production
- Documentation is comprehensive
- Everything is tested
- All quality checks passed

**You're ready to go!** 🚀

Choose your setup method above and start!
