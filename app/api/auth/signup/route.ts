import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      username,
      full_name,
      email,
      password,
      phone,
      clinic_slug
    } = body

    if (
      !username ||
      !full_name ||
      !email ||
      !password ||
      !phone ||
      !clinic_slug
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('auth_users')
      .insert({
        username,
        full_name,
        email,
        password,
        phone,
        clinic_slug
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      user: data
    })

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    )
  }
}
