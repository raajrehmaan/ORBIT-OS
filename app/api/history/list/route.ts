import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const clientId = searchParams.get('clientId')

    if (!clientId) {
      return NextResponse.json(
        {
          success: false,
          message: 'clientId required'
        },
        {
          status: 400
        }
      )
    }

    const { data, error } = await supabase
      .from('client_history')
      .select('*')
      .eq('client_id', clientId)
      .order('session_date', { ascending: false })

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
