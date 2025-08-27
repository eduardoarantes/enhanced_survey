import { useState, useCallback, useEffect } from 'react'
import { FileText, CheckCircle, AlertCircle, Loader2, MessageSquare, Star, WifiOff, AlertTriangle } from 'lucide-react'
import { validateAnswer as validateAnswerAPI, checkBackendHealth, getSessionStatus, submitSurvey, type SubmitSurveyResponse } from '../services/llmService'
import type { SurveyConfig, Question } from '../App'

interface SurveyFormProps {
  config: SurveyConfig
  setConfig: (config: SurveyConfig) => void
  validationTrigger: 'blur' | 'submit'
  selectedModel: 'chatgpt' | 'gemini'
  followUpDisplayMode: 'separate' | 'inline'
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

// New interfaces for enhanced validation logic (CARD_1)
interface ValidationResult {
  questionId: string
  isValid: boolean | undefined
  followUpQuestion?: string
  originalQuestion: string
  originalAnswer: string
  error?: string
}

interface BatchValidationResult {
  results: ValidationResult[]
  hasFollowUps: boolean
  errors: string[]
  completedCount: number
  totalCount: number
}

export default function SurveyForm({
  config,
  setConfig,
  validationTrigger,
  selectedModel,
  followUpDisplayMode,
  onSubmissionComplete
}: SurveyFormProps) {
  console.log('🔥 SURVEYFORM COMPONENT LOADED - Debug Check')
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [backendConnected, setBackendConnected] = useState(true)
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>({ requestsInWindow: 0, maxRequests: 10 })
  
  // New state variables for enhanced submission flow (CARD_2)
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'validating' | 'halted' | 'submitting'>('idle')
  const [notificationMessage, setNotificationMessage] = useState<string>('')
  const [showNotification, setShowNotification] = useState(false)
  
  // State for inline mode validation tracking
  const [questionValidationState, setQuestionValidationState] = useState<Record<string, {
    needsMoreDetails: boolean;
    followUpText: string;
    isAdequate: boolean;
  }>>({})

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

    // Check if this is a follow-up question (never validate follow-up questions)
    if (isFollowUpQuestion(questionId)) {
      return
    }

    // Find the question and check if LLM validation is enabled
    const question = config.questions.find(q => q.id === questionId)
    if (!question) {
      return
    }
    
    // For text questions: validate if enableLLMValidation is undefined (default true) or explicitly true
    // Skip validation only if enableLLMValidation is explicitly false
    if (question.type === 'text' && question.enableLLMValidation === false) {
      return
    }

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

      const scoreAnswer = findScoreAnswer(answers)
      const response = await validateAnswerAPI(question.question, answer, selectedModel, scoreAnswer)
      
      // Use new pure function for parsing
      const validationResult = parseValidationResponse(response, questionId, question.question, answer)
      
      // Update state with validation result (existing logic)
      setAnswers(prev => ({
        ...prev,
        [questionId]: {
          ...prev[questionId],
          isValidating: false,
          isValid: validationResult.isValid,
          followUpQuestion: validationResult.followUpQuestion
        }
      }))

      // Update session status after successful request
      try {
        const newStatus = await getSessionStatus()
        setSessionStatus(newStatus)
      } catch (error) {
        console.error('Failed to update session status:', error)
      }

      // Handle follow-up questions based on display mode
      if (!validationResult.isValid && validationResult.followUpQuestion) {
        if (followUpDisplayMode === 'separate') {
          // Separate mode: create new question (existing behavior)
          const newQuestion = createFollowUpQuestion(validationResult)

          const questionIndex = config.questions.findIndex((q: Question) => q.id === questionId)
          const newQuestions = [...config.questions]
          newQuestions.splice(questionIndex + 1, 0, newQuestion)
          setConfig({ ...config, questions: newQuestions })
        } else {
          // Inline mode: update validation state for this question
          setQuestionValidationState(prev => ({
            ...prev,
            [questionId]: {
              needsMoreDetails: true,
              followUpText: validationResult.followUpQuestion || '',
              isAdequate: false
            }
          }))
        }
      } else if (validationResult.isValid) {
        // Question is adequate - mark as such in inline mode
        if (followUpDisplayMode === 'inline') {
          setQuestionValidationState(prev => ({
            ...prev,
            [questionId]: {
              needsMoreDetails: false,
              followUpText: '',
              isAdequate: true
            }
          }))
        }
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
    setAnswers(prev => {
      const updated = { ...prev }
      
      if (isFollowUpQuestion(questionId)) {
        // For follow-up questions, only do simple validation
        const validation = validateFollowUpAnswer(questionId, value)
        updated[questionId] = {
          questionId,
          value,
          isValid: validation.isComplete,
          isValidating: false
        }
      } else {
        // For original questions, maintain existing behavior
        updated[questionId] = {
          questionId,
          value
        }
      }
      
      return updated
    })
  }, [])

  const handleTextBlur = useCallback((questionId: string, value: string) => {
    if (isFollowUpQuestion(questionId)) {
      // Follow-up questions: only validate text presence, no AI validation
      const validation = validateFollowUpAnswer(questionId, value)
      
      setAnswers(prev => ({
        ...prev,
        [questionId]: {
          ...prev[questionId],
          questionId,
          value,
          isValid: validation.isComplete,
          isValidating: false
        }
      }))
    } else if (validationTrigger === 'blur' && value.trim()) {
      // Original questions: trigger AI validation if in blur mode
      validateAnswer(questionId, value)
    }
  }, [validationTrigger, validateAnswer])

  const handleChoiceChange = useCallback((questionId: string, value: string | string[]) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { questionId, value }
    }))
  }, [])

  // Helper functions for new submission flow (CARD_2)
  const showSubmissionNotification = useCallback((message: string, duration = 4000) => {
    setNotificationMessage(message)
    setShowNotification(true)
    
    setTimeout(() => {
      setShowNotification(false)
      setNotificationMessage('')
    }, duration)
  }, [])

  // Helper function to check if any answers are currently validating
  const isAnyAnswerValidating = useCallback((): boolean => {
    return Object.values(answers).some(answer => answer.isValidating === true)
  }, [answers])

  const detectNewFollowUps = (validationResults: ValidationResult[]): boolean => {
    return validationResults.some(result => 
      result.followUpQuestion !== undefined && result.followUpQuestion.trim().length > 0
    )
  }

  const getFollowUpQuestions = (validationResults: ValidationResult[]): Question[] => {
    return validationResults
      .filter(result => result.followUpQuestion !== undefined)
      .map(result => createFollowUpQuestion(result))
  }

  const injectFollowUpQuestions = useCallback((followUpQuestions: Question[]) => {
    const newQuestions = [...config.questions]
    
    followUpQuestions.forEach(followUp => {
      // Find the original question and insert follow-up after it
      const originalQuestionId = followUp.id.split('-followup-')[0]
      const originalIndex = newQuestions.findIndex(q => q.id === originalQuestionId)
      
      if (originalIndex !== -1) {
        // Check if this follow-up already exists to avoid duplicates
        const followUpExists = newQuestions.some(q => q.id === followUp.id)
        if (!followUpExists) {
          newQuestions.splice(originalIndex + 1, 0, followUp)
        }
      }
    })
    
    setConfig({ ...config, questions: newQuestions })
  }, [config, setConfig])

  const updateAnswersWithValidationResults = useCallback((results: ValidationResult[]) => {
    setAnswers(prev => {
      const updated = { ...prev }
      results.forEach(result => {
        updated[result.questionId] = {
          ...updated[result.questionId],
          questionId: result.questionId,
          value: updated[result.questionId]?.value || result.originalAnswer,
          isValidating: false,
          isValid: result.isValid,
          followUpQuestion: result.followUpQuestion
        }
      })
      return updated
    })
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🔥🔥🔥 HANDLESUBMIT CALLED - BASIC CHECK')
    console.log('🚀 FORM SUBMISSION STARTED')
    console.log('📋 Validation Trigger:', validationTrigger)
    console.log('📝 Current Answers:', answers)
    console.log('❓ Current Questions:', config.questions)
    
    setSubmissionStatus('validating')

    try {
      if (validationTrigger === 'submit') {
        console.log('🔄 BATCH VALIDATION MODE DETECTED')
        
        // STEP 1: Collect questions that need batch validation
        const questionsToValidate = config.questions
          .filter(q => 
            q.type === 'text' && 
            !isFollowUpQuestion(q.id) && // Skip follow-up questions
            q.enableLLMValidation !== false // Skip only if explicitly set to false (undefined defaults to true)
          )
          .map(question => ({
            questionId: question.id,
            question: question.question,
            answer: (answers[question.id]?.value as string) || ''
          }))
          .filter(item => 
            item.answer.trim() && // Has content to validate
            answers[item.questionId]?.isValid === undefined // Not already validated
          )

        console.log('📊 Questions to validate:', questionsToValidate)
        console.log('🔍 Questions already validated:', config.questions.filter(q => 
          answers[q.id]?.isValid !== undefined
        ).map(q => ({ id: q.id, isValid: answers[q.id]?.isValid })))

        let batchResults: BatchValidationResult | null = null

        // STEP 2: Run batch validation if needed
        if (questionsToValidate.length > 0) {
          console.log('🤖 Sending batch validation request...')
          batchResults = await validateAnswersBatch(questionsToValidate, selectedModel, answers)
          console.log('✅ Batch validation completed:', batchResults)
          
          // Update answers state with validation results
          updateAnswersWithValidationResults(batchResults.results)
          console.log('🔄 Updated validation results in state')
          
          // Handle validation errors
          if (batchResults.errors.length > 0) {
            console.error('❌ Validation errors:', batchResults.errors)
            showSubmissionNotification(
              `Validation failed for ${batchResults.errors.length} question(s). Please try again.`
            )
            setSubmissionStatus('idle')
            return
          }
        } else {
          console.log('⚡ No questions need validation, skipping batch validation')
        }

        // STEP 3: Check for newly generated follow-up questions
        console.log('🔍 Checking for follow-up questions...')
        const hasNewFollowUps = batchResults ? detectNewFollowUps(batchResults.results) : false
        console.log('🎯 Has new follow-ups:', hasNewFollowUps)
        
        if (batchResults?.results) {
          console.log('📋 Individual validation results:')
          batchResults.results.forEach(result => {
            console.log(`  - Q${result.questionId}: valid=${result.isValid}, followUp="${result.followUpQuestion || 'none'}"`)
          })
        }
        
        if (hasNewFollowUps) {
          console.log('⛔ HALTING SUBMISSION - Follow-ups detected!')
          // HALT SUBMISSION - Follow-ups were generated
          const followUpQuestions = getFollowUpQuestions(batchResults!.results)
          console.log('📝 Generated follow-up questions:', followUpQuestions)
          
          if (followUpDisplayMode === 'separate') {
            // Separate mode: inject follow-up questions into config (existing behavior)
            injectFollowUpQuestions(followUpQuestions)
            
            // Show notification to user
            const message = followUpQuestions.length === 1 
              ? 'A follow-up question has been added. Please answer it before submitting.'
              : `${followUpQuestions.length} follow-up questions have been added. Please answer them before submitting.`
            
            showSubmissionNotification(message)
            
            // Scroll to first follow-up question
            setTimeout(() => {
              const firstFollowUp = followUpQuestions[0]
              if (firstFollowUp) {
                const element = document.getElementById(`question-${firstFollowUp.id}`)
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
              }
            }, 100) // Small delay to ensure DOM is updated
          } else {
            // Inline mode: update validation state for questions needing more details
            const newValidationState = { ...questionValidationState }
            followUpQuestions.forEach(fq => {
              const originalQuestionId = fq.id.split('-followup-')[0]
              newValidationState[originalQuestionId] = {
                needsMoreDetails: true,
                followUpText: fq.question,
                isAdequate: false
              }
            })
            setQuestionValidationState(newValidationState)
            
            // Show notification for inline mode
            const message = followUpQuestions.length === 1
              ? 'Please provide more details for the highlighted question before submitting.'
              : `Please provide more details for the ${followUpQuestions.length} highlighted questions before submitting.`
            
            showSubmissionNotification(message)
          }
          
          setSubmissionStatus('halted')
          console.log('⛔ SUBMISSION HALTED - Returning from handleSubmit')
          return // CRITICAL: Stop execution here
        } else {
          console.log('✅ No new follow-ups detected, continuing...')
        }

        // STEP 4: Check for inadequate questions based on display mode
        console.log('🔍 Checking for existing unanswered follow-ups...')
        
        if (followUpDisplayMode === 'separate') {
          // Separate mode: check for unanswered follow-up questions
          const followUpStatus = getFollowUpCompletionStatus(config.questions, answers)
          console.log('📊 Follow-up status:', followUpStatus)

          if (followUpStatus.total > 0 && !followUpStatus.allComplete) {
            console.log('⛔ HALTING SUBMISSION - Unanswered follow-ups exist!')
            // Still have unanswered follow-ups from previous validations
            const message = followUpStatus.incomplete.length === 1 
              ? 'Please answer the follow-up question before submitting.'
              : `Please answer the ${followUpStatus.incomplete.length} follow-up questions before submitting.`
            
            showSubmissionNotification(message)
            
            // Scroll to first unanswered follow-up
            const firstUnanswered = followUpStatus.incomplete[0]
            const element = document.getElementById(`question-${firstUnanswered.id}`)
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
            
            setSubmissionStatus('halted')
            console.log('⛔ SUBMISSION HALTED - Unanswered follow-ups exist')
            return // Stop submission
          } else {
            console.log('✅ All follow-up questions answered, proceeding...')
          }
        } else {
          // Inline mode: check for questions that need more details
          const inadequateQuestions = Object.entries(questionValidationState)
            .filter(([_, state]) => state.needsMoreDetails && !state.isAdequate)
            .map(([questionId, _]) => questionId)
          
          console.log('📊 Inline validation status:', questionValidationState)
          console.log('⚠️ Questions needing more details:', inadequateQuestions)

          if (inadequateQuestions.length > 0) {
            console.log('⛔ HALTING SUBMISSION - Questions need more details!')
            const message = inadequateQuestions.length === 1 
              ? 'Please provide more details for the highlighted question before submitting.'
              : `Please provide more details for the ${inadequateQuestions.length} highlighted questions before submitting.`
            
            showSubmissionNotification(message)
            
            // Scroll to first question needing details
            const element = document.getElementById(`question-${inadequateQuestions[0]}`)
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
            
            setSubmissionStatus('halted')
            console.log('⛔ SUBMISSION HALTED - Questions need more details')
            return // Stop submission
          } else {
            console.log('✅ All questions have adequate details, proceeding...')
          }
        }
      }

      // STEP 5: All validations passed - proceed with submission
      console.log('🎉 ALL VALIDATIONS PASSED - PROCEEDING WITH SUBMISSION!')
      setSubmissionStatus('submitting')
      const submissionData = await submitSurvey(answers, config)
      console.log('✅ Survey submitted successfully:', submissionData)
      
      if (onSubmissionComplete) {
        onSubmissionComplete(submissionData)
      } else {
        alert('Survey submitted successfully!')
      }
      
    } catch (error) {
      console.error('Survey submission error:', error)
      showSubmissionNotification('Failed to submit survey. Please try again.')
    } finally {
      setSubmissionStatus('idle')
    }
  }, [
    validationTrigger, 
    config, 
    answers, 
    selectedModel, 
    onSubmissionComplete,
    updateAnswersWithValidationResults,
    injectFollowUpQuestions,
    showSubmissionNotification
  ])

  // Pure functions for validation logic (CARD_1)
  const parseValidationResponse = (
    response: { isValid: boolean; followUpQuestion?: string },
    questionId: string,
    question: string, 
    answer: string
  ): ValidationResult => {
    return {
      questionId,
      isValid: response.isValid,
      followUpQuestion: response.followUpQuestion,
      originalQuestion: question,
      originalAnswer: answer
    }
  }

  const hasFollowUpQuestions = (results: ValidationResult[]): boolean => {
    return results.some(result => result.followUpQuestion !== undefined && result.followUpQuestion.trim().length > 0)
  }

  const findScoreAnswer = (answers: Record<string, Answer>) => {
    const scoreAnswer = config.questions.find(q => q.type === 'single-choice')
    if (!scoreAnswer) return undefined
    const scoreValue = answers[scoreAnswer.id]?.value
    return Array.isArray(scoreValue) ? scoreValue[0] : scoreValue
  }

  const createFollowUpQuestion = (validationResult: ValidationResult): Question => {
    return {
      id: `${validationResult.questionId}-followup-${Date.now()}`,
      type: 'text',
      question: validationResult.followUpQuestion!,
      required: true,
      enableLLMValidation: false // Follow-up questions should never be validated with LLM
    }
  }

  // New batch validation function (CARD_1)
  const validateAnswersBatch = async (
    questionsToValidate: Array<{questionId: string, question: string, answer: string}>,
    selectedModel: string,
    existingAnswers: Record<string, Answer>
  ): Promise<BatchValidationResult> => {
    const results: ValidationResult[] = []
    const errors: string[] = []
    
    // Validate each question and collect results
    const validationPromises = questionsToValidate.map(async (item) => {
      try {
        const scoreAnswer = findScoreAnswer(existingAnswers)
        const response = await validateAnswerAPI(
          item.question, 
          item.answer, 
          selectedModel as 'chatgpt' | 'gemini', 
          scoreAnswer
        )
        
        return parseValidationResponse(response, item.questionId, item.question, item.answer)
      } catch (error) {
        errors.push(`Failed to validate question ${item.questionId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        return {
          questionId: item.questionId,
          isValid: undefined,
          error: error instanceof Error ? error.message : 'Unknown error',
          originalQuestion: item.question,
          originalAnswer: item.answer
        } as ValidationResult
      }
    })
    
    const validationResults = await Promise.all(validationPromises)
    results.push(...validationResults)
    
    return {
      results,
      hasFollowUps: hasFollowUpQuestions(results),
      errors,
      completedCount: results.filter(r => r.error === undefined).length,
      totalCount: results.length
    }
  }

  // Follow-up question utility functions (CARD_4)
  const isFollowUpQuestion = (questionId: string): boolean => {
    return questionId.includes('-followup-')
  }

  const getFollowUpQuestionsFromConfig = (questions: Question[]): Question[] => {
    return questions.filter(q => isFollowUpQuestion(q.id))
  }

  interface FollowUpValidationResult {
    questionId: string
    isComplete: boolean
    hasContent: boolean
    textLength: number
  }

  const validateFollowUpAnswer = (questionId: string, answer: string | string[]): FollowUpValidationResult => {
    const text = Array.isArray(answer) ? answer.join(' ') : answer
    const trimmedText = text.trim()
    
    return {
      questionId,
      isComplete: trimmedText.length > 0,
      hasContent: trimmedText.length > 0,
      textLength: trimmedText.length
    }
  }

  const validateAllFollowUpAnswers = (
    questions: Question[], 
    answers: Record<string, Answer>
  ): FollowUpValidationResult[] => {
    const followUpQuestions = getFollowUpQuestionsFromConfig(questions)
    
    return followUpQuestions.map(question => {
      const answer = answers[question.id]
      const answerValue = answer?.value || ''
      return validateFollowUpAnswer(question.id, answerValue)
    })
  }

  interface FollowUpStatus {
    total: number
    completed: number
    incomplete: Question[]
    allComplete: boolean
    completionRate: number
  }

  const getFollowUpCompletionStatus = (
    questions: Question[], 
    answers: Record<string, Answer>
  ): FollowUpStatus => {
    const followUpQuestions = getFollowUpQuestionsFromConfig(questions)
    const validationResults = validateAllFollowUpAnswers(questions, answers)
    
    const completed = validationResults.filter(result => result.isComplete).length
    const incomplete = followUpQuestions.filter(question => {
      const validation = validationResults.find(v => v.questionId === question.id)
      return !validation || !validation.isComplete
    })
    
    return {
      total: followUpQuestions.length,
      completed,
      incomplete,
      allComplete: incomplete.length === 0,
      completionRate: followUpQuestions.length > 0 ? Math.round((completed / followUpQuestions.length) * 100) : 100
    }
  }


  const renderQuestion = (question: Question) => {
    const answer = answers[question.id]
    const isFollowUp = isFollowUpQuestion(question.id)
    
    // Skip rendering follow-up questions in inline mode
    if (followUpDisplayMode === 'inline' && isFollowUp) {
      return null
    }
    
    // For follow-up questions in separate mode, determine completion status
    const followUpValidation = isFollowUp 
      ? validateFollowUpAnswer(question.id, answer?.value || '')
      : null
      
    // For inline mode, get validation state for this question
    const inlineValidationState = followUpDisplayMode === 'inline' 
      ? questionValidationState[question.id] 
      : null

    return (
      <div
        key={question.id}
        id={`question-${question.id}`}
        className={`group transition-all duration-200 ${
          isFollowUp 
            ? 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 shadow-sm rounded-2xl p-6 ml-6 relative'
            : inlineValidationState?.needsMoreDetails
            ? 'bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-300 shadow-md rounded-2xl p-6 relative'
            : inlineValidationState?.isAdequate
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 shadow-sm rounded-2xl p-6 relative'
            : 'bg-white border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md rounded-2xl p-6 relative'
        }`}
      >
        {/* Follow-up indicator */}
        {isFollowUp && (
          <div className="absolute -left-3 top-1/2 -translate-y-1/2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
              followUpValidation?.isComplete 
                ? 'bg-green-400' 
                : 'bg-amber-400'
            }`}>
              {followUpValidation?.isComplete ? (
                <CheckCircle className="w-3 h-3 text-white" />
              ) : (
                <MessageSquare className="w-3 h-3 text-white" />
              )}
            </div>
          </div>
        )}

        {/* Inline mode validation indicator */}
        {followUpDisplayMode === 'inline' && inlineValidationState && (
          <div className="absolute -left-3 top-1/2 -translate-y-1/2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
              inlineValidationState.isAdequate 
                ? 'bg-green-500' 
                : inlineValidationState.needsMoreDetails
                ? 'bg-orange-500'
                : 'bg-gray-400'
            }`}>
              {inlineValidationState.isAdequate ? (
                <CheckCircle className="w-3 h-3 text-white" />
              ) : inlineValidationState.needsMoreDetails ? (
                <AlertTriangle className="w-3 h-3 text-white" />
              ) : (
                <MessageSquare className="w-3 h-3 text-white" />
              )}
            </div>
          </div>
        )}

        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className={`text-lg font-semibold leading-relaxed ${
              isFollowUp 
                ? 'text-amber-900'
                : inlineValidationState?.needsMoreDetails
                ? 'text-orange-900'
                : inlineValidationState?.isAdequate
                ? 'text-green-900'
                : 'text-gray-900'
            }`}>
              {question.question}
              {/* Inline mode: add helper text to question title */}
              {followUpDisplayMode === 'inline' && inlineValidationState?.needsMoreDetails && (
                <span className="text-orange-600 font-normal"> (Please provide more specific details)</span>
              )}
              {question.required && <span className="text-red-500 ml-1 text-xl">*</span>}
            </h3>
            
            {/* Separate mode: follow-up question indicator */}
            {isFollowUp && (
              <p className="text-sm text-amber-700 mt-1 flex items-center gap-1">
                <Star className="w-3 h-3" />
                {followUpValidation?.isComplete 
                  ? 'Follow-up question completed' 
                  : 'Follow-up question - please provide details'
                }
              </p>
            )}
            
            {/* Inline mode: validation helper text */}
            {followUpDisplayMode === 'inline' && inlineValidationState && (
              <div className="mt-2">
                {inlineValidationState.needsMoreDetails && (
                  <p className="text-sm text-orange-700 bg-orange-100 border border-orange-200 rounded-lg px-3 py-2 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>More details needed:</strong> {inlineValidationState.followUpText}
                    </span>
                  </p>
                )}
                {inlineValidationState.isAdequate && (
                  <p className="text-sm text-green-700 bg-green-100 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Thank you for the detailed response!</span>
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Status indicator */}
          <div className="flex-shrink-0 ml-4">
            {/* Original question validation status */}
            {!isFollowUp && question.type === 'text' && answer?.isValidating && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 rounded-full">
                <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                <span className="text-xs text-blue-700 font-medium">Validating...</span>
              </div>
            )}
            {!isFollowUp && question.type === 'text' && !answer?.isValidating && answer?.isValid === true && (
              <div className="flex items-center gap-2 px-3 py-1 bg-green-100 rounded-full">
                <CheckCircle className="w-3 h-3 text-green-600" />
                <span className="text-xs text-green-700 font-medium">Valid</span>
              </div>
            )}
            {!isFollowUp && question.type === 'text' && !answer?.isValidating && answer?.isValid === false && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-100 rounded-full">
                <AlertCircle className="w-3 h-3 text-red-600" />
                <span className="text-xs text-red-700 font-medium">Needs more detail</span>
              </div>
            )}
            
            {/* Follow-up question completion status */}
            {isFollowUp && followUpValidation?.isComplete && (
              <div className="flex items-center gap-2 px-3 py-1 bg-green-100 rounded-full">
                <CheckCircle className="w-3 h-3 text-green-600" />
                <span className="text-xs text-green-700 font-medium">Complete</span>
              </div>
            )}
            {isFollowUp && !followUpValidation?.isComplete && (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-100 rounded-full">
                <AlertCircle className="w-3 h-3 text-amber-600" />
                <span className="text-xs text-amber-700 font-medium">Please answer</span>
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
              disabled={(submissionStatus === 'validating' || submissionStatus === 'submitting') || !backendConnected || (validationTrigger === 'blur' && isAnyAnswerValidating())}
              className={`flex items-center gap-3 px-8 py-4 rounded-xl font-semibold transition-all duration-200 ${
                (submissionStatus === 'validating' || submissionStatus === 'submitting') || !backendConnected || (validationTrigger === 'blur' && isAnyAnswerValidating())
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : submissionStatus === 'halted'
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
              }`}
            >
              {((submissionStatus === 'validating' || submissionStatus === 'submitting') || (validationTrigger === 'blur' && isAnyAnswerValidating())) && <Loader2 className="w-4 h-4 animate-spin" />}
              {submissionStatus === 'validating' && 'Validating...'}
              {submissionStatus === 'submitting' && 'Submitting...'}
              {submissionStatus === 'halted' && 'Complete Follow-ups First'}
              {validationTrigger === 'blur' && isAnyAnswerValidating() && submissionStatus === 'idle' && 'Validating Answers...'}
              {submissionStatus === 'idle' && !isAnyAnswerValidating() && 'Submit Survey'}
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

      {/* Notification Component (CARD_2) */}
      {showNotification && (
        <div className="fixed top-4 right-4 bg-yellow-100 border-l-4 border-yellow-500 p-4 rounded-lg shadow-lg z-50">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-yellow-500 mr-3" />
            <span className="text-yellow-800">{notificationMessage}</span>
          </div>
        </div>
      )}
    </div>
  )
}