import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
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

    const { data, error } =
      await supabase
        .from('client_history')
        .select('*')
        .order('created_at', {
          ascending: false
        })

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
