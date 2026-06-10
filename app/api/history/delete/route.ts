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

    const { id } = body

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing ID'
        },
        {
          status: 400
        }
      )
    }

    const { error } = await supabase
      .from('client_history')
      .delete()
      .eq('id', id)

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
      success: true
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
