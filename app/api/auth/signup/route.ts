import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      clinicName,
      ownerName,
      email,
      password,
      phone,
      slug
    } = body

    if (
      !clinicName ||
      !ownerName ||
      !email ||
      !password
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required fields'
        },
        {
          status: 400
        }
      )
    }

    const organisationId = randomUUID()

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      })

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          success: false,
          message:
            authError?.message ||
            'Unable to create user'
        },
        {
          status: 500
        }
      )
    }

    const userId = authData.user.id

    const { error: organisationError } =
      await supabase
        .from('organisations')
        .insert([
          {
            id: organisationId,
            name: clinicName,
            slug
          }
        ])

    if (organisationError) {
      return NextResponse.json(
        {
          success: false,
          message: organisationError.message
        },
        {
          status: 500
        }
      )
    }

    const { error: profileError } =
      await supabase
        .from('auth_users')
        .insert([
          {
            id: userId,
            full_name: ownerName,
            email,
            phone,
            role: 'owner',
            organisation_id: organisationId
          }
        ])

    if (profileError) {
      return NextResponse.json(
        {
          success: false,
          message: profileError.message
        },
        {
          status: 500
        }
      )
    }

    return NextResponse.json({
      success: true
    })

  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        success: false,
        message: 'Server error'
      },
      {
        status: 500
      }
    )
  }
}
