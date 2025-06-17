import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get("image") as File

    if (!imageFile) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 })
    }

    // Get API key from environment
    const apiKey = process.env.BG_REMOVAL_API_KEY

    // If no API key or invalid key, return error to trigger client-side fallback
    if (!apiKey || apiKey === "your_remove_bg_api_key_here") {
      return NextResponse.json({ error: "API key not configured", useClientSide: true }, { status: 503 })
    }

    console.log("Trying Remove.bg API with key:", apiKey.substring(0, 8) + "...")

    // Create FormData for Remove.bg API
    const apiFormData = new FormData()
    apiFormData.append("image_file", imageFile)
    apiFormData.append("size", "auto")

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
      },
      body: apiFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Remove.bg API Error: ${response.status} - ${errorText}`)

      // Return error to trigger client-side fallback
      return NextResponse.json(
        { error: `API Error: ${response.status}`, useClientSide: true },
        { status: response.status },
      )
    }

    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()

    console.log("Remove.bg API success!")

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": arrayBuffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error("Remove.bg API failed:", error)
    return NextResponse.json({ error: "API service failed", useClientSide: true }, { status: 500 })
  }
}
