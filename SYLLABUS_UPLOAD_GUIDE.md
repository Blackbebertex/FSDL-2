# Syllabus Upload Feature - Setup Guide

## Overview
The syllabus upload feature allows users to extract exam details (subject name, total marks, paper duration) from PDF syllabi using Claude AI.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```
This installs `multer` (file upload) and `pdf-parse` (PDF text extraction) packages.

### 2. Configure Anthropic API Key
1. Get your Anthropic API key from https://console.anthropic.com/
2. Add it to your `.env` file:
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   ```

### 3. Start the Application
```bash
npm run dev
```

## How to Use

### User Workflow
1. Navigate to the "Exams" section in the workspace
2. Click the **"📄 Upload Syllabus"** button
3. Select a PDF file (max 10MB)
4. Click **"Upload & Extract"**
5. Review the extracted details:
   - Subject Name
   - Total Marks
   - Duration (in minutes)
   - Passing Marks (if available)
6. Click **"Use These Details"** to populate the exam form
7. Review/edit the details if needed
8. Click **"Add"** to add the exam

### Backend Endpoints

#### Upload and Extract Syllabus
- **Endpoint**: `POST /api/syllabus/upload`
- **Auth**: Required (Bearer token)
- **Body**: FormData with `syllabus` file (PDF)
- **Response**:
  ```json
  {
    "success": true,
    "details": {
      "subjectName": "Data Structures",
      "marks": 100,
      "durationMinutes": 180,
      "passingMarks": 40
    }
  }
  ```

## Technical Details

### Frontend Components
- **SyllabusUpload.jsx**: Main upload UI component
- **SyllabusUpload.css**: Styling for the upload modal

### Backend Implementation
- **server/routes/syllabus.js**: Route handlers
  - Uses `multer` for file upload handling
  - Uses `pdf-parse` to extract text from PDFs
  - Calls Claude API to extract structured data

### Processing Flow
1. PDF file uploaded to `/server/uploads/`
2. `pdf-parse` extracts text content
3. Claude analyzes text to extract:
   - Subject name
   - Paper duration
   - Total marks
   - Passing marks (if mentioned)
4. Extracted data returned to frontend
5. Temporary file deleted

## Claude Prompt
The system uses Claude 3.5 Sonnet with a specific prompt to extract exam details:
```
Extract from syllabus:
- subjectName: The name of the subject/course
- paperDuration: Duration in minutes (e.g., 120 for 2 hours)
- totalMarks: Total marks for the exam
- passingMarks: Passing marks if mentioned
```

## Error Handling
- Invalid file types rejected (only PDFs allowed)
- File size limit enforced (10MB max)
- Empty/unreadable PDFs detected
- API errors properly reported to user
- Uploaded files cleaned up on error

## Customization
To modify extraction fields, edit the prompt in `server/routes/syllabus.js`:
```javascript
const extractExamDetailsWithClaude = async (pdfText) => {
  const prompt = `... your custom prompt here ...`;
  // ...
}
```

## Troubleshooting

### "ANTHROPIC_API_KEY not configured"
- Add your API key to `.env` file
- Restart the server

### "PDF appears to be empty"
- Ensure the PDF contains readable text
- OCR-scanned images won't work with text extraction

### Upload fails silently
- Check browser console for errors
- Check server logs
- Verify file size < 10MB
- Ensure user is authenticated

## File Structure
```
server/
  routes/
    syllabus.js          # Route handlers
  uploads/               # Temporary PDF storage
  app.js                 # Updated with syllabus routes
src/
  components/
    SyllabusUpload.jsx   # React component
    SyllabusUpload.css   # Styles
  services/
    workspaceApi.js      # API service (updated)
  App.jsx                # Main app (updated)
.env                     # Configuration (updated)
package.json             # Dependencies (updated)
```

## Security Considerations
- File uploads limited to 10MB
- Only PDF files accepted
- Uploaded files deleted after processing
- Authentication required
- API key stored in environment variables (never in code)
- CORS properly configured
