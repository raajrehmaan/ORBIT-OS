import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default async function AccountsPage() {
  const supabase = await createSupabaseServerClient()

  const { data: payments } = await supabase
    .from('payments')
    .select('*')

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')

  const safePayments = payments || []
  const safeExpenses = expenses || []

  const totalRevenue =
    safePayments.reduce(
      (sum: number, p: any) => sum + Number(p.amount_paid || 0),
      0
    ) || 0

  const totalExpenses =
    safeExpenses.reduce(
      (sum: number, e: any) => sum + Number(e.amount || 0),
      0
    ) || 0

  const netProfit = totalRevenue - totalExpenses

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Financial overview and business performance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Revenue</h2>
          </CardHeader>

          <CardContent>
            <p className="text-2xl font-bold">
              £{totalRevenue.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold">Expenses</h2>
          </CardHeader>

          <CardContent>
            <p className="text-2xl font-bold">
              £{totalExpenses.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold">Net Profit</h2>
          </CardHeader>

          <CardContent>
            <p className="text-2xl font-bold">
              £{netProfit.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
