import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/projects`)
    
    if (!response.ok) {
      console.error('Backend API error:', response.status, response.statusText)
      return NextResponse.json({ projects: [] }, { status: 200 })
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to fetch projects:', error)
    return NextResponse.json({ projects: [] }, { status: 200 })
  }
}
