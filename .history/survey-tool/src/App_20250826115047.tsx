import { useState } from 'react'
import { Settings, Sparkles } from 'lucide-react'
import ConfigurationPanel from './components/ConfigurationPanel'
import SurveyForm from './components/SurveyForm'

export interface Question {
  id: string
  type: 'text' | 'multiple-choice' | 'single-choice'
  question: string
  options?: string[]
  required?: boolean
}

export interface SurveyConfig {
  questions: Question[]
}

function App() {
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
        required: true
      }
    ]
  })
  const [llmPrompt, setLlmPrompt] = useState('Evaluate if this answer provides sufficient detail for the question asked. Respond with "sufficient" if the answer is detailed enough, or "insufficient" followed by a specific follow-up question to gather more details.')
  const [validationTrigger, setValidationTrigger] = useState<'blur' | 'submit'>('blur')
  const [selectedModel, setSelectedModel] = useState<'chatgpt' | 'gemini'>('chatgpt')
  const [isConfigOpen, setIsConfigOpen] = useState(false)

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
            
            {/* Configuration Toggle */}
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
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="relative">
          {/* Survey Form - Full Width */}
          <div className="w-full">
            <SurveyForm
              config={config}
              setConfig={setConfig}
              llmPrompt={llmPrompt}
              validationTrigger={validationTrigger}
              selectedModel={selectedModel}
            />
          </div>

          {/* Configuration Panel - Sliding Overlay */}
          <div
            className={`fixed top-16 right-0 h-[calc(100vh-4rem)] w-full max-w-2xl transform transition-transform duration-300 ease-in-out z-30 ${
              isConfigOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="h-full bg-white border-l border-gray-200 shadow-2xl">
              <ConfigurationPanel
                config={config}
                setConfig={setConfig}
                llmPrompt={llmPrompt}
                setLlmPrompt={setLlmPrompt}
                validationTrigger={validationTrigger}
                setValidationTrigger={setValidationTrigger}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                onClose={() => setIsConfigOpen(false)}
              />
            </div>
          </div>

          {/* Backdrop */}
          {isConfigOpen && (
            <div
              className="fixed inset-0 top-16 bg-black/20 backdrop-blur-sm z-20"
              onClick={() => setIsConfigOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default App
