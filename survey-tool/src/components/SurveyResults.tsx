import { useState, useEffect } from 'react'
import { CheckCircle, BarChart3, Clock, User, ArrowLeft, Download, Share2, Sparkles, MessageSquare, Star } from 'lucide-react'

export interface SurveySubmissionData {
  success: boolean
  submissionId: string
  sessionId: string
  submittedAt: string
  summary: {
    questionsCount: number
    responsesCount: number
    completionRate: number
  }
  responses: Record<string, any>
  config: {
    questions: Array<{
      id: string
      type: string
      question: string
      options?: string[]
    }>
  }
  message: string
}

interface SurveyResultsProps {
  submissionData: SurveySubmissionData
  onBack: () => void
}

export default function SurveyResults({ submissionData, onBack }: SurveyResultsProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Trigger animation after component mounts
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const renderAnswer = (questionId: string, answer: any) => {
    const isFollowUp = questionId.includes('followup')
    
    if (Array.isArray(answer)) {
      return (
        <div className="flex flex-wrap gap-2">
          {answer.map((item, index) => (
            <span 
              key={index}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
            >
              {item}
            </span>
          ))}
        </div>
      )
    }
    
    return (
      <div className={`p-4 rounded-xl ${isFollowUp ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-200'}`}>
        <p className={`${isFollowUp ? 'text-amber-900' : 'text-gray-700'} leading-relaxed`}>
          {answer || 'No response'}
        </p>
        {isFollowUp && (
          <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
            <Star className="w-3 h-3" />
            AI-generated follow-up question
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-indigo-100 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Success Header */}
        <div className={`text-center mb-8 transform transition-all duration-1000 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        }`}>
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Survey Completed!</h1>
          <p className="text-xl text-gray-600 mb-4">Thank you for your valuable feedback</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-200">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              Submitted {formatTimestamp(submissionData.submittedAt)}
            </span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 transform transition-all duration-1000 delay-300 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        }`}>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Completion Rate</h3>
                <p className="text-2xl font-bold text-blue-600">{submissionData.summary.completionRate}%</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Questions Answered</h3>
                <p className="text-2xl font-bold text-purple-600">
                  {submissionData.summary.responsesCount}/{submissionData.summary.questionsCount}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <User className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Session ID</h3>
                <p className="text-sm font-mono text-green-600 truncate">
                  {submissionData.sessionId.slice(0, 8)}...
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Responses Section */}
        <div className={`bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden transform transition-all duration-1000 delay-500 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        }`}>
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Your Responses</h2>
                <p className="text-sm text-gray-600">Here's a summary of everything you shared</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-8">
            {submissionData.config.questions.map((question, index) => {
              const response = submissionData.responses[question.id]
              const isFollowUp = question.id.includes('followup')
              
              return (
                <div 
                  key={question.id}
                  className={`transform transition-all duration-700 ${
                    isVisible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
                  }`}
                  style={{ transitionDelay: `${800 + index * 200}ms` }}
                >
                  <div className={`relative ${isFollowUp ? 'ml-6' : ''}`}>
                    {isFollowUp && (
                      <div className="absolute -left-3 top-1/2 -translate-y-1/2">
                        <div className="w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center">
                          <MessageSquare className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    )}
                    
                    <div className={`p-6 rounded-2xl ${
                      isFollowUp 
                        ? 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200' 
                        : 'bg-gray-50 border border-gray-200'
                    }`}>
                      <div className="flex items-start gap-3 mb-4">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                          isFollowUp ? 'bg-amber-500' : 'bg-blue-500'
                        }`}>
                          {isFollowUp ? 'F' : index + 1}
                        </div>
                        <div className="flex-1">
                          <h3 className={`text-lg font-semibold mb-2 ${
                            isFollowUp ? 'text-amber-900' : 'text-gray-900'
                          }`}>
                            {question.question}
                          </h3>
                          {isFollowUp && (
                            <p className="text-xs text-amber-700 mb-3 flex items-center gap-1">
                              <Star className="w-3 h-3" />
                              Generated by AI based on your previous answer
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="ml-11">
                        {response ? (
                          renderAnswer(question.id, response.value)
                        ) : (
                          <div className="p-4 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300">
                            <p className="text-gray-500 text-center">No response provided</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className={`flex flex-col sm:flex-row gap-4 mt-8 transform transition-all duration-1000 delay-1000 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        }`}>
          <button
            onClick={onBack}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-white text-gray-700 border-2 border-gray-300 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <ArrowLeft className="w-5 h-5" />
            Create New Survey
          </button>
          
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Download className="w-5 h-5" />
            Download Results
          </button>
          
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: 'Survey Results',
                  text: `Survey completed with ${submissionData.summary.completionRate}% completion rate`,
                  url: window.location.href
                })
              } else {
                navigator.clipboard.writeText(window.location.href)
                alert('Link copied to clipboard!')
              }
            }}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Share2 className="w-5 h-5" />
            Share Results
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-sm text-gray-400">
            Submission ID: {submissionData.submissionId}
          </p>
        </div>
      </div>
    </div>
  )
}