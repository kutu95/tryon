'use client'

import { useState } from 'react'
import Link from 'next/link'

interface HelpTopic {
  id: string
  title: string
  content: React.ReactNode
}

const helpTopics: HelpTopic[] = [
  {
    id: 'actor-photos',
    title: 'How to take the best Actor photos',
    content: (
      <div className="prose max-w-none">
        <h2 className="text-2xl font-bold mb-4">📸 Actor Photo Guidelines</h2>
        <p className="text-lg mb-6">How to take the best photos of people for virtual try-ons</p>
        
        <p className="mb-6">
          High-quality actor photos are the single biggest factor in realistic try-on results.
          Following these guidelines will dramatically reduce errors (especially hands, sleeves, and fit).
        </p>

        <hr className="my-8 border-gray-300" />

        <h3 className="text-xl font-semibold mb-4">✅ What works best</h3>

        <div className="space-y-6 mb-8">
          <div>
            <h4 className="text-lg font-semibold mb-2">1. Pose & body position</h4>
            <ul className="list-disc list-inside space-y-1 mb-3">
              <li>Stand upright and relaxed</li>
              <li>Face the camera directly (or slight angle is fine)</li>
              <li>Keep your full upper body visible</li>
              <li>Arms relaxed at your sides or gently bent</li>
            </ul>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-semibold mb-2">Best poses</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Arms down</li>
                <li>Hands relaxed and visible</li>
                <li>Neutral stance</li>
              </ul>
            </div>
          </div>

          <hr className="my-6 border-gray-300" />

          <div>
            <h4 className="text-lg font-semibold mb-2">2. Hands (very important)</h4>
            <p className="mb-3">Hands are one of the hardest things for AI to get right.</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="font-semibold mb-2 text-green-800">Do</p>
                <ul className="list-disc list-inside space-y-1 text-green-700">
                  <li>Keep hands fully visible or fully outside the frame</li>
                  <li>Keep fingers relaxed and slightly separated</li>
                </ul>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="font-semibold mb-2 text-red-800">Avoid</p>
                <ul className="list-disc list-inside space-y-1 text-red-700">
                  <li>Hands partially hidden by sleeves</li>
                  <li>Fingers touching clothing</li>
                  <li>Hands crossing the torso</li>
                  <li>Hands clenched, pointing, or foreshortened toward the camera</li>
                </ul>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              👉 Clean hand visibility greatly reduces missing or distorted fingers.
            </p>
          </div>

          <hr className="my-6 border-gray-300" />

          <div>
            <h4 className="text-lg font-semibold mb-2">3. Clothing worn by the actor</h4>
            <ul className="list-disc list-inside space-y-1 mb-3">
              <li>Wear simple, fitted clothing</li>
              <li>Plain colours are best</li>
              <li>Short sleeves or sleeveless tops work very well</li>
            </ul>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="font-semibold mb-2 text-red-800">Avoid</p>
              <ul className="list-disc list-inside space-y-1 text-red-700">
                <li>Loose jackets, coats, scarves</li>
                <li>Long sleeves covering hands</li>
                <li>Busy patterns or reflective fabrics</li>
              </ul>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              The try-on garment will replace this clothing, but complex originals confuse the system.
            </p>
          </div>

          <hr className="my-6 border-gray-300" />

          <div>
            <h4 className="text-lg font-semibold mb-2">4. Background & lighting</h4>
            <ul className="list-disc list-inside space-y-1 mb-3">
              <li>Plain, uncluttered background (wall, curtain, studio backdrop)</li>
              <li>Even lighting from the front</li>
              <li>Natural daylight is excellent</li>
            </ul>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="font-semibold mb-2 text-red-800">Avoid</p>
              <ul className="list-disc list-inside space-y-1 text-red-700">
                <li>Strong shadows</li>
                <li>Backlighting</li>
                <li>Busy or outdoor backgrounds</li>
                <li>Mirrors or reflective surfaces</li>
              </ul>
            </div>
          </div>

          <hr className="my-6 border-gray-300" />

          <div>
            <h4 className="text-lg font-semibold mb-2">5. Camera & framing</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Phone camera is fine</li>
              <li>Camera at chest or eye height</li>
              <li>No extreme wide-angle lenses</li>
              <li>Keep the actor centered in frame</li>
            </ul>
          </div>
        </div>

        <hr className="my-8 border-gray-300" />

        <h3 className="text-xl font-semibold mb-4">❌ Common problems to avoid</h3>
        <ul className="list-disc list-inside space-y-2 mb-8">
          <li>Cropped hands or wrists</li>
          <li>Hands overlapping clothing edges</li>
          <li>Extreme poses or fashion poses</li>
          <li>Low-resolution or blurry photos</li>
          <li>Motion blur</li>
        </ul>

        <hr className="my-8 border-gray-300" />

        <h3 className="text-xl font-semibold mb-4">⭐ Pro tips</h3>
        <ul className="list-disc list-inside space-y-2">
          <li>Take multiple photos and keep the best ones</li>
          <li>If available, use the "Tune with AI" option to clean lighting and background</li>
          <li>Mark your best photos as "preferred" for try-ons</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'garment-photos',
    title: 'How to take the best Garment photos',
    content: (
      <div className="prose max-w-none">
        <h2 className="text-2xl font-bold mb-4">👕 Garment Photo Guidelines</h2>
        <p className="text-lg mb-6">How to photograph clothing for the best try-on results</p>
        
        <p className="mb-6">
          Garment photos define how realistic the final try-on looks.
          Clear shape and texture matter more than styling.
        </p>

        <hr className="my-8 border-gray-300" />

        <h3 className="text-xl font-semibold mb-4">✅ What works best</h3>

        <div className="space-y-6 mb-8">
          <div>
            <h4 className="text-lg font-semibold mb-2">1. Garment presentation</h4>
            <p className="mb-3">Choose one of the following (in order of preference):</p>
            <ol className="list-decimal list-inside space-y-1 mb-3 ml-4">
              <li>Flat lay on a clean surface</li>
              <li>Hanging garment (straight, well aligned)</li>
              <li>Invisible mannequin / ghost mannequin</li>
            </ol>
            <p className="mb-2 font-semibold">The garment should be:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Fully visible</li>
              <li>Symmetrical</li>
              <li>Not stretched or twisted</li>
            </ul>
          </div>

          <hr className="my-6 border-gray-300" />

          <div>
            <h4 className="text-lg font-semibold mb-2">2. Background</h4>
            <ul className="list-disc list-inside space-y-1 mb-3">
              <li>Plain background (white, grey, light neutral)</li>
              <li>High contrast between garment and background</li>
            </ul>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="font-semibold mb-2 text-red-800">Avoid</p>
              <ul className="list-disc list-inside space-y-1 text-red-700">
                <li>Busy floors or textured walls</li>
                <li>Backgrounds similar in colour to the garment</li>
              </ul>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              Clean backgrounds make cutouts far more accurate.
            </p>
          </div>

          <hr className="my-6 border-gray-300" />

          <div>
            <h4 className="text-lg font-semibold mb-2">3. Lighting</h4>
            <ul className="list-disc list-inside space-y-1 mb-3">
              <li>Even lighting across the entire garment</li>
              <li>Soft shadows are OK</li>
              <li>Show texture clearly</li>
            </ul>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="font-semibold mb-2 text-red-800">Avoid</p>
              <ul className="list-disc list-inside space-y-1 text-red-700">
                <li>Strong directional shadows</li>
                <li>Flash hotspots</li>
                <li>Uneven lighting across sleeves or hems</li>
              </ul>
            </div>
          </div>

          <hr className="my-6 border-gray-300" />

          <div>
            <h4 className="text-lg font-semibold mb-2">4. Garment condition</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Iron or steam before photographing</li>
              <li>Lay flat and smooth</li>
              <li>Align sleeves naturally</li>
            </ul>
            <p className="mt-3 text-sm text-gray-600">
              Wrinkles confuse fabric edges and seams.
            </p>
          </div>

          <hr className="my-6 border-gray-300" />

          <div>
            <h4 className="text-lg font-semibold mb-2">5. Framing</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Garment fills most of the frame</li>
              <li>Leave a small margin around edges</li>
              <li>Don't crop cuffs, hems, collars, or shoulders</li>
            </ul>
          </div>
        </div>

        <hr className="my-8 border-gray-300" />

        <h3 className="text-xl font-semibold mb-4">❌ What to avoid</h3>
        <ul className="list-disc list-inside space-y-2 mb-8">
          <li>Garments worn by a person (unless unavoidable)</li>
          <li>Hands holding the garment</li>
          <li>Folded sleeves or tucked hems</li>
          <li>Motion blur</li>
          <li>Low-resolution images</li>
        </ul>

        <hr className="my-8 border-gray-300" />

        <h3 className="text-xl font-semibold mb-4">⭐ Pro tips</h3>
        <ul className="list-disc list-inside space-y-2 mb-8">
          <li>Photograph front view first (most important)</li>
          <li>Back view can be added as an extra reference</li>
          <li>Use "Tune with AI / Create cutout" to generate a clean transparent version</li>
          <li>Always keep the original photo — tuned versions are saved as variants</li>
        </ul>

        <hr className="my-8 border-gray-300" />

        <h3 className="text-xl font-semibold mb-4">🎯 Why this matters</h3>
        <p className="mb-4">Virtual try-on AI must:</p>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>Understand where the body is</li>
          <li>Understand where the garment is</li>
          <li>Blend the two without guessing</li>
        </ul>
        <p className="mb-2 font-semibold">Good input photos mean:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>Better fit</li>
          <li>Fewer hand and sleeve errors</li>
          <li>More realistic results</li>
          <li>Less need for manual fixes</li>
        </ul>
      </div>
    ),
  },
]

export default function HelpPage() {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)

  const currentTopic = helpTopics.find(t => t.id === selectedTopic)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Help & Guidelines</h1>
        <p className="text-gray-600 text-lg">
          Learn how to get the best results from virtual try-ons
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Topics sidebar */}
        <div className="md:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg p-4 sticky top-4">
            <h2 className="text-xl font-semibold mb-4">Topics</h2>
            <nav className="space-y-2">
              {helpTopics.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => setSelectedTopic(topic.id)}
                  className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
                    selectedTopic === topic.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {topic.title}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content area */}
        <div className="md:col-span-2">
          <div className="bg-white border border-gray-200 rounded-lg p-8">
            {currentTopic ? (
              <div>
                <button
                  onClick={() => setSelectedTopic(null)}
                  className="mb-4 text-indigo-600 hover:text-indigo-800 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to topics
                </button>
                {currentTopic.content}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg mb-4">
                  Select a topic from the sidebar to view guidelines
                </p>
                <div className="grid grid-cols-1 gap-4 mt-8">
                  {helpTopics.map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => setSelectedTopic(topic.id)}
                      className="text-left p-6 border border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
                    >
                      <h3 className="text-xl font-semibold mb-2">{topic.title}</h3>
                      <p className="text-gray-600">
                        Click to view detailed guidelines
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
