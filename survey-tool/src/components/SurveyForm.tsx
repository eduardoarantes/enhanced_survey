import { useState, useCallback, useEffect } from 'react'
import { FileText, CheckCircle, AlertCircle, Loader2, MessageSquare, Star, WifiOff } from 'lucide-react'
import { validateAnswer as validateAnswerAPI, checkBackendHealth, getSessionStatus, submitSurvey, type SubmitSurveyResponse } from '../services/llmService'
import type { SurveyConfig, Question } from '../App'

interface SurveyFormProps {
  config: SurveyConfig
  setConfig: (config: SurveyConfig) => void
  validationTrigger: 'blur' | 'submit'
  selectedModel: 'chatgpt' | 'gemini'
  onSubmissionComplete?: (submissionData: SubmitSurveyResponse) => void
}

interface Answer {
  questionId: string
  value: string | string[]
  isValidating?: boolean
  isValid?: boolean
  followUpQuestion?: string
}

interface SessionStatus {
  requestsInWindow: number
  maxRequests: number
  nextResetAt?: number
}

export default function SurveyForm({
  config,
  setConfig,
  validationTrigger,
  selectedModel,
  onSubmissionComplete
}: SurveyFormProps) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [backendConnected, setBackendConnected] = useState(true)
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>({ requestsInWindow: 0, maxRequests: 10 })

  // Check backend connectivity on mount
  useEffect(() => {
    checkBackendHealth().then(setBackendConnected)
    
    // Update session status periodically
    const updateSessionStatus = async () => {
      try {
        const status = await getSessionStatus()
        setSessionStatus(status)
      } catch (error) {
        console.error('Failed to get session status:', error)
      }
    }
    
    updateSessionStatus()
    const interval = setInterval(updateSessionStatus, 30000) // Update every 30 seconds
    
    return () => clearInterval(interval)
  }, [])

  const validateAnswer = useCallback(async (questionId: string, answer: string) => {
    if (!answer.trim()) return

    // Check if session is throttled
    if (sessionStatus.requestsInWindow >= sessionStatus.maxRequests) {
      const timeToWait = sessionStatus.nextResetAt ? sessionStatus.nextResetAt - Date.now() : 60000
      alert(`Request limit reached. Please wait ${Math.ceil(timeToWait / 1000)} seconds before trying again.`)
      return
    }

    setAnswers(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], questionId, value: answer, isValidating: true }
    }))

    try {
      const question = config.questions.find(q => q.id === questionId)
      if (!question) return

      // Get score from previous answers if this is a follow-up question
      const scoreAnswer = config.questions.find(q => q.type === 'single-choice')
      const scoreValue = scoreAnswer ? answers[scoreAnswer.id]?.value : undefined
      const score = Array.isArray(scoreValue) ? scoreValue[0] : scoreValue
      
      const response = await validateAnswerAPI(question.question, answer, selectedModel, score)
      
      setAnswers(prev => ({
        ...prev,
        [questionId]: {
          ...prev[questionId],
          isValidating: false,
          isValid: response.isValid,
          followUpQuestion: response.followUpQuestion
        }
      }))

      // Update session status after successful request
      try {
        const newStatus = await getSessionStatus()
        setSessionStatus(newStatus)
      } catch (error) {
        console.error('Failed to update session status:', error)
      }

      // If insufficient, add follow-up question
      if (!response.isValid && response.followUpQuestion) {
        const newQuestion: Question = {
          id: `${questionId}-followup-${Date.now()}`,
          type: 'text',
          question: response.followUpQuestion,
          required: true
        }

        const questionIndex = config.questions.findIndex((q: Question) => q.id === questionId)
        const newQuestions = [...config.questions]
        newQuestions.splice(questionIndex + 1, 0, newQuestion)
        setConfig({ ...config, questions: newQuestions })
      }
    } catch (error) {
      console.error('Validation error:', error)
      
      // Check if this is a connection error to update backend status
      if (error instanceof Error && error.message.includes('Connection')) {
        setBackendConnected(false)
      }
      
      setAnswers(prev => ({
        ...prev,
        [questionId]: {
          ...prev[questionId],
          isValidating: false,
          isValid: undefined
        }
      }))
    }
  }, [selectedModel, config.questions, setConfig, sessionStatus])

  const handleTextChange = useCallback((questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { questionId, value }
    }))
  }, [])

  const handleTextBlur = useCallback((questionId: string, value: string) => {
    if (validationTrigger === 'blur' && value.trim()) {
      validateAnswer(questionId, value)
    }
  }, [validationTrigger, validateAnswer])

  const handleChoiceChange = useCallback((questionId: string, value: string | string[]) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { questionId, value }
    }))
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (validationTrigger === 'submit') {
        // First, validate all text questions that have answers
        const textQuestions = config.questions.filter(q => q.type === 'text')
        const validationPromises: Promise<void>[] = []
        
        for (const question of textQuestions) {
          const answer = answers[question.id]
          // Only validate if there's an answer and it hasn't been validated yet
          if (answer && typeof answer.value === 'string' && answer.value.trim() && 
              answer.isValid === undefined) {
            validationPromises.push(validateAnswer(question.id, answer.value))
          }
        }

        // Wait for all validations to complete
        if (validationPromises.length > 0) {
          await Promise.all(validationPromises)
          
          // Wait for state updates (config and answers)
          await new Promise(resolve => setTimeout(resolve, 500))
        }

        // Final check for any unanswered follow-up questions
        const unansweredFollowUps = config.questions.filter(q => {
          // Check if this is a follow-up question (has '-followup-' in id)
          if (q.id.includes('-followup-')) {
            const answer = answers[q.id]
            // If no answer or empty answer, it's unanswered
            return !answer || !answer.value || (typeof answer.value === 'string' && !answer.value.trim())
          }
          return false
        })

        if (unansweredFollowUps.length > 0) {
          // There are unanswered follow-up questions, halt submission
          setIsSubmitting(false)
          
          // Scroll to the first unanswered follow-up question
          const firstUnanswered = unansweredFollowUps[0]
          const element = document.getElementById(`question-${firstUnanswered.id}`)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
          
          // Show message to user
          const message = unansweredFollowUps.length === 1 
            ? 'Please answer the follow-up question before submitting.'
            : `Please answer the ${unansweredFollowUps.length} follow-up questions before submitting.`
          
          // Show a temporary notification (you could replace this with a toast notification)
          const notification = document.createElement('div')
          notification.className = 'fixed top-4 right-4 bg-yellow-100 border-l-4 border-yellow-500 p-4 rounded-lg shadow-lg z-50'
          notification.innerHTML = `
            <div class="flex items-center">
              <svg class="w-5 h-5 text-yellow-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
              </svg>
              <span class="text-yellow-800">${message}</span>
            </div>
          `
          document.body.appendChild(notification)
          
          // Remove notification after 4 seconds
          setTimeout(() => {
            if (document.body.contains(notification)) {
              document.body.removeChild(notification)
            }
          }, 4000)
          
          return // Stop submission
        }
      }

      // Submit survey to backend
      const submissionData = await submitSurvey(answers, config)
      
      if (onSubmissionComplete) {
        onSubmissionComplete(submissionData)
      } else {
        alert('Survey submitted successfully!')
      }
      
    } catch (error) {
      console.error('Survey submission error:', error)
      alert('Failed to submit survey. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [validationTrigger, config.questions, config, answers, validateAnswer, onSubmissionComplete])

  const renderQuestion = (question: Question) => {
    const answer = answers[question.id]
    const isFollowUp = question.id.includes('followup')

    return (
      <div
        key={question.id}
        id={`question-${question.id}`}
        className={`group transition-all duration-200 ${
          isFollowUp 
            ? 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 shadow-sm rounded-2xl p-6 ml-6 relative' 
            : 'bg-white border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md rounded-2xl p-6 relative'
        }`}
      >
        {isFollowUp && (
          <div className="absolute -left-3 top-1/2 -translate-y-1/2">
            <div className="w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center">
              <MessageSquare className="w-3 h-3 text-white" />
            </div>
          </div>
        )}

        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className={`text-lg font-semibold leading-relaxed ${
              isFollowUp ? 'text-amber-900' : 'text-gray-900'
            }`}>
              {question.question}
              {question.required && <span className="text-red-500 ml-1 text-xl">*</span>}
            </h3>
            {isFollowUp && (
              <p className="text-sm text-amber-700 mt-1 flex items-center gap-1">
                <Star className="w-3 h-3" />
                Follow-up question based on your previous answer
              </p>
            )}
          </div>
          
          <div className="flex-shrink-0 ml-4">
            {question.type === 'text' && answer?.isValidating && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 rounded-full">
                <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                <span className="text-xs text-blue-700 font-medium">Validating...</span>
              </div>
            )}
            {question.type === 'text' && !answer?.isValidating && answer?.isValid === true && (
              <div className="flex items-center gap-2 px-3 py-1 bg-green-100 rounded-full">
                <CheckCircle className="w-3 h-3 text-green-600" />
                <span className="text-xs text-green-700 font-medium">Valid</span>
              </div>
            )}
            {question.type === 'text' && !answer?.isValidating && answer?.isValid === false && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-100 rounded-full">
                <AlertCircle className="w-3 h-3 text-red-600" />
                <span className="text-xs text-red-700 font-medium">Needs more detail</span>
              </div>
            )}
          </div>
        </div>

        {question.type === 'text' && (
          <div className="space-y-3">
            <textarea
              value={(answer?.value as string) || ''}
              onChange={(e) => handleTextChange(question.id, e.target.value)}
              onBlur={(e) => handleTextBlur(question.id, e.target.value)}
              placeholder="Share your thoughts here..."
              rows={4}
              className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent resize-none transition-all duration-200 ${
                isFollowUp 
                  ? 'border-amber-200 focus:ring-amber-500 bg-white/80' 
                  : 'border-gray-200 focus:ring-blue-500 bg-gray-50 hover:bg-white focus:bg-white'
              }`}
            />
          </div>
        )}

        {question.type === 'single-choice' && question.options && (
          <div className="grid grid-cols-1 gap-3">
            {question.options.map((option, index) => (
              <label 
                key={index} 
                className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                  (answer?.value as string) === option
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={(answer?.value as string) === option}
                  onChange={(e) => handleChoiceChange(question.id, e.target.value)}
                  className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-gray-900 font-medium flex-1">{option}</span>
              </label>
            ))}
          </div>
        )}

        {question.type === 'multiple-choice' && question.options && (
          <div className="grid grid-cols-1 gap-3">
            {question.options.map((option, index) => {
              const isSelected = ((answer?.value as string[]) || []).includes(option)
              return (
                <label 
                  key={index} 
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    value={option}
                    checked={isSelected}
                    onChange={(e) => {
                      const currentValues = (answer?.value as string[]) || []
                      const newValues = e.target.checked
                        ? [...currentValues, option]
                        : currentValues.filter(v => v !== option)
                      handleChoiceChange(question.id, newValues)
                    }}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-900 font-medium flex-1">{option}</span>
                </label>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-gray-200 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h2 className="text-xl font-bold text-gray-900">Survey Preview</h2>
            <p className="text-sm text-gray-500">Real-time form generation</p>
          </div>
        </div>
        
        <p className="text-gray-600 max-w-2xl mx-auto">
          This is a live preview of your survey. Questions are dynamically generated from your JSON configuration, 
          and AI validation provides intelligent feedback.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {config.questions.map(renderQuestion)}

        {/* Backend Status */}
        {!backendConnected && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mt-6">
            <div className="flex items-center gap-3">
              <WifiOff className="w-5 h-5 text-red-500" />
              <div>
                <h4 className="font-medium text-red-900">Backend Service Offline</h4>
                <p className="text-sm text-red-700">AI validation is temporarily unavailable. Please try again later.</p>
              </div>
            </div>
          </div>
        )}

        {/* Throttling Status */}
        {backendConnected && sessionStatus.requestsInWindow > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mt-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-blue-900">Request Usage</h4>
                <p className="text-sm text-blue-700">
                  {sessionStatus.requestsInWindow} of {sessionStatus.maxRequests} requests used this minute
                </p>
              </div>
              <div className="flex-shrink-0">
                <div className="w-16 h-2 bg-blue-200 rounded-full">
                  <div 
                    className="h-2 bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${(sessionStatus.requestsInWindow / sessionStatus.maxRequests) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit Section */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mt-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Ready to submit?</h3>
              <p className="text-sm text-gray-500">
                {!backendConnected 
                  ? 'Backend service is offline'
                  : `AI validation is enabled using ${selectedModel === 'chatgpt' ? 'ChatGPT' : 'Google Gemini'} with throttling protection`
                }
              </p>
            </div>
            
            <button
              type="submit"
              disabled={isSubmitting || !backendConnected}
              className={`flex items-center gap-3 px-8 py-4 rounded-xl font-semibold transition-all duration-200 ${
                isSubmitting || !backendConnected
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
              }`}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? 'Processing...' : 'Submit Survey'}
            </button>
          </div>
        </div>
      </form>

      {/* Footer Note */}
      <div className="text-center mt-8">
        <p className="text-xs text-gray-400">
          This is a demonstration tool. Submitted answers are not stored.
        </p>
      </div>
    </div>
  )
}