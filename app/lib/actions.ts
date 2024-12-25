"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { db } from "@vercel/postgres";

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
  // define client
  const client = await db.connect();
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
    await client.sql`
			INSERT INTO invoices (customer_id, amount, status, date)
			VALUES (${customer_id}, ${amountInCents}, ${status}, ${date})
		`;
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
  // define client
  const client = await db.connect();
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
    await client.sql`
			UPDATE invoices
			SET customer_id = ${customer_id}, amount = ${amountInCents}, status = ${status}
			WHERE id = ${id}
		`;
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
  // define client
  const client = await db.connect();
  // delete invoice from database
  try {
    await client.sql`
			DELETE FROM invoices
			WHERE id = ${id}
		`;
  } catch (error) {
    console.log("error", error);
    return { message: "Failed to delete invoice" };
  }

  // revalidate the invoices cache
  revalidatePath("/dashboard/invoices");
}

// user authentication action
export async function authenticate(
  prevState: string | undefined,
  formData: FormData
) {
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Invalid credentials.";
        default:
          return "Something went wrong.";
      }
    }
    throw error;
  }
}
