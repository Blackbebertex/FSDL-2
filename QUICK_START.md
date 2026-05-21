# 🚀 Quick Start Guide - Syllabus Upload

## 1. Get Anthropic API Key (5 min)
1. Go to https://console.anthropic.com/
2. Sign up or login
3. Create API key
4. Copy the key

## 2. Configure Environment (2 min)
Edit `.env`:
```env
ANTHROPIC_API_KEY=sk-ant-...
```

## 3. Install Dependencies (1 min)
```bash
npm install
```

## 4. Start Development Server (1 min)
```bash
npm run dev
```

## 5. Test the Feature (3 min)

1. Open app in browser
2. Login (use demo credentials in development or your configured users)
3. Navigate to workspace
4. Go to **Exams** section
5. Click **"📄 Upload Syllabus"** button
6. Upload a PDF syllabus
7. Verify extracted details:
   - ✅ Subject Name
   - ✅ Total Marks
   - ✅ Duration (minutes)
8. Click **"Use These Details"**
9. Click **"Add Exam"** to create the exam

---

## 📄 Sample PDF Format (Works Best)

The system extracts details from PDFs containing:
- Subject/Course name
- Total marks or maximum marks
- Duration (e.g., "180 minutes", "3 hours")
- Passing marks (optional)

**Example text in PDF:**
```
SYLLABUS: Data Structures and Algorithms
Total Marks: 100
Duration: 180 minutes (3 hours)
Passing Marks: 40
```

---

## 🔍 What Gets Extracted

| Field | Example | Required |
|-------|---------|----------|
| Subject Name | "Data Structures" | ✅ |
| Total Marks | 100 | ✅ |
| Duration (min) | 180 | ✅ |
| Passing Marks | 40 | ❌ Optional |

---

## ⚠️ Troubleshooting

### "ANTHROPIC_API_KEY not configured"
- ✅ Check `.env` file has the key
- ✅ Restart server after adding key

### "PDF appears to be empty"
- ✅ PDF must have readable text
- ✅ Scanned images won't work (need OCR)
- ✅ Try converting scanned PDFs to searchable PDFs

### Upload takes too long
- ✅ Check file size (max 10MB)
- ✅ Check internet connection
- ✅ Large PDFs (>5MB) may take 10-15s

### "Only PDF files are allowed"
- ✅ Make sure file extension is `.pdf`
- ✅ Check file mimetype

---

## 📚 Documentation Files

- `SYLLABUS_UPLOAD_GUIDE.md` - Complete technical guide
- `UPDATES_CHECKLIST.md` - All changes made
- `STATUS_REPORT.md` - Implementation status

---

## 🎯 Features

✅ **Smart Extraction**: Claude AI analyzes PDF text to extract structured data  
✅ **Validation**: File type & size checked  
✅ **Security**: Authentication required, files cleaned up  
✅ **User-Friendly**: Clean modal UI, instant feedback  
✅ **Error Handling**: Clear error messages  
✅ **Integration**: Auto-populates exam form  

---

## 💡 Pro Tips

1. **Accurate extractions**: PDFs with clear formatting work best
2. **Review details**: Always review extracted data before adding exam
3. **Edit if needed**: You can edit any field after extraction
4. **Batch workflow**: Extract multiple syllabi, then add exams one by one
5. **Save time**: Instead of manual entry, upload → review → add

---

## 📊 Development Notes

- Backend: `server/routes/syllabus.js`
- Frontend: `src/components/SyllabusUpload.jsx`
- API: `POST /api/syllabus/upload`
- Model: Claude 3.5 Sonnet
- Libraries: multer, pdf-parse, fetch API

---

## ✅ Verification Checklist

Before using:
- [ ] `.env` has `ANTHROPIC_API_KEY`
- [ ] `npm install` completed
- [ ] Server running (`npm run dev`)
- [ ] No console errors
- [ ] Login successful
- [ ] Workspace accessible

Note: The app uses an httpOnly session cookie (`examflow.session`) for authentication. Ensure your browser allows cookies and that any automated clients send requests with credentials (e.g., `fetch(..., { credentials: 'include' })`).

---

## 🎓 Example Workflow

```
Day 1: Set up
  └─ Add API key → npm install → npm run dev

Day 2: Use feature
  └─ Upload syllabus → Extract → Review → Add exam

Day 3: Add more exams
  └─ Repeat for other subjects
```

---

**Ready?** Start with Step 1 above! 🚀

