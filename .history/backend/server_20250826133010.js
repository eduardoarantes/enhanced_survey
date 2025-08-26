const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// File path for storing LLM prompt
const PROMPT_FILE_PATH = path.join(__dirname, 'data', 'llm-prompt.md');
const DEFAULT_PROMPT = 'Evaluate if this answer provides sufficient detail for the question asked. Respond with "sufficient" if the answer is detailed enough, or "insufficient" followed by a specific follow-up question to gather more details.';

// Ensure data directory exists
const ensureDataDirectory = () => {
  const dataDir = path.dirname(PROMPT_FILE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('Created data directory:', dataDir);
  }
};

// Load LLM prompt from file
const loadLLMPrompt = () => {
  try {
    if (fs.existsSync(PROMPT_FILE_PATH)) {
      const prompt = fs.readFileSync(PROMPT_FILE_PATH, 'utf8').trim();
      return prompt || DEFAULT_PROMPT;
    }
    return DEFAULT_PROMPT;
  } catch (error) {
    console.error('Error loading LLM prompt:', error);
    return DEFAULT_PROMPT;
  }
};

// Save LLM prompt to file
const saveLLMPrompt = (prompt) => {
  try {
    ensureDataDirectory();
    fs.writeFileSync(PROMPT_FILE_PATH, prompt.trim(), 'utf8');
    console.log('LLM prompt saved to file:', PROMPT_FILE_PATH);
    return true;
  } catch (error) {
    console.error('Error saving LLM prompt:', error);
    return false;
  }
};

// Initialize data directory and load initial prompt
ensureDataDirectory();
let currentLLMPrompt = loadLLMPrompt();
console.log('Loaded LLM prompt from file:', currentLLMPrompt.length, 'characters');

// Middleware
app.use(cors());
app.use(express.json());

// Session-based throttling storage (in production, use Redis or database)
const sessionThrottling = new Map();

// Session-based rate limiter - max 10 requests per minute per session
const sessionRateLimit = (req, res, next) => {
  const sessionId = req.headers['x-session-id'] || req.ip;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10;

  if (!sessionThrottling.has(sessionId)) {
    sessionThrottling.set(sessionId, { requests: [], lastReset: now });
  }

  const sessionData = sessionThrottling.get(sessionId);
  
  // Clean old requests outside the time window
  sessionData.requests = sessionData.requests.filter(
    timestamp => now - timestamp < windowMs
  );

  // Check if limit exceeded
  if (sessionData.requests.length >= maxRequests) {
    return res.status(429).json({
      error: 'Too many requests',
      message: `Maximum ${maxRequests} requests per minute allowed per session`,
      retryAfter: Math.ceil(windowMs / 1000)
    });
  }

  // Add current request
  sessionData.requests.push(now);
  sessionThrottling.set(sessionId, sessionData);

  next();
};

// Global rate limiter as backup
const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP',
    message: 'Please try again later'
  }
});

app.use(globalRateLimit);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    sessionsActive: sessionThrottling.size 
  });
});

// LLM validation proxy endpoint
app.post('/api/validate', sessionRateLimit, async (req, res) => {
  try {
    const { question, answer, model = 'gemini' } = req.body;
    const sessionId = req.headers['x-session-id'] || req.ip;

    // Validate required fields
    if (!question || !answer) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'question and answer are required'
      });
    }

    // Use the current LLM prompt from file
    const prompt = currentLLMPrompt;

    // Validate model selection and API keys
    if (model === 'chatgpt' && !process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'OpenAI API key not configured on server'
      });
    }

    if (model === 'gemini' && !process.env.GOOGLE_API_KEY) {
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Google API key not configured on server'
      });
    }

    console.log(`[${new Date().toISOString()}] Validation request from session: ${sessionId} using ${model}`);

    let result = '';

    if (model === 'chatgpt') {
      // OpenAI ChatGPT
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: prompt
          },
          {
            role: 'user',
            content: `Question: "${question}"\nAnswer: "${answer}"`
          }
        ],
        max_tokens: 200,
        temperature: 0
      });

      result = response.choices[0]?.message?.content?.trim() || '';

    } else if (model === 'gemini') {
      // Google Gemini
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const geminiPrompt = `${prompt}

Question: "${question}"
Answer: "${answer}"`;

      const response = await geminiModel.generateContent(geminiPrompt);
      result = response.response.text().trim();

    } else {
      return res.status(400).json({
        error: 'Invalid model',
        message: 'Model must be either "chatgpt" or "gemini"'
      });
    }

    const isValid = result.toLowerCase().includes('sufficient');
    
    res.json({
      result,
      isValid,
      followUpQuestion: isValid ? undefined : result.replace(/^insufficient\s*/i, ''),
      sessionId,
      model,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Validation error:', error);
    
    // Handle specific OpenAI errors
    if (error.status === 401) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided OpenAI API key is invalid'
      });
    }
    
    if (error.status === 429) {
      return res.status(429).json({
        error: 'OpenAI rate limit exceeded',
        message: 'Too many requests to OpenAI API. Please try again later.'
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to validate answer'
    });
  }
});

// Session management endpoint - generate session ID
app.post('/api/session', (req, res) => {
  const sessionId = uuidv4();
  res.json({ sessionId });
});

// Get session throttling status
app.get('/api/session/:sessionId/status', (req, res) => {
  const { sessionId } = req.params;
  const sessionData = sessionThrottling.get(sessionId);
  
  if (!sessionData) {
    return res.json({
      sessionId,
      requestsInWindow: 0,
      maxRequests: 10,
      windowMs: 60000
    });
  }

  const now = Date.now();
  const validRequests = sessionData.requests.filter(
    timestamp => now - timestamp < 60000
  );

  res.json({
    sessionId,
    requestsInWindow: validRequests.length,
    maxRequests: 10,
    windowMs: 60000,
    nextResetAt: Math.max(...validRequests) + 60000
  });
});

// Get current LLM prompt
app.get('/api/prompt', (req, res) => {
  res.json({
    prompt: currentLLMPrompt,
    timestamp: new Date().toISOString()
  });
});

// Update LLM prompt
app.post('/api/prompt', (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'Invalid prompt',
        message: 'Prompt must be a non-empty string'
      });
    }

    if (prompt.trim().length < 10) {
      return res.status(400).json({
        error: 'Prompt too short',
        message: 'Prompt must be at least 10 characters long'
      });
    }

    const success = saveLLMPrompt(prompt);
    if (success) {
      currentLLMPrompt = prompt.trim();
      res.json({
        success: true,
        prompt: currentLLMPrompt,
        message: 'LLM prompt updated successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        error: 'Save failed',
        message: 'Failed to save LLM prompt to file'
      });
    }
  } catch (error) {
    console.error('Error updating LLM prompt:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update LLM prompt'
    });
  }
});

// Survey submission endpoint
app.post('/api/submit', (req, res) => {
  try {
    const { sessionId, responses, config, submittedAt } = req.body;
    
    // Validate required fields
    if (!responses || !config) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'responses and config are required'
      });
    }

    console.log(`[${new Date().toISOString()}] Survey submitted by session: ${sessionId || 'unknown'}`);
    console.log(`  Questions: ${config.questions?.length || 0}`);
    console.log(`  Responses: ${Object.keys(responses).length}`);

    // Generate a submission ID for tracking
    const submissionId = uuidv4();
    
    // In a real app, you'd save to database here
    // For now, we just return a success response with the submission details
    
    res.json({
      success: true,
      submissionId,
      sessionId: sessionId || 'anonymous',
      submittedAt: submittedAt || new Date().toISOString(),
      summary: {
        questionsCount: config.questions?.length || 0,
        responsesCount: Object.keys(responses).length,
        completionRate: Math.round((Object.keys(responses).length / (config.questions?.length || 1)) * 100)
      },
      responses,
      config,
      message: 'Survey submitted successfully!'
    });

  } catch (error) {
    console.error('Survey submission error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to submit survey'
    });
  }
});

// Cleanup old sessions periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  
  for (const [sessionId, data] of sessionThrottling.entries()) {
    const hasRecentRequests = data.requests.some(
      timestamp => timestamp > fiveMinutesAgo
    );
    
    if (!hasRecentRequests) {
      sessionThrottling.delete(sessionId);
    }
  }
  
  console.log(`[${new Date().toISOString()}] Cleaned up old sessions. Active sessions: ${sessionThrottling.size}`);
}, 5 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Survey backend service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});