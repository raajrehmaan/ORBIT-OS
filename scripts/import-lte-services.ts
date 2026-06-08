import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { LTE_SERVICES } from "../lib/seed/lte-services";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const organisationId = process.env.DEFAULT_ORGANISATION_ID;

  if (!organisationId) {
    throw new Error("DEFAULT_ORGANISATION_ID missing");
  }

  const categoryMap = new Map<string, string>();

  for (const [index, item] of LTE_SERVICES.entries()) {
  console.log("CHECKING:", index, item);

  if (!item || !item.category) {
    console.log("BROKEN ITEM AT:", index, item);
    continue;
  }
    if (categoryMap.has(item.category)) continue;

    const { data, error } = await supabase
      .from("service_categories")
      .upsert(
        {
          organisation_id: organisationId,
          name: item.category,
          description: item.category,
        },
        {
          onConflict: "organisation_id,name",
        }
      )
      .select("id,name")
      .single();

    if (error) {
      console.error("CATEGORY ERROR:", item.category, error.message);
      continue;
    }

    categoryMap.set(item.category, data.id);
  }

  for (const [index, item] of LTE_SERVICES.entries()) {
  console.log("CHECKING SERVICE:", index, item);

  if (!item || !item.category) {
    console.log("BROKEN SERVICE ITEM:", index, item);
    continue;
  }
    const categoryId = categoryMap.get(item.category);

    const payload = {
      organisation_id: organisationId,
      category: item.category,
      category_id: categoryId,
      name: item.name,
      description: item.name,
      duration_minutes: item.duration_minutes,
      price: item.price,
      color: item.color,
    };

    const { error } = await supabase
      .from("services")
      .upsert(payload, {
        onConflict: "organisation_id,name",
      });

    if (error) {
      console.error("SERVICE ERROR:", item.name, error.message);
    } else {
      console.log("IMPORTED:", item.name);
    }
  }

  console.log("DONE");
}

run().catch(console.error);
