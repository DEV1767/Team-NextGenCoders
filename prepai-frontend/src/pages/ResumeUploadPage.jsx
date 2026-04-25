import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, FileText, Upload, X, Zap } from 'lucide-react'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import { uploadResume } from '../api/onboarding'
import { getCurrentUser } from '../api/user'
import { emitAuthChanged } from '../utils/authEvents'

function formatBytes(size) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export default function ResumeUploadPage() {
  const navigate = useNavigate()
  const inputRef = useRef(null)

  const [file, setFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const selectFile = (candidate) => {
    if (!candidate) return

    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]

    if (!allowed.includes(candidate.type)) {
      setError('Only PDF/DOC/DOCX files are accepted.')
      return
    }

    if (candidate.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5 MB.')
      return
    }

    setError('')
    setFile(candidate)
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please choose a resume file first.')
      return
    }

    setUploading(true)
    setError('')

    try {
      await uploadResume(file)
      const updatedUser = await getCurrentUser()
      emitAuthChanged(updatedUser)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Resume upload failed. Try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-100 bg-white">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <Zap size={15} className="text-white fill-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">
              Prep<span className="text-purple-600">AI</span>
            </span>
          </button>
        </div>
      </header>

      <div className="flex-1 px-5 py-10">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">Step 2</p>
            <h1 className="text-3xl font-bold text-gray-900 mt-2">Upload your resume</h1>
            <p className="text-sm text-gray-500 mt-2">
              This is required before starting interview sessions. We parse your resume text to generate personalized questions.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragActive(false)
              selectFile(event.dataTransfer.files?.[0])
            }}
            className={[
              'rounded-2xl border-2 border-dashed p-10 cursor-pointer text-center transition-colors',
              dragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300',
            ].join(' ')}
          >
            <div className="w-14 h-14 rounded-2xl bg-gray-100 mx-auto flex items-center justify-center mb-4">
              <Upload size={24} className="text-gray-500" />
            </div>
            <p className="text-sm font-semibold text-gray-800">Drag and drop resume or click to browse</p>
            <p className="text-xs text-gray-500 mt-1">PDF, DOC, DOCX up to 5 MB</p>

            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx"
              onChange={(event) => selectFile(event.target.files?.[0])}
            />
          </div>

          {file && (
            <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <FileText size={18} className="text-green-700 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-green-900 truncate">{file.name}</p>
                  <p className="text-xs text-green-700">{formatBytes(file.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <X size={12} />
                Remove
              </button>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <SecondaryButton variant="ghost" size="md" onClick={() => navigate('/onboarding')}>
              Back
            </SecondaryButton>
            <PrimaryButton size="lg" onClick={handleUpload} disabled={!file || uploading} loading={uploading}>
              Upload and Continue
              {!uploading && <ArrowRight size={16} />}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  )
}
