import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const lastmod = new Date().toISOString().slice(0, 10)

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.dripmetric.com</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.dripmetric.com/docs</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>0.8</priority>
  </url>
</urlset>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
