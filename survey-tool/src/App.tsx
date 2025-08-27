import { useState, useEffect } from 'react'
import { Settings, Sparkles } from 'lucide-react'
import ConfigurationPanel from './components/ConfigurationPanel'
import SurveyForm from './components/SurveyForm'
import SurveyResults from './components/SurveyResults'
import type { SubmitSurveyResponse } from './services/llmService'
import { getLLMPrompt, loadConfiguration, type LLMPromptData, type ConfigurationData } from './services/llmService'

export interface Question {
  id: string
  type: 'text' | 'multiple-choice' | 'single-choice'
  question: string
  options?: string[]
  required?: boolean
  enableLLMValidation?: boolean
}

export interface SurveyConfig {
  questions: Question[]
}

function App() {
  // Original configuration (persistent, saved to backend)
  const [originalConfig, setOriginalConfig] = useState<SurveyConfig>({
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
        required: true,
        enableLLMValidation: true
      }
    ]
  })
  
  // Current session configuration (includes follow-up questions, session-only)
  const [config, setConfig] = useState<SurveyConfig>({
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
        required: true,
        enableLLMValidation: true
      }
    ]
  })
  const [llmPrompt, setLlmPrompt] = useState<LLMPromptData>({
    systemPrompt: 'You are an AI assistant helping to validate survey responses. Your task is to evaluate if answers provide sufficient detail for the questions asked.',
    userPrompt: 'Question: "{question}"\nScore: {score}\nAnswer: "{answer}"\n\nEvaluate if this answer provides sufficient detail for the question asked. Respond with "sufficient" if the answer is detailed enough, or "insufficient" followed by a specific follow-up question to gather more details.'
  })
  const [validationTrigger, setValidationTrigger] = useState<'blur' | 'submit'>('blur')
  const [selectedModel, setSelectedModel] = useState<'chatgpt' | 'gemini'>('gemini')
  const [followUpDisplayMode, setFollowUpDisplayMode] = useState<'separate' | 'inline'>('separate')
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [submissionData, setSubmissionData] = useState<SubmitSurveyResponse | null>(null)
  
  // Configuration persistence states
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastSavedConfig, setLastSavedConfig] = useState<ConfigurationData | null>(null)
  const [isSavingConfig, setIsSavingConfig] = useState(false)

  // Load configuration and LLM prompt from backend on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load configuration
        const configData = await loadConfiguration()
        const loadedConfig = { questions: configData.questions }
        setOriginalConfig(loadedConfig)
        setConfig(loadedConfig) // Initialize session config with original
        setValidationTrigger(configData.validationTrigger)
        setSelectedModel(configData.selectedModel)
        setFollowUpDisplayMode(configData.followUpDisplayMode)
        setLastSavedConfig(configData)
        
        // Load LLM prompt
        const promptData = await getLLMPrompt()
        setLlmPrompt(promptData)
        
        console.log('Configuration loaded successfully')
      } catch (error) {
        console.error('Failed to load configuration:', error)
      }
    }
    loadData()
  }, [])

  // Track changes to detect unsaved modifications (only check original config, not session follow-ups)
  useEffect(() => {
    if (lastSavedConfig) {
      const currentConfig: ConfigurationData = {
        validationTrigger,
        selectedModel,
        followUpDisplayMode,
        questions: originalConfig.questions // Use original config, not session config with follow-ups
      }
      
      const hasChanges = JSON.stringify(currentConfig) !== JSON.stringify({
        validationTrigger: lastSavedConfig.validationTrigger,
        selectedModel: lastSavedConfig.selectedModel,
        followUpDisplayMode: lastSavedConfig.followUpDisplayMode,
        questions: lastSavedConfig.questions
      })
      
      setHasUnsavedChanges(hasChanges)
    }
  }, [originalConfig, validationTrigger, selectedModel, followUpDisplayMode, lastSavedConfig])

  // Sync session config when original config changes (e.g., from configuration panel)
  useEffect(() => {
    setConfig(originalConfig)
  }, [originalConfig])

  // Helper function to reset session config to original (removes follow-ups)
  const resetSessionConfig = () => {
    setConfig(originalConfig)
  }

  const handleSubmissionComplete = (data: SubmitSurveyResponse) => {
    setSubmissionData(data)
    setIsConfigOpen(false)
    // Reset session config to remove any follow-up questions for next session
    resetSessionConfig()
  }

  const handleBackToSurvey = () => {
    setSubmissionData(null)
    // Reset session config to remove any follow-up questions for fresh start
    resetSessionConfig()
  }

  // Handle configuration save (only save original config, exclude follow-up questions)
  const handleConfigSave = async (): Promise<boolean> => {
    try {
      setIsSavingConfig(true)
      
      const configToSave: ConfigurationData = {
        validationTrigger,
        selectedModel,
        followUpDisplayMode,
        questions: originalConfig.questions // Only save original questions, not session follow-ups
      }
      
      const { saveConfiguration } = await import('./services/llmService')
      await saveConfiguration(configToSave)
      
      // Update state synchronously before any close handlers can run
      setLastSavedConfig(configToSave)
      setHasUnsavedChanges(false)
      
      console.log('Configuration saved successfully')
      return true
    } catch (error) {
      console.error('Failed to save configuration:', error)
      alert('Failed to save configuration. Please try again.')
      return false
    } finally {
      setIsSavingConfig(false)
    }
  }

  // Handle configuration panel close with unsaved changes check
  const handleConfigClose = (isPostSave: boolean = false) => {
    // Skip unsaved changes check if this is a post-save close OR if we're currently saving
    if (!isPostSave && hasUnsavedChanges && !isSavingConfig) {
      const shouldClose = window.confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      )
      if (!shouldClose) {
        return
      }
    }
    setIsConfigOpen(false)
  }

  // Wrapper for onClick events (e.g., backdrop click)
  const handleConfigCloseClick = () => {
    handleConfigClose(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Enhanced Survey Tool
                </h1>
                <p className="text-sm text-gray-500">AI-Powered Survey Builder</p>
              </div>
            </div>
            
            {/* Configuration Toggle - Only show when not showing results */}
            {!submissionData && (
              <button
                onClick={() => setIsConfigOpen(!isConfigOpen)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-200 ${
                  isConfigOpen
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline text-sm font-medium">
                  {isConfigOpen ? 'Hide Config' : 'Configuration'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="relative">
          {/* Conditional Content - Survey Form or Results */}
          <div className="w-full">
            {submissionData ? (
              <SurveyResults
                submissionData={submissionData}
                onBack={handleBackToSurvey}
              />
            ) : (
              <SurveyForm
                config={config}
                setConfig={setConfig}
                validationTrigger={validationTrigger}
                selectedModel={selectedModel}
                followUpDisplayMode={followUpDisplayMode}
                onSubmissionComplete={handleSubmissionComplete}
              />
            )}
          </div>

          {/* Configuration Panel - Sliding Overlay - Only show when not showing results */}
          {!submissionData && (
            <div
              className={`fixed top-16 right-0 h-[calc(100vh-4rem)] w-full max-w-2xl transform transition-transform duration-300 ease-in-out z-30 ${
                isConfigOpen ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              <div className="h-full bg-white border-l border-gray-200 shadow-2xl">
                <ConfigurationPanel
                  config={originalConfig}
                  setConfig={setOriginalConfig}
                  llmPrompt={llmPrompt}
                  setLlmPrompt={setLlmPrompt}
                  validationTrigger={validationTrigger}
                  setValidationTrigger={setValidationTrigger}
                  selectedModel={selectedModel}
                  setSelectedModel={setSelectedModel}
                  followUpDisplayMode={followUpDisplayMode}
                  setFollowUpDisplayMode={setFollowUpDisplayMode}
                  onClose={handleConfigClose}
                  onSave={handleConfigSave}
                  hasUnsavedChanges={hasUnsavedChanges}
                />
              </div>
            </div>
          )}

          {/* Backdrop - Only show when not showing results */}
          {!submissionData && isConfigOpen && (
            <div
              className="fixed inset-0 top-16 bg-black/20 backdrop-blur-sm z-20"
              onClick={handleConfigCloseClick}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default App