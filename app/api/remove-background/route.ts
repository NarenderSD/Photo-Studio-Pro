import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get("image") as File

    if (!imageFile) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 })
    }

    // Create FormData for Remove.bg API
    const apiFormData = new FormData()
    apiFormData.append("image_file", imageFile)
    apiFormData.append("size", "auto")

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": process.env.BG_REMOVAL_API_KEY!,
      },
      body: apiFormData,
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${response.statusText}`)
    }

    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": arrayBuffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error("Background removal failed:", error)
    return NextResponse.json({ error: "Background removal failed" }, { status: 500 })
  }
}
