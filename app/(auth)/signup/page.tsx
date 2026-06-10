'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()

  const [clinicName, setClinicName] =
    useState('')

  const [ownerName, setOwnerName] =
    useState('')

  const [email, setEmail] =
    useState('')

  const [password, setPassword] =
    useState('')

  const [phone, setPhone] =
    useState('')

  const [slug, setSlug] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  const [message, setMessage] =
    useState('')

  async function handleSignup() {
    try {
      setLoading(true)
      setMessage('')

      const response = await fetch(
        '/api/auth/signup',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            clinicName,
            ownerName,
            email,
            password,
            phone,
            slug
          })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setMessage(
          data.message || 'Signup failed'
        )
        return
      }

      setMessage(
        'Account created successfully'
      )

      setTimeout(() => {
        router.push('/login')
      }, 1500)

    } catch (error) {
      console.error(error)

      setMessage('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-lg space-y-4">

        <h1 className="text-3xl font-bold">
          Create Clinic Account
        </h1>

        <input
          type="text"
          placeholder="Clinic Name"
          value={clinicName}
          onChange={(e) =>
            setClinicName(e.target.value)
          }
          className="w-full border rounded-lg p-3"
        />

        <input
          type="text"
          placeholder="Owner Name"
          value={ownerName}
          onChange={(e) =>
            setOwnerName(e.target.value)
          }
          className="w-full border rounded-lg p-3"
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
          className="w-full border rounded-lg p-3"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          className="w-full border rounded-lg p-3"
        />

        <input
          type="text"
          placeholder="Phone"
          value={phone}
          onChange={(e) =>
            setPhone(e.target.value)
          }
          className="w-full border rounded-lg p-3"
        />

        <input
          type="text"
          placeholder="Clinic Slug"
          value={slug}
          onChange={(e) =>
            setSlug(e.target.value)
          }
          className="w-full border rounded-lg p-3"
        />

        <button
          onClick={handleSignup}
          disabled={loading}
          className="w-full bg-black text-white rounded-lg p-3"
        >
          {loading
            ? 'Creating Account...'
            : 'Create Account'}
        </button>

        {message && (
          <div className="text-sm text-center">
            {message}
          </div>
        )}

      </div>
    </div>
  )
}
