import { NextResponse } from "next/server";
import pkg from "@/package.json";
export async function GET() { return NextResponse.json({ success: true, name: "dripmetric", version: pkg.version, api: "public-v1" }); }
