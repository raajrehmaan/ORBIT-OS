import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string

const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      client_id,
      treatment_name,
      treatment_category,
      practitioner_name,
      session_date,
      session_time,
      notes,
      amount_paid
    } = body

    if (!client_id || !treatment_name || !session_date) {
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

    const { data, error } = await supabase
      .from('client_history')
      .insert([
        {
          client_id,
          treatment_name,
          treatment_category,
          practitioner_name,
          session_date,
          session_time,
          notes,
          amount_paid,
          source: 'manual_import'
        }
      ])
      .select()

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: error.message
        },
        {
          status: 500
        }
      )
    }

    return NextResponse.json({
      success: true,
      data
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

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'History API live'
  })
}
