// ─────────────────────────────────────────────────────────────────────────────
// PrepAI — Mock / Static Data
// ─────────────────────────────────────────────────────────────────────────────

// ── Logged-in user ────────────────────────────────────────────────────────────
export const currentUser = {
  name:       'Alex Johnson',
  email:      'alex.johnson@email.com',
  role:       'Frontend Developer',
  experience: 'Mid-Level (3–6 years)',
  joinedDate: 'January 2024',
  avatarInitials: 'AJ',
  resumeFile: 'alex_johnson_resume.pdf',
  interviewsCompleted: 14,
  avgScore: 76,
  streak: 7,
  mcqSolved: 132,
}

// ── Target roles ──────────────────────────────────────────────────────────────
export const roles = [
  {
    id: 1,
    title: 'Software Engineer',
    icon: 'Code2',
    description: 'Backend, frontend, or full-stack engineering roles',
    popular: true,
    tags: ['Algorithms', 'System Design', 'Coding'],
  },
  {
    id: 2,
    title: 'Frontend Developer',
    icon: 'Monitor',
    description: 'React, Vue, Angular and modern web development',
    popular: true,
    tags: ['React', 'CSS', 'Performance'],
  },
  {
    id: 3,
    title: 'Backend Developer',
    icon: 'Server',
    description: 'APIs, databases, and server-side architecture',
    popular: false,
    tags: ['Node.js', 'Databases', 'APIs'],
  },
  {
    id: 4,
    title: 'Full Stack Developer',
    icon: 'Layers',
    description: 'End-to-end development across the entire stack',
    popular: true,
    tags: ['React', 'Node.js', 'DevOps'],
  },
  {
    id: 5,
    title: 'Data Scientist',
    icon: 'BarChart2',
    description: 'Machine learning, statistics, and data analysis',
    popular: true,
    tags: ['Python', 'ML', 'Statistics'],
  },
  {
    id: 6,
    title: 'Product Manager',
    icon: 'Briefcase',
    description: 'Product strategy, roadmaps, and stakeholder management',
    popular: false,
    tags: ['Strategy', 'Agile', 'Metrics'],
  },
  {
    id: 7,
    title: 'DevOps Engineer',
    icon: 'GitBranch',
    description: 'CI/CD pipelines, cloud infrastructure, and automation',
    popular: false,
    tags: ['Docker', 'AWS', 'CI/CD'],
  },
  {
    id: 8,
    title: 'UI/UX Designer',
    icon: 'Palette',
    description: 'User research, wireframing, and visual design systems',
    popular: false,
    tags: ['Figma', 'Research', 'Design'],
  },
]

// ── Experience levels ─────────────────────────────────────────────────────────
export const experienceLevels = [
  { id: 'intern', label: 'Intern / Fresher', years: '0–1 years',  desc: 'Just starting out or recent graduate' },
  { id: 'junior', label: 'Junior',           years: '1–3 years',  desc: 'Early career with foundational skills' },
  { id: 'mid',    label: 'Mid-Level',         years: '3–6 years',  desc: 'Independent contributor with solid experience' },
  { id: 'senior', label: 'Senior',            years: '6+ years',   desc: 'Technical leader and domain expert' },
]

// ── Dashboard stats ───────────────────────────────────────────────────────────
export const dashStats = [
  {
    id: 1,
    label: 'Interviews Done',
    value: '14',
    sub:   '+3 this week',
    icon:  'Mic',
    accent: 'purple',
  },
  {
    id: 2,
    label: 'Average Score',
    value: '76%',
    sub:   '+4% from last month',
    icon:  'TrendingUp',
    accent: 'blue',
  },
  {
    id: 3,
    label: 'Day Streak',
    value: '7',
    sub:   'Personal best! 🔥',
    icon:  'Zap',
    accent: 'orange',
  },
  {
    id: 4,
    label: 'MCQs Solved',
    value: '132',
    sub:   '+18 this week',
    icon:  'CheckSquare',
    accent: 'green',
  },
]

// ── Recent interview sessions ─────────────────────────────────────────────────
export const recentSessions = [
  {
    id: 1,
    role:     'Frontend Developer',
    date:     'Apr 17, 2026',
    duration: '18 min',
    score:    82,
    type:     'AI Interview',
    status:   'Completed',
  },
  {
    id: 2,
    role:     'React Developer',
    date:     'Apr 15, 2026',
    duration: '22 min',
    score:    74,
    type:     'AI Interview',
    status:   'Completed',
  },
  {
    id: 3,
    role:     'Full Stack Engineer',
    date:     'Apr 13, 2026',
    duration: '15 min',
    score:    91,
    type:     'AI Interview',
    status:   'Completed',
  },
  {
    id: 4,
    role:     'Software Engineer',
    date:     'Apr 10, 2026',
    duration: '20 min',
    score:    68,
    type:     'MCQ Practice',
    status:   'Completed',
  },
  {
    id: 5,
    role:     'Frontend Developer',
    date:     'Apr 8, 2026',
    duration: '12 min',
    score:    79,
    type:     'AI Interview',
    status:   'Completed',
  },
]

// ── AI interview questions ────────────────────────────────────────────────────
export const interviewQuestions = [
  {
    id: 1,
    question: 'Tell me about yourself and your journey into software development.',
    hint: 'Focus on your background, key experiences, and what motivates you.',
    timeLimit: 90,
  },
  {
    id: 2,
    question: 'What is the difference between var, let, and const in JavaScript? Can you give examples for each?',
    hint: 'Think about scoping, hoisting, and mutability.',
    timeLimit: 75,
  },
  {
    id: 3,
    question: 'Explain the concept of closures in JavaScript and describe a real-world use case.',
    hint: 'A closure is a function that remembers its lexical scope.',
    timeLimit: 90,
  },
  {
    id: 4,
    question: 'How does React\'s virtual DOM work, and why is it more efficient than direct DOM manipulation?',
    hint: 'Explain reconciliation and the diffing algorithm.',
    timeLimit: 90,
  },
  {
    id: 5,
    question: 'Describe your approach to debugging a complex performance issue in a large React application.',
    hint: 'Mention profiling tools, React DevTools, memoization, and code splitting.',
    timeLimit: 120,
  },
  {
    id: 6,
    question: 'What are React Hooks? Explain useState and useEffect with practical use cases.',
    hint: 'Cover basic usage, dependency arrays, and cleanup functions.',
    timeLimit: 90,
  },
  {
    id: 7,
    question: 'How would you design the architecture of a scalable REST API for a social media platform?',
    hint: 'Discuss endpoints, authentication, rate limiting, and database design.',
    timeLimit: 120,
  },
]

// ── MCQ / Objective questions ─────────────────────────────────────────────────
export const mcqQuestions = [
  {
    id: 1,
    topic:    'JavaScript',
    question: 'Which of the following is NOT a JavaScript primitive data type?',
    options:  ['String', 'Boolean', 'Object', 'Symbol'],
    correct:  2,
    explanation:
      'Object is a reference type, not a primitive. JavaScript primitives are: String, Number, Boolean, undefined, null, Symbol, and BigInt.',
  },
  {
    id: 2,
    topic:    'CSS',
    question: 'What does the CSS property "position: sticky" do?',
    options: [
      'Keeps the element fixed relative to the viewport always',
      'Positions element relative to its nearest scroll ancestor until a threshold',
      'Makes the element float within its container',
      'Removes the element from the document flow',
    ],
    correct: 1,
    explanation:
      'sticky positioning allows an element to behave like relative until it crosses a specified threshold, then it becomes fixed.',
  },
  {
    id: 3,
    topic:    'React',
    question: 'Which React hook would you use to run side effects after every render?',
    options:  ['useState', 'useEffect', 'useMemo', 'useCallback'],
    correct:  1,
    explanation:
      'useEffect runs after every render by default. Pass a dependency array to control when it re-runs.',
  },
  {
    id: 4,
    topic:    'Networking',
    question: 'What HTTP status code indicates that a resource was successfully created?',
    options:  ['200 OK', '201 Created', '204 No Content', '301 Moved Permanently'],
    correct:  1,
    explanation:
      '201 Created is the standard response for a successful POST request that creates a new resource.',
  },
  {
    id: 5,
    topic:    'JavaScript',
    question: 'What will "typeof null" return in JavaScript?',
    options:  ['"null"', '"undefined"', '"object"', '"boolean"'],
    correct:  2,
    explanation:
      'This is a well-known JavaScript bug. typeof null returns "object" due to the original JavaScript implementation.',
  },
  {
    id: 6,
    topic:    'Git',
    question: 'Which Git command creates a new branch and immediately switches to it?',
    options: [
      'git branch new-feature',
      'git checkout new-feature',
      'git checkout -b new-feature',
      'git switch --create new-feature is the only way',
    ],
    correct: 2,
    explanation:
      'git checkout -b <branch-name> creates a new branch and checks it out in one command. git switch -c is the modern equivalent.',
  },
  {
    id: 7,
    topic:    'React',
    question: 'What is the purpose of the "key" prop in React lists?',
    options: [
      'It applies CSS styling to list items',
      'It helps React identify which items changed, were added, or removed',
      'It sets the tab order for keyboard navigation',
      'It locks the list item from re-rendering',
    ],
    correct: 1,
    explanation:
      'Keys help React\'s reconciliation algorithm efficiently identify which elements have changed in a list.',
  },
  {
    id: 8,
    topic:    'Performance',
    question: 'What does the "useMemo" hook in React do?',
    options: [
      'Memoizes a callback function reference',
      'Prevents all re-renders of a component',
      'Memoizes the result of an expensive computation',
      'Stores data in the browser memory cache',
    ],
    correct: 2,
    explanation:
      'useMemo caches the result of an expensive computation and only recalculates when its dependencies change.',
  },
]

// ── Result report data ────────────────────────────────────────────────────────
export const sampleResult = {
  overallScore: 82,
  grade:        'B+',
  verdict:      'Strong Candidate',
  duration:     '22 minutes',
  role:         'Frontend Developer',
  date:         'April 17, 2026',
  questionsAnswered: 6,
  sections: [
    { name: 'Technical Knowledge', score: 88, weight: '35%' },
    { name: 'Communication',       score: 79, weight: '20%' },
    { name: 'Problem Solving',     score: 85, weight: '25%' },
    { name: 'Code Quality',        score: 76, weight: '10%' },
    { name: 'Confidence & Clarity',score: 80, weight: '10%' },
  ],
  strengths: [
    'React Hooks & Component Architecture',
    'CSS Flexbox & Grid Mastery',
    'REST API Design Principles',
    'Async/Await & Promises',
    'Clear, Structured Answers',
  ],
  improvements: [
    'System Design at Scale',
    'TypeScript Integration',
    'Testing Strategies (Unit/E2E)',
    'Performance Optimization',
  ],
  aiFeedback: [
    {
      type: 'positive',
      text: 'Excellent command of React hooks — your useState and useEffect explanations were precise, with clear real-world examples. This shows strong practical experience.',
    },
    {
      type: 'positive',
      text: 'Communication was a standout: answers were well-structured, jargon was explained when used, and your pacing was confident. This will impress interviewers.',
    },
    {
      type: 'warning',
      text: 'System design depth was limited. When asked about scalable API architecture, focus on load balancing, caching strategies, database sharding, and microservices patterns.',
    },
    {
      type: 'negative',
      text: 'Testing knowledge gap detected: no mention of Jest, React Testing Library, or end-to-end testing tools. Most senior frontend roles require solid testing skills.',
    },
  ],
  recommendations: [
    'Solve 2–3 LeetCode medium problems daily, focusing on Arrays, Trees, and Dynamic Programming.',
    'Build a small project in TypeScript to gain hands-on proficiency quickly.',
    'Study the system design case studies of Netflix, Uber, and WhatsApp.',
    'Take a dedicated behavioral mock interview to practice the STAR method.',
    'Read "Clean Code" and apply its principles to your next project.',
  ],
  weeklyProgress: [62, 68, 71, 74, 79, 82],
}

// ── Landing page features ─────────────────────────────────────────────────────
export const features = [
  {
    icon: 'FileText',
    title: 'Resume-Based Personalization',
    description:
      'Upload your resume and PrepAI reads your actual skills, experience, and projects to tailor every question specifically to you — not generic templates.',
  },
  {
    icon: 'Mic',
    title: 'Live Voice Mock Interviews',
    description:
      'Experience realistic AI-powered voice interviews that listen to your answers, adapt in real time, and feel just like talking to a real interviewer.',
  },
  {
    icon: 'Brain',
    title: 'Instant AI Scoring & Feedback',
    description:
      'Every answer is analyzed immediately. Get a score, communication rating, and specific actionable feedback before you even close the tab.',
  },
  {
    icon: 'TrendingUp',
    title: 'Progress Tracking Dashboard',
    description:
      'Your dashboard stores every session, tracks your scores over time, and shows your improvement trajectory so you always know where you stand.',
  },
  {
    icon: 'Target',
    title: 'Role-Specific Preparation',
    description:
      'Choose from 20+ target roles. PrepAI switches its question bank, evaluation criteria, and feedback style to match exactly what that role demands.',
  },
  {
    icon: 'BookOpen',
    title: 'MCQ Objective Practice',
    description:
      'Reinforce technical concepts with curated multiple-choice questions covering JavaScript, React, DSA, system design, and more — with explanations.',
  },
]

// ── How it works steps ────────────────────────────────────────────────────────
export const howItWorks = [
  {
    step: '01',
    title: 'Upload Your Resume',
    desc: 'Drop in your resume PDF. PrepAI extracts your skills, experience, and projects in seconds to personalise your session.',
    icon: 'Upload',
  },
  {
    step: '02',
    title: 'Select Role & Level',
    desc: 'Choose the job role you are targeting and set your current experience level. PrepAI calibrates the difficulty accordingly.',
    icon: 'Target',
  },
  {
    step: '03',
    title: 'Start Your Interview',
    desc: 'Answer AI-generated questions using your voice or keyboard. The AI listens, understands, and even asks follow-up questions.',
    icon: 'Mic',
  },
  {
    step: '04',
    title: 'Get Your Full Report',
    desc: 'Receive a detailed report with scores by category, personalized AI feedback, strengths, gaps, and a roadmap to improve.',
    icon: 'FileBarChart',
  },
]

// ── Testimonials ──────────────────────────────────────────────────────────────
export const testimonials = [
  {
    name:  'Priya Sharma',
    role:  'SDE-2 at Google',
    stars: 5,
    quote:
      'PrepAI completely transformed how I prepared. The resume-based questions caught me off guard in the best way — exactly what real interviews feel like.',
  },
  {
    name:  'Carlos Mendez',
    role:  'Product Manager at Microsoft',
    stars: 5,
    quote:
      'The AI feedback after each answer is shockingly specific and accurate. It felt like having a senior PM coach me for free. Got the offer in 3 weeks.',
  },
  {
    name:  'Yuki Tanaka',
    role:  'Frontend Engineer at Stripe',
    stars: 5,
    quote:
      'I used PrepAI every night for 2 weeks. My confidence in technical interviews went from a 4 to a 9. The progress tracking kept me motivated.',
  },
]

// ── Sidebar navigation items ──────────────────────────────────────────────────
export const sidebarNav = [
  { label: 'Dashboard',    path: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Interview',    path: '/interview', icon: 'Mic'             },
  { label: 'MCQ Practice', path: '/objective', icon: 'BookOpen'        },
  { label: 'Results',      path: '/result',    icon: 'BarChart2'       },
  { label: 'Profile',      path: '/profile',   icon: 'User'            },
]
