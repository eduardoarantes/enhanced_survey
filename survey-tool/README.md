# Enhanced Survey Tool

A modern, AI-powered survey builder with real-time form generation and intelligent validation capabilities.

![Enhanced Survey Tool](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![React](https://img.shields.io/badge/React-19.1.1-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4-06B6D4)

## 🚀 Features

- **Modern UI/UX**: Professional interface with 2024 design standards
- **Real-time Form Generation**: JSON configuration instantly creates survey forms
- **AI-Powered Validation**: OpenAI integration for intelligent answer validation
- **Multiple Question Types**: Support for text, single-choice, and multiple-choice questions
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Code Editors**: Monaco editors for LLM prompts and JSON configuration
- **Dynamic Follow-ups**: AI can generate follow-up questions based on responses

## 📋 Question Types

### 1. Text Questions

Free-form text input allowing users to provide detailed responses.

```json
{
  "id": "1",
  "type": "text",
  "question": "What is your main goal for this project?",
  "required": true
}
```

**Features:**
- Multi-line textarea input
- AI validation for response quality
- Automatic follow-up question generation
- Character limit support (optional)
- Placeholder text customization

**Use Cases:**
- Open-ended feedback
- Detailed explanations
- User stories and requirements
- Comments and suggestions

---

### 2. Single-Choice Questions

Radio button selection allowing users to choose one option from multiple choices.

```json
{
  "id": "2",
  "type": "single-choice",
  "question": "What is your experience level?",
  "options": ["Beginner", "Intermediate", "Advanced", "Expert"],
  "required": true
}
```

**Features:**
- Radio button interface
- Custom option labels
- Required/optional validation
- Visual selection indicators
- Keyboard navigation support

**Use Cases:**
- Skill level assessment
- Preference selection
- Demographic information
- Rating scales
- Yes/No questions

---

### 3. Multiple-Choice Questions

Checkbox selection allowing users to choose multiple options from a list.

```json
{
  "id": "3",
  "type": "multiple-choice",
  "question": "Which technologies interest you most?",
  "options": ["React", "Vue", "Angular", "Svelte", "Node.js", "Python", "TypeScript"],
  "required": false
}
```

**Features:**
- Checkbox interface
- Multiple selections allowed
- Individual option validation
- Select all/none functionality
- Minimum/maximum selection limits (configurable)

**Use Cases:**
- Technology preferences
- Feature requests
- Multi-category selections
- Interest areas
- Skill assessments

## 🛠️ Installation

```bash
# Clone the repository
git clone <repository-url>
cd survey-tool

# Install dependencies
npm install

# Start development server
npm run dev
```

## 📖 Usage

### Basic Configuration

1. **Start the application**: Navigate to `http://localhost:5173`
2. **Open Configuration**: Click the gear icon in the top-right corner
3. **Add OpenAI API Key**: Enter your API key for AI validation features
4. **Configure Survey**: Edit the JSON in the configuration panel

### JSON Configuration Format

```json
{
  "questions": [
    {
      "id": "unique-id",
      "type": "text|single-choice|multiple-choice",
      "question": "Your question text here",
      "options": ["Option 1", "Option 2"], // Only for choice questions
      "required": true // or false
    }
  ]
}
```

### AI Validation Settings

- **Trigger Options**:
  - `blur`: Validate when user leaves the field (immediate feedback)
  - `submit`: Validate all fields when form is submitted (batch validation)

- **Custom LLM Prompts**: Modify the validation prompt to customize AI behavior

## 🎨 Customization

### Styling

The application uses Tailwind CSS for styling. Key design features:

- **Modern Card Layout**: Rounded corners with subtle shadows
- **Responsive Design**: Mobile-first approach with breakpoint optimization
- **Interactive States**: Hover, focus, and active state animations
- **Professional Color Palette**: Blue/indigo gradient scheme
- **Typography Hierarchy**: Clear heading and body text distinction

### Question Types Extension

To add new question types:

1. Update the `Question` interface in `src/App.tsx`
2. Add rendering logic in `src/components/SurveyForm.tsx`
3. Update validation logic for the new question type
4. Add styling for the new form elements

## 🔧 Technical Details

### Architecture

- **Frontend**: React 19 with TypeScript
- **Styling**: Tailwind CSS 3.4
- **Code Editors**: Monaco Editor for JSON and prompt editing
- **AI Integration**: OpenAI GPT-3.5-turbo for validation
- **Build Tool**: Vite 7.1.3

### Key Components

- `App.tsx`: Main application component and state management
- `ConfigurationPanel.tsx`: Sliding configuration panel with editors
- `SurveyForm.tsx`: Dynamic form generation and validation
- `index.css`: Global styles and Tailwind configuration

### State Management

The application uses React hooks for state management:

- Survey configuration (questions, validation settings)
- Form responses and validation states
- UI state (panel visibility, loading states)

## 📱 Responsive Breakpoints

- **Mobile**: < 640px (sm)
- **Tablet**: 640px - 1024px (sm to lg)
- **Desktop**: > 1024px (lg+)

## 🤖 AI Features

### Validation

- **Quality Assessment**: Evaluates response completeness and relevance
- **Follow-up Generation**: Creates additional questions based on insufficient responses
- **Custom Prompts**: Configurable validation criteria

### Integration

```javascript
// Example validation trigger
const response = await openai.chat.completions.create({
  model: 'gpt-3.5-turbo',
  messages: [
    { role: 'system', content: validationPrompt },
    { role: 'user', content: `Question: "${question}"\nAnswer: "${answer}"` }
  ]
});
```

## 🚦 Development

### Available Scripts

```bash
# Development server
npm run dev

# Production build
npm run build

# Type checking
npm run lint

# Preview production build
npm run preview
```

### Environment Requirements

- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- OpenAI API key (for AI features)

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-question-type`)
3. Commit your changes (`git commit -am 'Add new question type'`)
4. Push to the branch (`git push origin feature/new-question-type`)
5. Create a Pull Request

## 📞 Support

For questions and support, please open an issue in the repository or contact the development team.

---

**Built with ❤️ using React, TypeScript, and AI**
