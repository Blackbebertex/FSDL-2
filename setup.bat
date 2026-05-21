@echo off
REM Syllabus Upload Feature - Automated Setup Script (Windows)
REM This script automates the entire setup process

echo.
echo ================================================
echo.
echo  🚀 SYLLABUS UPLOAD FEATURE - AUTO SETUP
echo.
echo ================================================
echo.

REM Check Node.js
echo 📋 Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo ✅ Node.js found: %NODE_VER%
echo.

REM Check npm
echo 📋 Checking npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm not found. Please install npm first.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do set NPM_VER=%%i
echo ✅ npm found: %NPM_VER%
echo.

REM Install dependencies
echo 📦 Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ npm install failed
    pause
    exit /b 1
)
echo ✅ Dependencies installed
echo.

REM Check .env
echo ⚙️  Checking environment configuration...
if not exist ".env" (
    echo 📝 Creating .env file...
    (
        echo PORT=3001
        echo MONGODB_URI=mongodb://127.0.0.1:27017/examflow
        echo VITE_API_URL=http://localhost:3001/api
        echo ANTHROPIC_API_KEY=your_anthropic_api_key_here
    ) > .env
)

REM Check if API key is set
findstr /M "your_anthropic_api_key_here" .env >nul
if %errorlevel% equ 0 (
    echo.
    echo ⚠️  IMPORTANT: API Key not configured
    echo.
    echo 📌 To get your Anthropic API key:
    echo    1. Go to: https://console.anthropic.com/
    echo    2. Sign up or login
    echo    3. Create an API key
    echo    4. Edit .env and replace 'your_anthropic_api_key_here' with your key
    echo.
    echo    Example:
    echo    ANTHROPIC_API_KEY=sk-ant-v0-...
    echo.
) else (
    echo ✅ API key configured
)
echo.

REM Build project
echo 🔨 Building project...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)
echo ✅ Build complete
echo.

REM Summary
echo ================================================
echo ✅ SETUP COMPLETE!
echo ================================================
echo.
echo 📝 Next steps:
echo.
echo 1. ⚙️  Configure API Key (if not done^):
echo    Edit .env and add your Anthropic API key
echo.
echo 2. 🚀 Start development server:
echo    npm run dev
echo.
echo 3. 🌐 Open browser:
echo    http://localhost:5173
echo.
echo 4. ✅ Test the feature:
echo    - Login to the app
echo    - Go to Exams section
echo    - Click '📄 Upload Syllabus'
echo    - Upload a PDF
echo.
echo 📚 Documentation:
echo    - QUICK_START.md - Quick reference
echo    - SYLLABUS_UPLOAD_GUIDE.md - Full guide
echo.
echo ================================================
echo.
pause
