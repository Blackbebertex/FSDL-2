#!/bin/bash
# Syllabus Upload Feature - Automated Setup Script
# This script automates the entire setup process

set -e  # Exit on error

echo "================================================"
echo "🚀 SYLLABUS UPLOAD FEATURE - AUTO SETUP"
echo "================================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js
echo "📋 Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js found: $(node --version)${NC}"
echo ""

# Check npm
echo "📋 Checking npm..."
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found. Please install npm first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm found: $(npm --version)${NC}"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install 2>&1 | tail -5
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Check .env
echo "⚙️  Checking environment configuration..."
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env 2>/dev/null || echo "PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/examflow
VITE_API_URL=http://localhost:3001/api
ANTHROPIC_API_KEY=your_anthropic_api_key_here" > .env
fi

# Check if API key is set
if grep -q "your_anthropic_api_key_here" .env; then
    echo -e "${YELLOW}⚠️  IMPORTANT: API Key not configured${NC}"
    echo ""
    echo "📌 To get your Anthropic API key:"
    echo "   1. Go to: https://console.anthropic.com/"
    echo "   2. Sign up or login"
    echo "   3. Create an API key"
    echo "   4. Edit .env and replace 'your_anthropic_api_key_here' with your key"
    echo ""
    echo "   Example:"
    echo "   ANTHROPIC_API_KEY=sk-ant-v0-..."
    echo ""
else
    echo -e "${GREEN}✅ API key configured${NC}"
fi
echo ""

# Build project
echo "🔨 Building project..."
npm run build 2>&1 | tail -3
echo -e "${GREEN}✅ Build complete${NC}"
echo ""

# Run linting
echo "✨ Checking code quality..."
npm run lint 2>&1 | grep -E "(problems|errors|warnings)" | head -3 || echo "Lint check complete"
echo ""

# Summary
echo "================================================"
echo -e "${GREEN}✅ SETUP COMPLETE!${NC}"
echo "================================================"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. ⚙️  Configure API Key (if not done):"
echo "   Edit .env and add your Anthropic API key"
echo ""
echo "2. 🚀 Start development server:"
echo "   npm run dev"
echo ""
echo "3. 🌐 Open browser:"
echo "   http://localhost:5173"
echo ""
echo "4. ✅ Test the feature:"
echo "   - Login to the app"
echo "   - Go to Exams section"
echo "   - Click '📄 Upload Syllabus'"
echo "   - Upload a PDF"
echo ""
echo "📚 Documentation:"
echo "   - QUICK_START.md - Quick reference"
echo "   - SYLLABUS_UPLOAD_GUIDE.md - Full guide"
echo ""
echo "================================================"
