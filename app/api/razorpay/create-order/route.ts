import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Credit orders are deprecated. Use /api/razorpay/create-subscription." }, { status: 410 });
}
