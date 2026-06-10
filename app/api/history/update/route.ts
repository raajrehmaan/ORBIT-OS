import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      id,
      treatment_name,
      treatment_category,
      practitioner_name,
      session_date,
      session_time,
      notes,
      amount_paid
    } = body

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing history ID'
        },
        {
          status: 400
        }
      )
    }

    const { data, error } = await supabase
      .from('client_history')
      .update({
        treatment_name,
        treatment_category,
        practitioner_name,
        session_date,
        session_time,
        notes,
        amount_paid
      })
      .eq('id', id)
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
