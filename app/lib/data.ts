import { sql } from "@vercel/postgres";
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoice,
  Revenue,
} from "./definitions";
import { formatCurrency } from "./utils";
import { createClient } from "../utils/supabase/server";
import { cookies } from "next/headers";

export async function fetchRevenue() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  try {
    // const data = await sql<Revenue>`SELECT * FROM revenue`;
    const { data: revenue, error } = await supabase.from("revenue").select();
    if (error) {
      throw error;
    }
    return revenue as Revenue[];
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch revenue data.");
  }
}

export async function fetchLatestInvoices() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  // Simulate a 3 second delay
  console.log("fetching revenue data...");
  await new Promise((resolve) => setTimeout(resolve, 3000));
  console.log("fetching revenue data...done");
  try {
    // Fetch last 5 invoices
    const { data, error } = await supabase
      .from("invoices")
      .select(`amount, id, customers(name, email, image_url)`)
      .order("date", { ascending: false })
      .limit(5);
    if (error) {
      throw error;
    }
    // Convert amount from cents to dollars
    const latestInvoices = data.map(({ id, amount, customers }) => ({
      id,
      amount: formatCurrency(amount),
      ...customers,
    }));

    return latestInvoices as unknown as LatestInvoice[];
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch the latest invoices.");
  }
}

export async function fetchCardData() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  try {
    const [
      { data: invoices, error: invoicesError },
      { data: customers, error: customersError },
      { data: PaidInvoices, error: paidInvoicesError },
      { data: PendingInvoices, error: pendingInvoicesError },
    ] = await Promise.all([
      supabase.from("invoices").select(""),
      supabase.from("customers").select(""),
      supabase.from("invoices").select().eq("status", "paid"),
      supabase.from("invoices").select().eq("status", "pending"),
    ]);

    if (
      invoicesError ||
      customersError ||
      paidInvoicesError ||
      pendingInvoicesError
    ) {
      throw (
        invoicesError ||
        customersError ||
        paidInvoicesError ||
        pendingInvoicesError
      );
    }

    const numberOfInvoices = invoices?.length ?? 0;
    const numberOfCustomers = customers?.length ?? 0;
    const totalPaidInvoices = formatCurrency(
      (PaidInvoices ?? []).reduce((acc, invoice) => acc + invoice.amount, 0)
    );
    const totalPendingInvoices = formatCurrency(
      (PendingInvoices ?? []).reduce((acc, invoice) => acc + invoice.amount, 0)
    );

    return {
      numberOfInvoices,
      numberOfCustomers,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch card data.");
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  try {
    // const invoices = await sql<InvoicesTable>`
    //   SELECT
    //     invoices.id,
    //     invoices.amount,
    //     invoices.date,
    //     invoices.status,
    //     customers.name,
    //     customers.email,
    //     customers.image_url
    //   FROM invoices
    //   JOIN customers ON invoices.customer_id = customers.id
    //   WHERE
    //     customers.name ILIKE ${`%${query}%`} OR
    //     customers.email ILIKE ${`%${query}%`} OR
    //     invoices.amount::text ILIKE ${`%${query}%`} OR
    //     invoices.date::text ILIKE ${`%${query}%`} OR
    //     invoices.status ILIKE ${`%${query}%`}
    //   ORDER BY invoices.date DESC
    //   LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    // `;
    const { data, error } = await supabase
      .from("invoices")
      .select(
        `
    		id,
    		amount::text,
    		date::text,
    		status,
    		customers!inner(name, email, image_url)
    	`
      )
      .ilike("customers.name", `*${query}*`)
      .ilike("customers.email", `*${query}*`)
      .order("date", { ascending: false })
      .range(offset, offset + ITEMS_PER_PAGE - 1);

    const filteredInvoices = data
      ? data.map(({ id, amount, date, status, customers }) => ({
          id,
          amount,
          date,
          status,
          ...customers,
        }))
      : [];

    if (error) {
      console.error("Database Error:", error);
    }

    return filteredInvoices as unknown as InvoicesTable[];
    // return invoices.rows;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoices.");
  }
}

export async function fetchInvoicesPages() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  try {
    // const count = await sql`SELECT COUNT(*)
    //   FROM invoices
    //   JOIN customers ON invoices.customer_id = customers.id
    //   WHERE
    //     customers.name ILIKE ${`%${query}%`} OR
    //     customers.email ILIKE ${`%${query}%`} OR
    //     invoices.amount::text ILIKE ${`%${query}%`} OR
    //     invoices.date::text ILIKE ${`%${query}%`} OR
    //     invoices.status ILIKE ${`%${query}%`}
    // `;
    // const totalPages = Math.ceil(Number(count.rows[0].count) / ITEMS_PER_PAGE);
    // return totalPages;
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select(
        `amount::text, date::text, status, customers(name, email, image_url)`
      );

    if (error) {
      throw error;
    }

    const totalPages = invoices
      ? Math.ceil(invoices.length / ITEMS_PER_PAGE)
      : 0;
    return totalPages;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch total number of invoices.");
  }
}

export async function fetchInvoiceById(id: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  try {
    // const data = await sql<InvoiceForm>`
    //   SELECT
    //     invoices.id,
    //     invoices.customer_id,
    //     invoices.amount,
    //     invoices.status
    //   FROM invoices
    //   WHERE invoices.id = ${id};
    // `;
    const { data, error } = await supabase
      .from("invoices")
      .select()
      .eq("id", id);

    if (error) {
      throw error;
    }

    const invoice = data.map((invoice) => ({
      ...invoice,
      amount: invoice.amount / 100,
    }));

    return invoice[0] as InvoiceForm;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoice.");
  }
}

export async function fetchCustomers() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  try {
    // const data = await sql<CustomerField>`
    //   SELECT
    //     id,
    //     name
    //   FROM customers
    //   ORDER BY name ASC
    // `;
    const { data: customers, error } = await supabase
      .from("customers")
      .select("id, name")
      .order("name", { ascending: true });
    if (error) {
      throw error;
    }
    return customers as CustomerField[];
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch all customers.");
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const data = await sql<CustomersTableType>`
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `;

    const customers = data.rows.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch customer table.");
  }
}
