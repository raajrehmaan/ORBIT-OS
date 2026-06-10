import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL

    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Missing Supabase environment variables'
        },
        {
          status: 500
        }
      )
    }

    const supabase = createClient(
      supabaseUrl,
      serviceKey
    )

    const body = await req.json()

    const { pin } = body

    if (!pin) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing PIN'
        },
        {
          status: 400
        }
      )
    }

    const { data, error } =
      await supabase
        .from('settings')
        .select('history_pin')
        .single()

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
      success:
        data?.history_pin === pin
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
