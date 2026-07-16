import { NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";

function loginRedirect(request: Request) {
  return NextResponse.redirect(new URL("/login", request.url), 303);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // The client-side signOut still clears the browser session; redirect either way.
  }

  return loginRedirect(request);
}

export async function GET(request: Request) {
  return POST(request);
}
