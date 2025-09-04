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
const DEFAULT_PROMPT = {
  systemPrompt: 'You are an AI assistant helping to validate survey responses. Your task is to evaluate if answers provide sufficient detail for the questions asked.',
  userPrompt: 'Question: "{question}"\nScore: {score}\nAnswer: "{answer}"\n\nEvaluate if this answer provides sufficient detail for the question asked. Respond with "sufficient" if the answer is detailed enough, or "insufficient" followed by a specific follow-up question to gather more details.'
};

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
      const promptData = fs.readFileSync(PROMPT_FILE_PATH, 'utf8').trim();
      if (promptData) {
        // Parse markdown format with separator
        const sections = promptData.split('---USER_PROMPT---');
        if (sections.length === 2) {
          const systemPrompt = sections[0].replace(/^# System Prompt\s*\n?/i, '').trim();
          const userPrompt = sections[1].replace(/^# User Prompt\s*\n?/i, '').trim();
          
          if (systemPrompt && userPrompt) {
            return { systemPrompt, userPrompt };
          }
        }
      }
    }
    return DEFAULT_PROMPT;
  } catch (error) {
    console.error('Error loading LLM prompt:', error);
    return DEFAULT_PROMPT;
  }
};

// Save LLM prompt to file
const saveLLMPrompt = (promptData) => {
  try {
    ensureDataDirectory();
    // Format as markdown with separator
    const markdownContent = `# System Prompt

${promptData.systemPrompt}

---USER_PROMPT---

# User Prompt

${promptData.userPrompt}`;
    
    fs.writeFileSync(PROMPT_FILE_PATH, markdownContent, 'utf8');
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
console.log('Loaded LLM prompt from file - System:', currentLLMPrompt.systemPrompt?.length || 0, 'chars, User:', currentLLMPrompt.userPrompt?.length || 0, 'chars');

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
```javascript
const { isValidOpenAIKey, isValidGoogleKey } = require('./api-key-validator'); //Helper functions for API key validation

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    sessionsActive: sessionThrottling.size 
  });
});

// LLM validation proxy endpoint
app.post('/api/validate', sessionRateLimit, async (req, res) => {
  const { question, answer, score = null, model = 'gemini' } = req.body;
  const sessionId = req.headers['x-session-id'] || req.ip;

  const missingFields = validateRequiredFields(question, answer);
  if (missingFields) {
    return res.status(400).json({ error: 'Missing required fields', message: missingFields });
  }

  const userPrompt = buildUserPrompt(question, answer, score, currentLLMPrompt);

  const isValidKey = validateAPIKey(model);
  if (!isValidKey) {
    return res.status(500).json({ error: 'Invalid API Key' });
  }

  // ...rest of the code (handling the API call and response)
});

function validateRequiredFields(question, answer){
  if (!question || !answer) {
    return 'question and answer are required';
  }
  return null;
}

function buildUserPrompt(question, answer, score, promptData) {
  return promptData.userPrompt
      .replace('{question}', question)
      .replace('{score}', score || 'Not provided')
      .replace('{answer}', answer);
}


function validateAPIKey(model) {
  if (model === 'gemini') {
    return isValidGoogleKey();
  } else if (model === 'openai') {
    return isValidOpenAIKey();
  }
  return false; // Or throw an error for unsupported models
}

```
    if (model === 'chatgpt' && !isValidOpenAIKey) {
      return res.status(400).json({
        error: 'API key not configured',
        message: 'OpenAI API key not configured. Please set a valid OPENAI_API_KEY environment variable.'
      });
    }

    if (model === 'gemini' && !isValidGoogleKey) {
      return res.status(400).json({
        error: 'API key not configured',
        message: 'Google API key not configured. Please set a valid GOOGLE_API_KEY environment variable.'
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
            content: promptData.systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
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

      // For Gemini, combine system and user prompts
      const geminiPrompt = `${promptData.systemPrompt}

${userPrompt}`;

      const response = await geminiModel.generateContent(geminiPrompt);
      result = response.response.text().trim();

    } else {
      return res.status(400).json({
        error: 'Invalid model',
        message: 'Model must be either "chatgpt" or "gemini"'
      });
    }

    // Parse LLM response to extract follow-up question
    let isValid = true;
    let followUpQuestion = undefined;

    try {
      // Check for NO_PROBE response (simple string format)
      if (result.trim().toUpperCase() === 'NO_PROBE') {
        isValid = true;
        followUpQuestion = undefined;
      }
      // Check if result contains JSON (new format)
      else if (result.includes('"action"') && result.includes('"text"')) {
        // Extract JSON from markdown code block if present
        const jsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/) || [null, result];
        const jsonStr = jsonMatch[1] || result;
        
        const parsed = JSON.parse(jsonStr);
        
        if (parsed.action === 'probe' && parsed.text) {
          isValid = false;
          followUpQuestion = parsed.text;
        } else if (parsed.action === 'no_probe') {
          isValid = true;
          followUpQuestion = undefined;
        }
      } else {
        // Fallback to old format check
        if (result.toLowerCase().includes('sufficient')) {
          isValid = true;
          followUpQuestion = undefined;
        } else {
          isValid = false;
          followUpQuestion = result.replace(/^insufficient\s*/i, '').trim();
        }
      }
    } catch (error) {
      console.error('Error parsing LLM response:', error);
      // Fallback to old logic if JSON parsing fails
      if (result.trim().toUpperCase() === 'NO_PROBE') {
        isValid = true;
        followUpQuestion = undefined;
      } else {
        isValid = result.toLowerCase().includes('sufficient');
        followUpQuestion = isValid ? undefined : result.replace(/^insufficient\s*/i, '').trim();
      }
    }
    
    res.json({
      result,
      isValid,
      followUpQuestion,
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
    systemPrompt: currentLLMPrompt.systemPrompt,
    userPrompt: currentLLMPrompt.userPrompt,
    timestamp: new Date().toISOString()
  });
});

// Update LLM prompt
app.post('/api/prompt', (req, res) => {
  try {
    const { systemPrompt, userPrompt } = req.body;
    
    if (!systemPrompt || !userPrompt || typeof systemPrompt !== 'string' || typeof userPrompt !== 'string') {
      return res.status(400).json({
        error: 'Invalid prompt',
        message: 'Both systemPrompt and userPrompt must be non-empty strings'
      });
    }

    if (systemPrompt.trim().length < 10 || userPrompt.trim().length < 10) {
      return res.status(400).json({
        error: 'Prompt too short',
        message: 'Both system and user prompts must be at least 10 characters long'
      });
    }

    const promptData = {
      systemPrompt: systemPrompt.trim(),
      userPrompt: userPrompt.trim()
    };

    const success = saveLLMPrompt(promptData);
    if (success) {
      currentLLMPrompt = promptData;
      res.json({
        success: true,
        systemPrompt: currentLLMPrompt.systemPrompt,
        userPrompt: currentLLMPrompt.userPrompt,
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

// Configuration persistence endpoints
const CONFIG_FILE_PATH = path.join(__dirname, 'data', 'survey-config.json');

// Default configuration
const DEFAULT_CONFIG = {
  validationTrigger: 'blur',
  selectedModel: 'gemini',
  followUpDisplayMode: 'separate',
  questions: [
    {
      id: '1',
      type: 'single-choice',
      question: 'Which score do you give to the service?',
      options: ['1', '2', '3', '4', '5'],
      required: true
    },
    {
      id: '2',
      type: 'text',
      question: 'Why did you give this score?',
      required: true
    }
  ]
};

// Load configuration from file
const loadConfiguration = () => {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const configData = fs.readFileSync(CONFIG_FILE_PATH, 'utf8').trim();
      if (configData) {
        return JSON.parse(configData);
      }
    }
    return DEFAULT_CONFIG;
  } catch (error) {
    console.error('Error loading configuration:', error);
    return DEFAULT_CONFIG;
  }
};

// Save configuration to file
const saveConfiguration = (configData) => {
  try {
    ensureDataDirectory();
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(configData, null, 2), 'utf8');
    console.log('Configuration saved to file:', CONFIG_FILE_PATH);
    return true;
  } catch (error) {
    console.error('Error saving configuration:', error);
    return false;
  }
};

// Get current configuration
app.get('/api/config', (req, res) => {
  try {
    const config = loadConfiguration();
    res.json({
      success: true,
      config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting configuration:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to load configuration'
    });
  }
});

// Save configuration
app.post('/api/config', (req, res) => {
  try {
    const { validationTrigger, selectedModel, followUpDisplayMode, questions } = req.body;
    
    // Validate required fields
    if (!validationTrigger || !selectedModel || !questions) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'validationTrigger, selectedModel, and questions are required'
      });
    }

    // Validate validation trigger
    if (!['blur', 'submit'].includes(validationTrigger)) {
      return res.status(400).json({
        error: 'Invalid validation trigger',
        message: 'validationTrigger must be either "blur" or "submit"'
      });
    }

    // Validate selected model
    if (!['chatgpt', 'gemini'].includes(selectedModel)) {
      return res.status(400).json({
        error: 'Invalid model',
        message: 'selectedModel must be either "chatgpt" or "gemini"'
      });
    }

    // Validate followUpDisplayMode (optional field with default)
    const validFollowUpDisplayMode = followUpDisplayMode || 'separate';
    if (!['separate', 'inline'].includes(validFollowUpDisplayMode)) {
      return res.status(400).json({
        error: 'Invalid followUpDisplayMode',
        message: 'followUpDisplayMode must be either "separate" or "inline"'
      });
    }

    // Validate questions array
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        error: 'Invalid questions',
        message: 'questions must be a non-empty array'
      });
    }

    // Validate each question
    for (const question of questions) {
      if (!question.id || !question.type || !question.question) {
        return res.status(400).json({
          error: 'Invalid question format',
          message: 'Each question must have id, type, and question fields'
        });
      }
      
      if (!['text', 'single-choice', 'multiple-choice'].includes(question.type)) {
        return res.status(400).json({
          error: 'Invalid question type',
          message: 'Question type must be "text", "single-choice", or "multiple-choice"'
        });
      }
      
      if ((question.type === 'single-choice' || question.type === 'multiple-choice') && 
          (!question.options || !Array.isArray(question.options) || question.options.length === 0)) {
        return res.status(400).json({
          error: 'Invalid question options',
          message: 'Choice questions must have a non-empty options array'
        });
      }
    }

    const configData = {
      validationTrigger,
      selectedModel,
      followUpDisplayMode: validFollowUpDisplayMode,
      questions,
      lastModified: new Date().toISOString()
    };

    const success = saveConfiguration(configData);
    if (success) {
      res.json({
        success: true,
        message: 'Configuration saved successfully',
        config: configData,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        error: 'Save failed',
        message: 'Failed to save configuration to file'
      });
    }
  } catch (error) {
    console.error('Error saving configuration:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to save configuration'
    });
  }
});

// Only start the server and cleanup interval if not in test mode
if (process.env.NODE_ENV !== 'test') {
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
}

module.exports = app;