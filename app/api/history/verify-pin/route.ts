import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { pin } = body

    if (!pin) {
      return NextResponse.json(
        {
          success: false,
          message: 'PIN required'
        },
        {
          status: 400
        }
      )
    }

    const { data, error } = await supabase
      .from('security_settings')
      .select('setting_value')
      .eq('setting_key', 'history_admin_pin')
      .single()

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: 'PIN lookup failed'
        },
        {
          status: 500
        }
      )
    }

    const valid = data.setting_value === pin

    return NextResponse.json({
      success: valid
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
