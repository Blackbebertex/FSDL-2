import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { requireAuth } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '..', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitized = file.originalname.replace(/[^a-z0-9.-]/gi, '_');
    cb(null, `${timestamp}-${sanitized}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const router = express.Router();

const handleSyllabusUpload = (req, res, next) => {
  upload.single('syllabus')(req, res, (error) => {
    if (error) {
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          // Ignore cleanup errors here; the request will still fail safely.
        }
      }

      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'File size must be 10MB or less' });
        return;
      }

      if (error.message === 'Only PDF files are allowed') {
        res.status(400).json({ error: error.message });
        return;
      }

      next(error);
      return;
    }

    next();
  });
};

/**
 * Extract text from PDF using pdf-parse
 */
const extractPdfText = async (filePath) => {
  const fileBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(fileBuffer);
  return data.text;
};

const normalizeWhitespace = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const parseJsonObjectFromText = (text) => {
  const jsonMatch = String(text || '').match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse model response as JSON');
  }
  return JSON.parse(jsonMatch[0]);
};

const getExtractionPrompt = (pdfText) => `You are an expert at extracting exam details from syllabus documents.

From the following syllabus text, extract and return ONLY a JSON object with these exact fields:
- subjectName: (string) The name of the subject/course
- paperDuration: (number) Duration of the exam in minutes (e.g., 120 for 2 hours)
- totalMarks: (number) Total marks for the exam
- passingMarks: (number) Passing marks if mentioned, otherwise null

If any field cannot be determined with confidence, use null for that field.

Syllabus text:
${pdfText}

Return ONLY valid JSON, no markdown or extra text.`;

const extractExamDetailsLocally = (pdfText) => {
  const text = normalizeWhitespace(pdfText);
  const lines = String(pdfText || '')
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const subjectPatterns = [
     /(?:subject|course|paper title|title)\s*(?:[:-])\s*([^\n\r.]{3,120})/i,
     /(?:name of the subject|subject name)\s*(?:[:-])\s*([^\n\r.]{3,120})/i,
  ];

  let subjectName = '';
  for (const pattern of subjectPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      subjectName = normalizeWhitespace(match[1]);
      break;
    }
  }

  if (!subjectName) {
    const headingCandidate = lines.find((line) => (
      line.length >= 3
      && line.length <= 120
      && !/(syllabus|question paper|exam|marks|duration|semester|department|university)/i.test(line)
    ));
    subjectName = headingCandidate || '';
  }

    const durationMatch = text.match(/(?:duration|time(?: allowed)?)\s*(?:[:-])?\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|minutes?|mins?|min)?/i)
      || text.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|minutes?|mins?|min)\b/i);
  let durationMinutes = null;
  if (durationMatch?.[1]) {
    const amount = Number(durationMatch[1]);
    const unit = String(durationMatch[2] || 'minutes').toLowerCase();
    durationMinutes = Number.isFinite(amount)
      ? Math.round(unit.startsWith('hour') || unit.startsWith('hr') ? amount * 60 : amount)
      : null;
  }

    const marksMatch = text.match(/(?:total\s*)?(?:marks?|max(?:imum)? marks?|full marks?)\s*(?:[:-])?\s*(\d+(?:\.\d+)?)/i)
      || text.match(/\b(\d+(?:\.\d+)?)\s*marks?\b/i);
  const totalMarks = marksMatch?.[1] ? Number(marksMatch[1]) : null;

  const passingMatch = text.match(/(?:passing|pass)\s*marks?\s*(?:[:-])?\s*(\d+(?:\.\d+)?)/i);
  const passingMarks = passingMatch?.[1] ? Number(passingMatch[1]) : null;

  return {
    subjectName,
    paperDuration: durationMinutes,
    totalMarks,
    passingMarks,
  };
};

/**
 * Use Claude API to extract exam details from syllabus text
 */
const extractExamDetailsWithClaude = async (pdfText) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const prompt = getExtractionPrompt(pdfText);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data?.content?.[0]?.text;
  return parseJsonObjectFromText(content);
};

const extractExamDetailsWithBedrock = async (pdfText) => {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  if (!region) {
    throw new Error('AWS_REGION or AWS_DEFAULT_REGION not configured');
  }

  const modelId = process.env.BEDROCK_MODEL_ID || process.env.AWS_BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
  const client = new BedrockRuntimeClient({ region });

  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: getExtractionPrompt(pdfText),
            },
          ],
        },
      ],
    }),
  });

  const response = await client.send(command);
  const bodyString = new TextDecoder('utf-8').decode(response.body);
  const parsed = JSON.parse(bodyString);
  const content = parsed?.content?.[0]?.text;
  return parseJsonObjectFromText(content);
};

const resolveExtractionProvider = () => {
  const configured = String(process.env.LLM_PROVIDER || '').trim().toLowerCase();
  if (configured) {
    return configured;
  }

  const hasAwsRegion = Boolean(process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION);
  const hasAwsCredHint = Boolean(
    process.env.AWS_ACCESS_KEY_ID
    || process.env.AWS_PROFILE
    || process.env.AWS_WEB_IDENTITY_TOKEN_FILE
    || process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI
  );

  if (process.env.BEDROCK_MODEL_ID || process.env.AWS_BEDROCK_MODEL_ID || (hasAwsRegion && hasAwsCredHint)) {
    return 'bedrock';
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return 'anthropic';
  }

  return 'local';
};

const extractExamDetails = async (pdfText) => {
  const provider = resolveExtractionProvider();

  if (provider === 'bedrock') {
    try {
      return {
        details: await extractExamDetailsWithBedrock(pdfText),
        mode: 'bedrock',
      };
    } catch (error) {
      console.warn('Bedrock extraction failed, falling back to local parser:', error.message);
    }
  }

  if (provider === 'anthropic') {
    try {
      return {
        details: await extractExamDetailsWithClaude(pdfText),
        mode: 'anthropic',
      };
    } catch (error) {
      console.warn('Anthropic extraction failed, falling back to local parser:', error.message);
    }
  }

  return {
    details: extractExamDetailsLocally(pdfText),
    mode: 'local',
  };
};

/**
 * POST /api/syllabus/upload
 * Upload a syllabus PDF and extract exam details
 */
router.post('/upload', requireAuth, handleSyllabusUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Extract text from PDF
    const pdfText = await extractPdfText(req.file.path);

    if (!pdfText || pdfText.trim().length === 0) {
      return res.status(400).json({ error: 'PDF appears to be empty or unreadable' });
    }

    // Extract details using Claude when available, otherwise fall back to local parsing
    const { details: examDetails, mode: extractionMode } = await extractExamDetails(pdfText);
    console.log('Syllabus upload - extracted details:', examDetails);

    // Clean up uploaded file after processing
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      details: {
        subjectName: examDetails.subjectName || '',
        marks: examDetails.totalMarks || 100,
        durationMinutes: examDetails.paperDuration || 120,
        passingMarks: examDetails.passingMarks,
      },
      extractionMode,
    });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // Ignore cleanup errors
      }
    }

    console.error('Syllabus upload error:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to process syllabus',
    });
  }
});

export default router;
