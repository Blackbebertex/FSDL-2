# ⚡ ONE-COMMAND AUTO SETUP

## 🚀 Just Run This!

### Windows Users
```batch
setup.bat
```

### Mac/Linux Users
```bash
bash setup.sh
```

### Or Use npm (All Platforms)
```bash
npm run setup
```

---

## ✅ What Gets Automated

The setup script automatically:
- ✅ Checks Node.js and npm
- ✅ Installs all dependencies
- ✅ Creates .env file if missing
- ✅ Builds the project
- ✅ Runs linting checks
- ✅ Shows next steps

---

## 📋 What You Need to Do After Setup

### 1️⃣ Add API Key (2 min)

**Get API Key:**
1. Go to https://console.anthropic.com/
2. Sign up or login
3. Create API key

**Add to .env:**
```bash
# Edit .env file
ANTHROPIC_API_KEY=sk-ant-v0-...
```

### 2️⃣ Start Development Server
```bash
npm run dev
```

### 3️⃣ Open in Browser
```
http://localhost:5173
```

### 4️⃣ Test the Feature
- Login to app
- Go to Exams section  
- Click "📄 Upload Syllabus"
- Upload a PDF
- Verify extraction works

---

## ⏱️ Total Time

| Step | Time |
|------|------|
| Run setup script | 2-3 min |
| Add API key | 2 min |
| Start server | 1 min |
| Test feature | 2 min |
| **TOTAL** | **~10 min** |

---

## 🎯 Key Commands

```bash
# Setup everything
npm run setup

# Start development
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Run tests
npm run test

# Full CI pipeline (lint + test + build)
npm run ci
```

---

## 📁 Setup Scripts Included

| File | OS | Use |
|------|----|----|
| setup.bat | Windows | Double-click to run |
| setup.sh | Mac/Linux | Run: bash setup.sh |

---

## ✨ What's Included in Setup

```
✅ Dependencies installed
✅ Environment configured
✅ Project built
✅ Code validated
✅ Ready to run
```

---

## 🔍 Manual Setup (If Scripts Fail)

```bash
# 1. Install dependencies
npm install

# 2. Create .env file
# Copy .env.example or create manually:
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/examflow
VITE_API_URL=http://localhost:3001/api
ANTHROPIC_API_KEY=your_key_here

# 3. Build project
npm run build

# 4. Start server
npm run dev
```

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| setup.bat won't run | Right-click → Run as Administrator |
| npm command not found | Install Node.js from nodejs.org |
| Build fails | Delete node_modules, run npm install again |
| Port 3001 in use | Change PORT in .env |
| API key error | Add key to .env and restart server |

---

## 📚 Documentation

After setup, read:
1. **QUICK_START.md** - Quick reference
2. **SYLLABUS_UPLOAD_GUIDE.md** - Full guide
3. **README_UPDATES.md** - All features

---

**Everything is automated. Just run the setup script and add your API key!** 🚀
