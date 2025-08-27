import { useState, useCallback, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { Key, Zap, Code, AlertTriangle, X, Brain, Sparkles, Save } from 'lucide-react'
import type { SurveyConfig } from '../App'
import { updateLLMPrompt, type LLMPromptData } from '../services/llmService'

interface ConfigurationPanelProps {
  config: SurveyConfig
  setConfig: (config: SurveyConfig) => void
  llmPrompt: LLMPromptData
  setLlmPrompt: (prompt: LLMPromptData) => void
  validationTrigger: 'blur' | 'submit'
  setValidationTrigger: (trigger: 'blur' | 'submit') => void
  selectedModel: 'chatgpt' | 'gemini'
  setSelectedModel: (model: 'chatgpt' | 'gemini') => void
  followUpDisplayMode: 'separate' | 'inline'
  setFollowUpDisplayMode: (mode: 'separate' | 'inline') => void
  onClose?: (isPostSave?: boolean) => void
  onSave?: () => Promise<boolean>
  hasUnsavedChanges?: boolean
}

export default function ConfigurationPanel({
  config,
  setConfig,
  llmPrompt,
  setLlmPrompt,
  validationTrigger,
  setValidationTrigger,
  selectedModel,
  setSelectedModel,
  followUpDisplayMode,
  setFollowUpDisplayMode,
  onClose,
  onSave,
  hasUnsavedChanges = false
}: ConfigurationPanelProps) {
  const [jsonError, setJsonError] = useState<string>('')
  const [promptChanged, setPromptChanged] = useState(false)
  const [currentPrompt, setCurrentPrompt] = useState(llmPrompt)
  const [isSaving, setIsSaving] = useState(false)

  // Handle save configuration
  const handleSave = async () => {
    if (!onSave) return
    
    setIsSaving(true)
    try {
      // Save LLM prompt changes first if any
      if (promptChanged) {
        await savePromptToBackend()
      }
      
      // Save main configuration
      const saveSuccess = await onSave()
      
      // If configuration was saved successfully, close panel and refresh page
      if (saveSuccess) {
        // First close the panel without triggering unsaved changes popup
        if (onClose) {
          onClose(true) // Pass true to indicate this is a post-save close
        }
        // Reload the page immediately - the isSavingConfig flag will prevent popup
        window.location.reload()
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleSystemPromptChange = useCallback((value: string | undefined) => {
    if (!value) return
    
    const newPrompt = { ...currentPrompt, systemPrompt: value }
    setCurrentPrompt(newPrompt)
    setLlmPrompt(newPrompt)
    setPromptChanged(true)
  }, [currentPrompt, setLlmPrompt])

  const handleUserPromptChange = useCallback((value: string | undefined) => {
    if (!value) return
    
    const newPrompt = { ...currentPrompt, userPrompt: value }
    setCurrentPrompt(newPrompt)
    setLlmPrompt(newPrompt)
    setPromptChanged(true)
  }, [currentPrompt, setLlmPrompt])

  const savePromptToBackend = useCallback(async () => {
    if (!promptChanged || !currentPrompt) return
    
    try {
      await updateLLMPrompt(currentPrompt)
      setPromptChanged(false)
      console.log('LLM prompt saved to backend')
    } catch (error) {
      console.error('Failed to save LLM prompt:', error)
    }
  }, [currentPrompt, promptChanged])


  const handlePanelClose = useCallback(() => {
    if (promptChanged) {
      savePromptToBackend()
    }
    if (onClose) {
      // Don't call onClose if we're in the middle of a save operation
      if (!isSaving) {
        onClose(false) // Pass false to indicate this is a manual close (not post-save)
      }
    }
  }, [promptChanged, savePromptToBackend, onClose, isSaving])

  // Sync currentPrompt when llmPrompt changes from parent
  useEffect(() => {
    setCurrentPrompt(llmPrompt)
  }, [llmPrompt])

  const handleJsonChange = useCallback((value: string | undefined) => {
    if (!value) return

    try {
      const parsed = JSON.parse(value)
      if (parsed.questions && Array.isArray(parsed.questions)) {
        setConfig(parsed)
        setJsonError('')
      } else {
        setJsonError('Invalid format: questions array is required')
      }
    } catch (error) {
      setJsonError('Invalid JSON format')
    }
  }, [setConfig])

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
              <Key className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">Configuration</h2>
                {hasUnsavedChanges && (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100 rounded-full">
                    Unsaved changes
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">Configure your survey settings</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {onSave && (
              <button
                onClick={handleSave}
                disabled={isSaving || (!hasUnsavedChanges && !promptChanged)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  isSaving || (!hasUnsavedChanges && !promptChanged)
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            )}
            
            {onClose && (
              <button
                onClick={handlePanelClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        
        {/* AI Model Selection */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">AI Model</h3>
              <p className="text-xs text-gray-500">Choose between ChatGPT and Google Gemini</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* ChatGPT Option */}
            <label 
              className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                selectedModel === 'chatgpt'
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="model"
                value="chatgpt"
                checked={selectedModel === 'chatgpt'}
                onChange={(e) => setSelectedModel(e.target.value as 'chatgpt' | 'gemini')}
                className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <div className="flex items-center gap-3 flex-1">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <span className="text-gray-900 font-medium">ChatGPT</span>
                  <p className="text-xs text-gray-500">OpenAI GPT-3.5 Turbo</p>
                </div>
              </div>
            </label>

            {/* Gemini Option */}
            <label 
              className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                selectedModel === 'gemini'
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="model"
                value="gemini"
                checked={selectedModel === 'gemini'}
                onChange={(e) => setSelectedModel(e.target.value as 'chatgpt' | 'gemini')}
                className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <div className="flex items-center gap-3 flex-1">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Brain className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <span className="text-gray-900 font-medium">Google Gemini</span>
                  <p className="text-xs text-gray-500">Gemini 1.5 Flash</p>
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Validation Settings */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Validation Settings</h3>
              <p className="text-xs text-gray-500">When to trigger AI validation</p>
            </div>
          </div>

          <select
            value={validationTrigger}
            onChange={(e) => setValidationTrigger(e.target.value as 'blur' | 'submit')}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 hover:bg-white focus:bg-white text-sm transition-all duration-200 cursor-pointer"
          >
            <option value="blur">On field blur (immediate)</option>
            <option value="submit">On form submit (batch)</option>
          </select>
        </div>

        {/* Follow-up Display Settings */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Follow-up Display Mode</h3>
              <p className="text-xs text-gray-500">How to show follow-up questions when validation requires more details</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* Separate Mode */}
            <label 
              className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                followUpDisplayMode === 'separate'
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="followUpDisplayMode"
                value="separate"
                checked={followUpDisplayMode === 'separate'}
                onChange={(e) => setFollowUpDisplayMode(e.target.value as 'separate' | 'inline')}
                className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500 mt-0.5"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900 mb-1">🔗 Separate Questions</div>
                <p className="text-xs text-gray-600">Create additional question fields below the original (current behavior)</p>
              </div>
            </label>

            {/* Inline Mode */}
            <label 
              className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                followUpDisplayMode === 'inline'
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="followUpDisplayMode"
                value="inline"
                checked={followUpDisplayMode === 'inline'}
                onChange={(e) => setFollowUpDisplayMode(e.target.value as 'separate' | 'inline')}
                className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500 mt-0.5"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900 mb-1">✏️ Inline Enhancement</div>
                <p className="text-xs text-gray-600">Update original question text with visual indicators when more details are needed</p>
              </div>
            </label>
          </div>
        </div>

        {/* LLM Prompt Section */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                LLM Validation Prompts
                {promptChanged && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700 border border-orange-200">
                    Unsaved
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-500">System and User prompts for AI validation • Changes save on panel close</p>
            </div>
          </div>
          
          {/* System Prompt */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">System Prompt</h4>
            <p className="text-xs text-gray-500 mb-3">Sets the AI's role and overall behavior</p>
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
              <Editor
                height="180px"
                defaultLanguage="markdown"
                value={currentPrompt.systemPrompt}
                onChange={handleSystemPromptChange}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                  wordWrap: 'on',
                  lineNumbers: 'off',
                  glyphMargin: false,
                  folding: false,
                  lineDecorationsWidth: 0,
                  lineNumbersMinChars: 0,
                  padding: { top: 16, bottom: 16 },
                  renderLineHighlight: 'none',
                  hideCursorInOverviewRuler: true,
                  overviewRulerBorder: false,
                  renderValidationDecorations: 'off'
                }}
              />
            </div>
          </div>

          {/* User Prompt */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">User Prompt Template</h4>
            <p className="text-xs text-gray-500 mb-3">Template for user messages • Use {`{question}`}, {`{score}`}, {`{answer}`} placeholders</p>
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
              <Editor
                height="200px"
                defaultLanguage="markdown"
                value={currentPrompt.userPrompt}
                onChange={handleUserPromptChange}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                  wordWrap: 'on',
                  lineNumbers: 'off',
                  glyphMargin: false,
                  folding: false,
                  lineDecorationsWidth: 0,
                  lineNumbersMinChars: 0,
                  padding: { top: 16, bottom: 16 },
                  renderLineHighlight: 'none',
                  hideCursorInOverviewRuler: true,
                  overviewRulerBorder: false,
                  renderValidationDecorations: 'off'
                }}
              />
            </div>
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-700 font-medium mb-1">Available Placeholders:</p>
              <code className="text-xs text-blue-600 block">
                {`{question}`} - The survey question text<br />
                {`{score}`} - Selected score/rating (if applicable)<br />
                {`{answer}`} - User's text response
              </code>
            </div>
          </div>
        </div>

        {/* Survey Questions JSON */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Code className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Survey Questions</h3>
              <p className="text-xs text-gray-500">Define your survey structure in JSON</p>
            </div>
          </div>

          {jsonError && (
            <div className="mb-4 flex items-start gap-3 p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">JSON Error</p>
                <p className="text-xs text-red-600 mt-1">{jsonError}</p>
              </div>
            </div>
          )}
          
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
            <Editor
              height="300px"
              defaultLanguage="json"
              value={JSON.stringify(config, null, 2)}
              onChange={handleJsonChange}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 13,
                padding: { top: 16, bottom: 16 }
              }}
            />
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-700 font-medium mb-2">JSON Format:</p>
            <code className="text-xs text-blue-600 block">
              {"{"}"questions": [{"{"}"id": "1", "type": "text|single-choice|multiple-choice", "question": "...", "options": [...], "required": true, "enableLLMValidation": true{"}"}]{"}"}
            </code>
            <div className="mt-2 text-xs text-blue-600">
              <p><strong>enableLLMValidation</strong>: For text questions only. Set to false to disable AI validation for specific questions. Follow-up questions are automatically excluded from validation.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}