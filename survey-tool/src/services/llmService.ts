const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Session storage for managing session ID
class SessionManager {
  private sessionId: string | null = null;

  async getSessionId(): Promise<string> {
    if (this.sessionId) {
      return this.sessionId;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
      this.sessionId = data.sessionId;
      return this.sessionId!;
    } catch (error) {
      console.error('Failed to get session ID:', error);
      // Fallback to a simple UUID-like string
      this.sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      return this.sessionId;
    }
  }

  async getSessionStatus(): Promise<{
    requestsInWindow: number;
    maxRequests: number;
    nextResetAt?: number;
  }> {
    const sessionId = await this.getSessionId();
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/session/${sessionId}/status`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to get session status:', error);
    }

    // Fallback response
    return {
      requestsInWindow: 0,
      maxRequests: 10
    };
  }
}

const sessionManager = new SessionManager();

export interface ValidationResponse {
  result: string;
  isValid: boolean;
  followUpQuestion?: string;
  sessionId: string;
  timestamp: string;
}

export interface ValidationError {
  error: string;
  message: string;
  retryAfter?: number;
}

export async function validateAnswer(
  question: string,
  answer: string,
  model: 'chatgpt' | 'gemini' = 'gemini',
  score?: string | number
): Promise<ValidationResponse> {
  const sessionId = await sessionManager.getSessionId();

  const response = await fetch(`${API_BASE_URL}/api/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Id': sessionId,
    },
    body: JSON.stringify({
      question,
      answer,
      model,
      score,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return await response.json();
}

export async function getSessionStatus() {
  return await sessionManager.getSessionStatus();
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export interface SubmitSurveyResponse {
  success: boolean;
  submissionId: string;
  sessionId: string;
  submittedAt: string;
  summary: {
    questionsCount: number;
    responsesCount: number;
    completionRate: number;
  };
  responses: Record<string, any>;
  config: any;
  message: string;
}

export async function submitSurvey(
  responses: Record<string, any>,
  config: any
): Promise<SubmitSurveyResponse> {
  const sessionId = await sessionManager.getSessionId();

  const response = await fetch(`${API_BASE_URL}/api/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId,
      responses,
      config,
      submittedAt: new Date().toISOString()
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return await response.json();
}

export interface LLMPromptResponse {
  systemPrompt: string;
  userPrompt: string;
  timestamp: string;
}

export interface LLMPromptData {
  systemPrompt: string;
  userPrompt: string;
}

export async function getLLMPrompt(): Promise<LLMPromptData> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/prompt`);
    if (response.ok) {
      const data: LLMPromptResponse = await response.json();
      return {
        systemPrompt: data.systemPrompt,
        userPrompt: data.userPrompt
      };
    }
  } catch (error) {
    console.error('Failed to get LLM prompt:', error);
  }
  
  // Fallback to default if API fails
  return {
    systemPrompt: 'You are an AI assistant helping to validate survey responses. Your task is to evaluate if answers provide sufficient detail for the questions asked.',
    userPrompt: 'Question: "{question}"\nScore: {score}\nAnswer: "{answer}"\n\nEvaluate if this answer provides sufficient detail for the question asked. Respond with "sufficient" if the answer is detailed enough, or "insufficient" followed by a specific follow-up question to gather more details.'
  };
}

export async function updateLLMPrompt(promptData: LLMPromptData): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemPrompt: promptData.systemPrompt,
        userPrompt: promptData.userPrompt
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.success === true;
    }
  } catch (error) {
    console.error('Failed to update LLM prompt:', error);
  }
  
  return false;
}