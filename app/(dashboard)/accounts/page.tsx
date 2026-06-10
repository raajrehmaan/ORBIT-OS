import { createSupabaseServerClient } from "@/lib/supabase/server";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount || 0);
}

export default async function AccountsPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: appointments } = await supabase
    .from("appointments")
    .select("*")
    .neq("status", "cancelled");

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false });

  const todayRevenue =
    appointments
      ?.filter((a) => new Date(a.starts_at) >= todayStart)
      ?.reduce((sum, a) => sum + Number(a.amount_paid || 0), 0) || 0;

  const monthlyRevenue =
    appointments
      ?.filter((a) => new Date(a.starts_at) >= startOfMonth)
      ?.reduce((sum, a) => sum + Number(a.amount_paid || 0), 0) || 0;

  const totalExpenses =
    expenses?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;

  const netProfit = monthlyRevenue - totalExpenses;

  async function addExpense(formData: FormData) {
    "use server";

    const supabase = await createSupabaseServerClient();

    await supabase.from("expenses").insert({
      title: String(formData.get("title")),
      category: String(formData.get("category")),
      amount: Number(formData.get("amount")),
      notes: String(formData.get("notes") || ""),
      organisation_id:
        "f28afbdd-c93b-4f3b-839a-17af2e00261b",
    });
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-4xl font-bold">
          Accounts & Finance
        </h1>

        <p className="text-muted-foreground">
          Revenue, expenses and clinic profit.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-xl p-6">
          <div className="text-muted-foreground text-sm">
            Today's Revenue
          </div>

          <div className="text-5xl font-bold mt-2">
            {formatCurrency(todayRevenue)}
          </div>
        </div>

        <div className="border rounded-xl p-6">
          <div className="text-muted-foreground text-sm">
            Monthly Revenue
          </div>

          <div className="text-5xl font-bold mt-2">
            {formatCurrency(monthlyRevenue)}
          </div>
        </div>

        <div className="border rounded-xl p-6">
          <div className="text-muted-foreground text-sm">
            Net Profit
          </div>

          <div className="text-5xl font-bold mt-2">
            {formatCurrency(netProfit)}
          </div>
        </div>
      </div>

      <div className="border rounded-xl p-6 space-y-4">
        <div className="text-2xl font-semibold">
          Add Expense
        </div>

        <form action={addExpense} className="space-y-4">
          <input
            name="title"
            placeholder="Expense title"
            className="w-full border rounded-lg p-3"
            required
          />

          <select
            name="category"
            className="w-full border rounded-lg p-3"
            required
          >
            <option value="Rent">Rent</option>
            <option value="Office Cost">Office Cost</option>
            <option value="Miscellaneous">Miscellaneous</option>
            <option value="Utilities">Utilities</option>
            <option value="Supplies">Supplies</option>
          </select>

          <input
            type="number"
            step="0.01"
            name="amount"
            placeholder="Amount"
            className="w-full border rounded-lg p-3"
            required
          />

          <textarea
            name="notes"
            placeholder="Notes"
            className="w-full border rounded-lg p-3"
          />

          <button
            type="submit"
            className="bg-black text-white px-6 py-3 rounded-lg"
          >
            Add Expense
          </button>
        </form>
      </div>

      <div className="border rounded-xl p-6">
        <div className="text-2xl font-semibold mb-4">
          Expense History
        </div>

        <div className="space-y-3">
          {expenses?.length ? (
            expenses.map((expense) => (
              <div
                key={expense.id}
                className="border rounded-lg p-4 flex justify-between items-center"
              >
                <div>
                  <div className="font-semibold">
                    {expense.title}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {expense.category}
                  </div>
                </div>

                <div className="text-xl font-bold">
                  {formatCurrency(Number(expense.amount))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-muted-foreground">
              No expenses added yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

