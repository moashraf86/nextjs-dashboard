"use server";
import { z } from "zod";
import { cookies } from "next/headers";
import { createClient } from "../utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type State = {
  errors?: {
    customer_id?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

// create invoice schema
const invoiceSchema = z.object({
  id: z.string(),
  customer_id: z.string({ invalid_type_error: "Please select a customer" }),
  amount: z.coerce.number().gt(0, "Amount must be greater than $0"),
  status: z.enum(["pending", "paid"], {
    invalid_type_error: "Please select an invoice status",
  }),
  date: z.string(),
});
// create invoice schema without id and date
const CreateInvoice = invoiceSchema.omit({ id: true, date: true });

// create invoices action
export async function createInvoice(prevState: State, formData: FormData) {
  // get cookies and create supabase client
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // parse form data into invoice object
  const validatedFields = CreateInvoice.safeParse({
    customer_id: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  // check for validation errors
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing Fields, Failed to create an invoice.",
    };
  }

  // destructuring the validated fields
  const { customer_id, amount, status } = validatedFields.data;

  // convert amount to cents
  const amountInCents = amount * 100;

  // create new date object
  const date = new Date().toISOString().split("T")[0];

  // insert new invoice into database
  try {
    await supabase.from("invoices").insert([
      {
        customer_id,
        amount: amountInCents,
        status,
        date,
      },
    ]);
  } catch (error) {
    console.log("error", error);
    return { message: "Failed to create invoice" };
  }

  // revalidate the invoices cache
  revalidatePath("/dashboard/invoices");

  // redirect to invoices page
  redirect("/dashboard/invoices");
}

// update invoice schema without id and date
const UpdateInvoice = invoiceSchema.omit({ id: true, date: true });
// update invoice action
export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData
) {
  // get cookies and create supabase client
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // parse form data into invoice object
  const validatedFields = UpdateInvoice.safeParse({
    customer_id: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  // check for validation errors
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing Fields, Failed to update invoice.",
    };
  }

  // destructuring the validated fields
  const { customer_id, amount, status } = validatedFields.data;

  // convert amount to cents
  const amountInCents = amount * 100;

  // update invoice in database
  try {
    const { error } = await supabase
      .from("invoices")
      .update({
        customer_id,
        amount: amountInCents,
        status,
      })
      .eq("id", id);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.log("error", error);

    return { message: "Failed to update invoice" };
  }

  // revalidate the invoices cache
  revalidatePath("/dashboard/invoices");

  // redirect to invoices page
  redirect("/dashboard/invoices");
}

// delete invoice action
export async function deleteInvoice(id: string) {
  // throw new Error("Not implemented");
  // get cookies and create supabase client
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // delete invoice from database
  try {
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) {
      throw error;
    }
  } catch (error) {
    console.log("error", error);
    return { message: "Failed to delete invoice" };
  }

  // revalidate the invoices cache
  revalidatePath("/dashboard/invoices");
}
