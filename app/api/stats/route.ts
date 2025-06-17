import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

// Persistent stats using cookies for demo (in production, use a database)
let persistentStats = {
  totalUsers: 50,
  photosGenerated: 127,
  backgroundsRemoved: 89,
  lastUpdated: new Date().toISOString(),
}

export async function GET() {
  try {
    // Try to get stats from cookies to persist across refreshes
    const cookieStore = await cookies()
    const savedStats = cookieStore.get("app-stats")

    if (savedStats) {
      try {
        persistentStats = JSON.parse(savedStats.value)
      } catch (e) {
        // If parsing fails, use default stats
      }
    }

    return NextResponse.json(persistentStats)
  } catch (error) {
    console.error("Failed to get stats:", error)
    return NextResponse.json(persistentStats)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    // Get current stats from cookies
    const cookieStore = await cookies()
    const savedStats = cookieStore.get("app-stats")

    if (savedStats) {
      try {
        persistentStats = JSON.parse(savedStats.value)
      } catch (e) {
        // If parsing fails, use current stats
      }
    }

    // Increment counters based on action - ONLY INCREMENT, NEVER DECREASE
    switch (action) {
      case "photo_uploaded":
        persistentStats.totalUsers += 1
        persistentStats.photosGenerated += 1
        break
      case "background_removed":
        persistentStats.backgroundsRemoved += 1
        break
      case "photo_exported":
        // Don't increment users again, just track exports
        break
      default:
        break
    }

    persistentStats.lastUpdated = new Date().toISOString()

    // Save stats to cookies for persistence
    const response = NextResponse.json(persistentStats)
    response.cookies.set("app-stats", JSON.stringify(persistentStats), {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      httpOnly: false,
      secure: false,
      sameSite: "lax",
    })

    return response
  } catch (error) {
    console.error("Failed to update stats:", error)
    return NextResponse.json(persistentStats)
  }
}
