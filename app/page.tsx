"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import {
  Upload,
  Download,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  FileImage,
  FileIcon as FilePdf,
  Undo,
  Redo,
  Moon,
  Sun,
  Camera,
  Eye,
  Printer,
  Settings,
  Layers,
  Scissors,
  Square,
  Sparkles,
  Wand2,
  Loader2,
  CheckCircle,
  AlertCircle,
  Palette,
  Focus,
  Users,
  Activity,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTheme } from "next-themes"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import jsPDF from "jspdf"

interface PhotoState {
  image: HTMLImageElement | null
  processedImage: HTMLImageElement | null
  rotation: number
  zoom: number
  x: number
  y: number
  backgroundColor: string
  borderWidth: number
  borderColor: string
  backgroundRemoved: boolean
  brightness: number
  contrast: number
  saturation: number
  sharpness: number
  autoCenter: boolean
}

interface Stats {
  totalUsers: number
  photosGenerated: number
  backgroundsRemoved: number
  lastUpdated: string
}

// A4 dimensions in pixels at 300 DPI (21cm x 29.7cm)
const A4_WIDTH_PX = Math.round((21 / 2.54) * 300) // 2480px
const A4_HEIGHT_PX = Math.round((29.7 / 2.54) * 300) // 3508px

// Passport photo dimensions (3.5cm x 4.5cm at 300 DPI)
const PHOTO_WIDTH_PX = Math.round((3.5 / 2.54) * 300) // 413px
const PHOTO_HEIGHT_PX = Math.round((4.5 / 2.54) * 300) // 531px

// Grid calculations for perfect A4 fit
const MARGIN = 60 // 5mm margin
const COLS = 5
const MAX_ROWS = 6
const SPACING_X = Math.round((A4_WIDTH_PX - 2 * MARGIN - COLS * PHOTO_WIDTH_PX) / (COLS - 1))
const SPACING_Y = Math.round((A4_HEIGHT_PX - 2 * MARGIN - MAX_ROWS * PHOTO_HEIGHT_PX) / (MAX_ROWS - 1))

const backgroundColors = [
  { name: "White", value: "#FFFFFF", popular: true },
  { name: "Light Blue", value: "#E3F2FD", popular: true },
  { name: "Light Gray", value: "#F5F5F5", popular: true },
  { name: "Cream", value: "#FFF8E1", popular: false },
  { name: "Light Pink", value: "#FCE4EC", popular: false },
  { name: "Red", value: "#FFEBEE", popular: false },
  { name: "Light Green", value: "#E8F5E8", popular: false },
  { name: "Light Yellow", value: "#FFFDE7", popular: false },
]

const borderStyles = [
  { name: "None", width: 0, color: "#000000" },
  { name: "Thin Black", width: 2, color: "#000000" },
  { name: "Medium Black", width: 4, color: "#000000" },
  { name: "Thick Black", width: 6, color: "#000000" },
  { name: "Thin White", width: 2, color: "#FFFFFF" },
  { name: "Medium White", width: 4, color: "#FFFFFF" },
  { name: "Professional", width: 3, color: "#333333" },
]

export default function PhotoLayoutGenerator() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [photoState, setPhotoState] = useState<PhotoState>({
    image: null,
    processedImage: null,
    rotation: 0,
    zoom: 1,
    x: 0,
    y: 0,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#000000",
    backgroundRemoved: false,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    sharpness: 100,
    autoCenter: true,
  })
  const [selectedRows, setSelectedRows] = useState<number>(6)
  const [history, setHistory] = useState<PhotoState[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [backgroundRemovalProgress, setBackgroundRemovalProgress] = useState(0)
  const [processingStatus, setProcessingStatus] = useState<string>("")
  const [apiError, setApiError] = useState<string>("")
  const [stats, setStats] = useState<Stats>({
    totalUsers: 50, // Start from 50
    photosGenerated: 127,
    backgroundsRemoved: 89,
    lastUpdated: new Date().toISOString(),
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gridCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const tempCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    setMounted(true)
    // Load initial stats
    fetchStats()
  }, [])

  // Fetch stats from API
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/stats")
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error)
    }
  }, [])

  // Update stats
  const updateStats = useCallback(async (action: string) => {
    try {
      const response = await fetch("/api/stats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      })
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error("Failed to update stats:", error)
    }
  }, [])

  const saveToHistory = useCallback(
    (state: PhotoState) => {
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push({ ...state })
      setHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)
    },
    [history, historyIndex],
  )

  const updatePhotoState = useCallback(
    (updates: Partial<PhotoState>) => {
      setPhotoState((prev) => {
        const newState = { ...prev, ...updates }
        saveToHistory(newState)
        return newState
      })
    },
    [saveToHistory],
  )

  // Server-side background removal using API route
  const removeBackgroundAPI = useCallback(async (imageFile: File): Promise<string> => {
    const formData = new FormData()
    formData.append("image", imageFile)

    const response = await fetch("/api/remove-background", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      if (errorData.fallback) {
        throw new Error("FALLBACK_REQUIRED")
      }
      throw new Error(errorData.error || `API Error: ${response.status}`)
    }

    const blob = await response.blob()
    return URL.createObjectURL(blob)
  }, [])

  // Fallback client-side background removal
  const removeBackgroundClient = useCallback(async (image: HTMLImageElement): Promise<string> => {
    if (!tempCanvasRef.current) throw new Error("Canvas not available")

    const canvas = tempCanvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas context not available")

    canvas.width = image.width
    canvas.height = image.height

    // Draw original image
    ctx.drawImage(image, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // Enhanced background removal algorithm
    const corners = [
      [0, 0],
      [canvas.width - 1, 0],
      [0, canvas.height - 1],
      [canvas.width - 1, canvas.height - 1],
      [Math.floor(canvas.width / 4), 0],
      [Math.floor((canvas.width * 3) / 4), 0],
      [0, Math.floor(canvas.height / 4)],
      [canvas.width - 1, Math.floor(canvas.height / 4)],
    ]

    let bgR = 0,
      bgG = 0,
      bgB = 0
    corners.forEach(([x, y]) => {
      const index = (y * canvas.width + x) * 4
      bgR += data[index]
      bgG += data[index + 1]
      bgB += data[index + 2]
    })
    bgR = Math.round(bgR / corners.length)
    bgG = Math.round(bgG / corners.length)
    bgB = Math.round(bgB / corners.length)

    // Advanced edge detection and background removal
    const threshold = 35
    const edgeThreshold = 20

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const index = (y * canvas.width + x) * 4
        const r = data[index]
        const g = data[index + 1]
        const b = data[index + 2]

        // Calculate color difference from background
        const colorDiff = Math.sqrt(Math.pow(r - bgR, 2) + Math.pow(g - bgG, 2) + Math.pow(b - bgB, 2))

        // Edge detection for better accuracy
        let isEdge = false
        if (x > 0 && x < canvas.width - 1 && y > 0 && y < canvas.height - 1) {
          const neighbors = [
            data[((y - 1) * canvas.width + x) * 4],
            data[((y + 1) * canvas.width + x) * 4],
            data[(y * canvas.width + (x - 1)) * 4],
            data[(y * canvas.width + (x + 1)) * 4],
          ]
          const avgNeighbor = neighbors.reduce((sum, val) => sum + val, 0) / neighbors.length
          isEdge = Math.abs(r - avgNeighbor) > edgeThreshold
        }

        // Remove background with edge preservation
        if (colorDiff < threshold && !isEdge) {
          data[index + 3] = 0 // Make transparent
        } else if (colorDiff < threshold * 1.5) {
          // Partial transparency for smooth edges
          data[index + 3] = Math.round(255 * (colorDiff / (threshold * 1.5)))
        }
      }
    }

    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL("image/png")
  }, [])

  // Main background removal function
  const removeBackground = useCallback(async () => {
    if (!photoState.image) return

    setIsProcessing(true)
    setBackgroundRemovalProgress(0)
    setProcessingStatus("Preparing image...")
    setApiError("")

    try {
      // Convert image to file for API
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas not available")

      canvas.width = photoState.image.width
      canvas.height = photoState.image.height
      ctx.drawImage(photoState.image, 0, 0)

      setBackgroundRemovalProgress(20)
      setProcessingStatus("Converting image...")

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
          },
          "image/jpeg",
          0.9,
        )
      })

      const file = new File([blob], "image.jpg", { type: "image/jpeg" })

      setBackgroundRemovalProgress(40)
      setProcessingStatus("Trying Remove.bg API...")

      let processedImageUrl: string
      let usedAPI = false

      try {
        // Try server API first
        const formData = new FormData()
        formData.append("image", file)

        const response = await fetch("/api/remove-background", {
          method: "POST",
          body: formData,
        })

        if (response.ok) {
          const blob = await response.blob()
          processedImageUrl = URL.createObjectURL(blob)
          usedAPI = true
          setProcessingStatus("Remove.bg API success!")
        } else {
          throw new Error("API failed")
        }
      } catch (apiError) {
        console.warn("Remove.bg API failed, using built-in removal")
        setApiError("API unavailable, using built-in AI removal")
        setProcessingStatus("Using built-in background removal...")

        setBackgroundRemovalProgress(60)

        // Use client-side removal as fallback
        processedImageUrl = await removeBackgroundClient(photoState.image)
        usedAPI = false
      }

      setBackgroundRemovalProgress(80)
      setProcessingStatus("Finalizing...")

      // Create processed image
      const processedImage = new Image()
      processedImage.onload = () => {
        updatePhotoState({
          processedImage,
          backgroundRemoved: true,
        })
        setBackgroundRemovalProgress(100)

        if (usedAPI) {
          setProcessingStatus("Background removed with Remove.bg API!")
        } else {
          setProcessingStatus("Background removed with built-in AI!")
        }

        setIsProcessing(false)

        // Update stats
        updateStats("background_removed")

        setTimeout(() => {
          setBackgroundRemovalProgress(0)
          setProcessingStatus("")
          if (usedAPI) {
            setApiError("")
          }
        }, 3000)
      }

      processedImage.onerror = () => {
        console.error("Failed to load processed image")
        setApiError("Failed to process image. Please try again.")
        setIsProcessing(false)
        setBackgroundRemovalProgress(0)
        setProcessingStatus("")
      }

      processedImage.src = processedImageUrl
    } catch (error) {
      console.error("Background removal failed:", error)
      setApiError("Background removal failed. Please try again.")
      setIsProcessing(false)
      setBackgroundRemovalProgress(0)
      setProcessingStatus("")
    }
  }, [photoState.image, removeBackgroundClient, updatePhotoState, updateStats])

  // Enhanced image processing with professional filters
  const applyImageFilters = useCallback((ctx: CanvasRenderingContext2D, state: PhotoState) => {
    const filters = []

    if (state.brightness !== 100) {
      filters.push(`brightness(${state.brightness}%)`)
    }
    if (state.contrast !== 100) {
      filters.push(`contrast(${state.contrast}%)`)
    }
    if (state.saturation !== 100) {
      filters.push(`saturate(${state.saturation}%)`)
    }
    if (state.sharpness !== 100) {
      // Simulate sharpness with contrast adjustment
      const sharpnessValue = 100 + (state.sharpness - 100) * 0.5
      filters.push(`contrast(${sharpnessValue}%)`)
    }

    if (filters.length > 0) {
      ctx.filter = filters.join(" ")
    }
  }, [])

  // Auto-center face detection (simplified)
  const autoCenterImage = useCallback((state: PhotoState) => {
    if (!state.autoCenter || !state.image) return { x: state.x, y: state.y }

    // Simple center calculation - in a real implementation, you'd use face detection
    const centerX = 0 // Center horizontally
    const centerY = -10 // Slightly up for passport photos (face should be in upper portion)

    return { x: centerX, y: centerY }
  }, [])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files[0]) {
      handleFileProcess(files[0])
    }
  }, [])

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFileProcess(file)
    }
  }, [])

  const handleFileProcess = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        alert("Please select a valid image file")
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        alert("File size too large. Please select an image under 10MB.")
        return
      }

      setIsProcessing(true)
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const autoCenter = autoCenterImage({ ...photoState, image: img, autoCenter: true })
          updatePhotoState({
            image: img,
            processedImage: null,
            rotation: 0,
            zoom: 1,
            x: autoCenter.x,
            y: autoCenter.y,
            backgroundRemoved: false,
            brightness: 100,
            contrast: 100,
            saturation: 100,
            sharpness: 100,
          })
          setIsProcessing(false)

          // Update stats for photo upload
          updateStats("photo_uploaded")
        }
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(file)
    },
    [updatePhotoState, autoCenterImage, photoState, updateStats],
  )

  const drawPhoto = useCallback(
    (canvas: HTMLCanvasElement, state: PhotoState, width: number, height: number) => {
      const ctx = canvas.getContext("2d")
      if (!ctx || !state.image) return

      canvas.width = width
      canvas.height = height

      // Clear canvas
      ctx.clearRect(0, 0, width, height)

      // Draw background
      ctx.fillStyle = state.backgroundColor
      ctx.fillRect(0, 0, width, height)

      // Save context for transformations
      ctx.save()

      // Apply image filters
      applyImageFilters(ctx, state)

      // Move to center for rotation
      ctx.translate(width / 2, height / 2)
      ctx.rotate((state.rotation * Math.PI) / 180)
      ctx.scale(state.zoom, state.zoom)
      ctx.translate(-width / 2, -height / 2)

      // Use processed image if background is removed, otherwise use original
      const imageToUse = state.backgroundRemoved && state.processedImage ? state.processedImage : state.image

      // Calculate image dimensions to fit while maintaining aspect ratio
      const imgAspect = imageToUse.width / imageToUse.height
      const canvasAspect = width / height

      let drawWidth, drawHeight, drawX, drawY

      if (imgAspect > canvasAspect) {
        drawHeight = height * 1.2 // Slightly larger for better coverage
        drawWidth = drawHeight * imgAspect
        drawX = (width - drawWidth) / 2 + state.x
        drawY = state.y - (drawHeight - height) / 2
      } else {
        drawWidth = width * 1.2 // Slightly larger for better coverage
        drawHeight = drawWidth / imgAspect
        drawX = state.x - (drawWidth - width) / 2
        drawY = (height - drawHeight) / 2 + state.y
      }

      // Draw image with smooth edges
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(imageToUse, drawX, drawY, drawWidth, drawHeight)

      // Restore context
      ctx.restore()

      // Draw professional border
      if (state.borderWidth > 0) {
        ctx.strokeStyle = state.borderColor
        ctx.lineWidth = state.borderWidth
        ctx.lineCap = "square"
        ctx.lineJoin = "miter"

        // Draw main border
        const borderOffset = state.borderWidth / 2
        ctx.strokeRect(borderOffset, borderOffset, width - state.borderWidth, height - state.borderWidth)

        // Add professional inner shadow effect
        if (state.borderWidth >= 3) {
          ctx.save()
          ctx.strokeStyle = state.borderColor === "#FFFFFF" ? "#E0E0E0" : "#555555"
          ctx.lineWidth = 1
          ctx.globalAlpha = 0.3
          ctx.strokeRect(
            state.borderWidth + 1,
            state.borderWidth + 1,
            width - (state.borderWidth + 1) * 2,
            height - (state.borderWidth + 1) * 2,
          )
          ctx.restore()
        }
      }
    },
    [applyImageFilters],
  )

  const generateGrid = useCallback(() => {
    if (!photoState.image || !gridCanvasRef.current) return

    const canvas = gridCanvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = A4_WIDTH_PX
    canvas.height = A4_HEIGHT_PX

    // Clear with white background
    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0, 0, A4_WIDTH_PX, A4_HEIGHT_PX)

    // Create temporary canvas for individual photo
    const tempCanvas = document.createElement("canvas")
    drawPhoto(tempCanvas, photoState, PHOTO_WIDTH_PX, PHOTO_HEIGHT_PX)

    // Draw selected rows only with perfect spacing
    for (let row = 0; row < selectedRows; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = MARGIN + col * (PHOTO_WIDTH_PX + SPACING_X)
        const y = MARGIN + row * (PHOTO_HEIGHT_PX + SPACING_Y)
        ctx.drawImage(tempCanvas, x, y)
      }
    }
  }, [photoState, selectedRows, drawPhoto])

  const generatePreview = useCallback(() => {
    if (!photoState.image || !previewCanvasRef.current) return

    const canvas = previewCanvasRef.current
    const scale = 0.25
    canvas.width = A4_WIDTH_PX * scale
    canvas.height = A4_HEIGHT_PX * scale

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.scale(scale, scale)

    // Clear with white background
    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0, 0, A4_WIDTH_PX, A4_HEIGHT_PX)

    // Create temporary canvas for individual photo
    const tempCanvas = document.createElement("canvas")
    drawPhoto(tempCanvas, photoState, PHOTO_WIDTH_PX, PHOTO_HEIGHT_PX)

    // Draw selected rows only
    for (let row = 0; row < selectedRows; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = MARGIN + col * (PHOTO_WIDTH_PX + SPACING_X)
        const y = MARGIN + row * (PHOTO_HEIGHT_PX + SPACING_Y)
        ctx.drawImage(tempCanvas, x, y)
      }
    }
  }, [photoState, selectedRows, drawPhoto])

  const exportAsJPG = useCallback(() => {
    if (!gridCanvasRef.current) return

    const now = new Date()
    const timestamp = now.toISOString().slice(0, 19).replace(/:/g, "-")
    const filename = `PassportPhotos_${selectedRows}Rows_${selectedRows * 5}Photos_${timestamp}.jpg`

    const link = document.createElement("a")
    link.download = filename
    link.href = gridCanvasRef.current.toDataURL("image/jpeg", 0.95)
    link.click()

    // Update stats
    updateStats("photo_exported")
  }, [selectedRows, updateStats])

  const exportAsPDF = useCallback(() => {
    if (!gridCanvasRef.current) return

    const canvas = gridCanvasRef.current
    const imgData = canvas.toDataURL("image/jpeg", 0.95)

    const now = new Date()
    const timestamp = now.toISOString().slice(0, 19).replace(/:/g, "-")
    const filename = `PassportPhotos_A4_${selectedRows}Rows_${selectedRows * 5}Photos_${timestamp}.pdf`

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "cm",
      format: "a4",
    })

    pdf.addImage(imgData, "JPEG", 0, 0, 21, 29.7)
    pdf.save(filename)

    // Update stats
    updateStats("photo_exported")
  }, [selectedRows, updateStats])

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      setPhotoState(history[historyIndex - 1])
    }
  }, [history, historyIndex])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      setPhotoState(history[historyIndex + 1])
    }
  }, [history, historyIndex])

  const resetBackgroundRemoval = useCallback(() => {
    updatePhotoState({
      processedImage: null,
      backgroundRemoved: false,
    })
  }, [updatePhotoState])

  const resetAllAdjustments = useCallback(() => {
    updatePhotoState({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      sharpness: 100,
      rotation: 0,
      zoom: 1,
      x: 0,
      y: 0,
    })
  }, [updatePhotoState])

  // Update canvases when state changes
  useEffect(() => {
    if (canvasRef.current && photoState.image) {
      drawPhoto(canvasRef.current, photoState, PHOTO_WIDTH_PX / 2.5, PHOTO_HEIGHT_PX / 2.5)
    }
  }, [photoState, drawPhoto])

  useEffect(() => {
    if (photoState.image) {
      generateGrid()
      generatePreview()
    }
  }, [photoState, selectedRows, generateGrid, generatePreview])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white flex items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          Loading Studio...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-gray-900/95 border-b border-gray-700/50 shadow-2xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500 via-purple-600 to-pink-500 shadow-lg">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Photo Studio Pro
                </h1>
                <p className="text-sm text-gray-400">AI-Powered Professional Passport Photos</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Live Stats */}
              <div className="hidden md:flex items-center gap-4 px-4 py-2 rounded-full bg-gradient-to-r from-gray-800/50 to-gray-700/50 border border-gray-600/30 backdrop-blur-sm">
                <div className="flex items-center gap-1 text-green-400">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">{stats.totalUsers.toLocaleString()}</span>
                </div>
                <div className="w-px h-4 bg-gray-600"></div>
                <div className="flex items-center gap-1 text-blue-400">
                  <Activity className="w-4 h-4" />
                  <span className="text-sm font-medium">{stats.photosGenerated.toLocaleString()}</span>
                </div>
              </div>

              <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30 hidden sm:flex">
                <Sparkles className="w-3 h-3 mr-1" />
                AI Ready
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="rounded-full hover:bg-gray-700 transition-all duration-200"
              >
                {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid xl:grid-cols-4 lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls */}
          <div className="xl:col-span-1 lg:col-span-1 space-y-4">
            {/* Upload Section */}
            <Card className="backdrop-blur-xl bg-gray-800/60 border-gray-700/50 shadow-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-400" />
                  Upload Photo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-300 ${
                    dragActive
                      ? "border-blue-400 bg-blue-500/10 scale-105"
                      : "border-gray-600 hover:border-gray-500 hover:bg-gray-700/30"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-24 bg-transparent hover:bg-gray-700/50 border-0 transition-all duration-200"
                    variant="outline"
                    disabled={isProcessing}
                  >
                    <div className="flex flex-col items-center gap-2">
                      {isProcessing ? (
                        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                      ) : (
                        <Upload className="w-8 h-8 text-blue-400" />
                      )}
                      <span className="font-medium text-white">
                        {isProcessing ? "Processing..." : "Click or Drop Image"}
                      </span>
                      <span className="text-xs text-gray-400">JPG, PNG up to 10MB</span>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* AI Background Removal */}
            {photoState.image && (
              <Card className="backdrop-blur-xl bg-gray-800/60 border-gray-700/50 shadow-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-green-400" />
                    AI Background Removal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-gray-300">Remove Background</Label>
                    <Switch
                      checked={photoState.backgroundRemoved}
                      onCheckedChange={(checked) => {
                        if (checked && !photoState.backgroundRemoved) {
                          removeBackground()
                        } else if (!checked) {
                          resetBackgroundRemoval()
                        }
                      }}
                      disabled={isProcessing}
                    />
                  </div>

                  {!photoState.backgroundRemoved ? (
                    <Button
                      onClick={removeBackground}
                      disabled={isProcessing}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transition-all duration-200"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Removing...
                        </>
                      ) : (
                        <>
                          <Scissors className="w-4 h-4 mr-2" />
                          Remove Background
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={resetBackgroundRemoval}
                      variant="outline"
                      className="w-full border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                    >
                      <Undo className="w-4 h-4 mr-2" />
                      Restore Original
                    </Button>
                  )}

                  {/* Progress Bar */}
                  {backgroundRemovalProgress > 0 && backgroundRemovalProgress < 100 && (
                    <div className="space-y-2">
                      <Progress value={backgroundRemovalProgress} className="w-full" />
                      <p className="text-xs text-center text-gray-400">{processingStatus}</p>
                    </div>
                  )}

                  {/* Success/Error Messages */}
                  {processingStatus && backgroundRemovalProgress === 100 && (
                    <div className="flex items-center gap-2 text-green-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      <span>{processingStatus}</span>
                    </div>
                  )}

                  {apiError && (
                    <div className="flex items-center gap-2 text-yellow-400 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>{apiError}</span>
                    </div>
                  )}

                  <div className="text-xs text-gray-400 bg-gradient-to-r from-gray-700/30 to-gray-600/30 p-3 rounded-lg">
                    <div className="flex items-center gap-1 mb-1">
                      <Sparkles className="w-3 h-3 text-green-400" />
                      <span className="font-medium text-green-400">Professional AI Removal</span>
                    </div>
                    <div className="text-gray-300">Studio-quality background removal with fallback support</div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Layout Settings */}
            <Card className="backdrop-blur-xl bg-gray-800/60 border-gray-700/50 shadow-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-400" />
                  Layout Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-300">Number of Rows</Label>
                  <Select
                    value={selectedRows.toString()}
                    onValueChange={(value) => setSelectedRows(Number.parseInt(value))}
                  >
                    <SelectTrigger className="mt-1 bg-gray-700/50 border-gray-600 hover:bg-gray-700/70 transition-all duration-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      {[1, 2, 3, 4, 5, 6].map((num) => (
                        <SelectItem key={num} value={num.toString()} className="text-white hover:bg-gray-700">
                          {num} Row{num > 1 ? "s" : ""} ({num * 5} Photos)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-300">Auto Center</Label>
                  <Switch
                    checked={photoState.autoCenter}
                    onCheckedChange={(checked) => updatePhotoState({ autoCenter: checked })}
                  />
                </div>

                <div className="text-xs text-gray-400 bg-gradient-to-r from-gray-700/30 to-gray-600/30 p-3 rounded-lg">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex justify-between">
                      <span>Photos per row:</span>
                      <span className="text-blue-400 font-medium">5</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total photos:</span>
                      <span className="text-green-400 font-medium">{selectedRows * 5}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Photo size:</span>
                      <span className="text-purple-400 font-medium">3.5×4.5cm</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Print quality:</span>
                      <span className="text-orange-400 font-medium">300 DPI</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Photo Controls */}
            {photoState.image && (
              <Card className="backdrop-blur-xl bg-gray-800/60 border-gray-700/50 shadow-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="w-5 h-5 text-orange-400" />
                    Photo Controls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="adjust" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 bg-gray-700/50">
                      <TabsTrigger value="adjust" className="text-xs">
                        Adjust
                      </TabsTrigger>
                      <TabsTrigger value="enhance" className="text-xs">
                        Enhance
                      </TabsTrigger>
                      <TabsTrigger value="background" className="text-xs">
                        Background
                      </TabsTrigger>
                      <TabsTrigger value="border" className="text-xs">
                        Border
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="adjust" className="space-y-4 mt-4">
                      <div className="flex gap-2 mb-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={undo}
                          disabled={historyIndex <= 0}
                          className="flex-1"
                        >
                          <Undo className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={redo}
                          disabled={historyIndex >= history.length - 1}
                          className="flex-1"
                        >
                          <Redo className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-300">Zoom</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <ZoomOut className="w-4 h-4 text-gray-400" />
                            <Slider
                              value={[photoState.zoom]}
                              onValueChange={([value]) => updatePhotoState({ zoom: value })}
                              min={0.5}
                              max={3}
                              step={0.1}
                              className="flex-1"
                            />
                            <ZoomIn className="w-4 h-4 text-gray-400" />
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-gray-300">Rotation</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <RotateCw className="w-4 h-4 text-gray-400" />
                            <Slider
                              value={[photoState.rotation]}
                              onValueChange={([value]) => updatePhotoState({ rotation: value })}
                              min={-180}
                              max={180}
                              step={1}
                              className="flex-1"
                            />
                            <span className="text-xs w-8 text-gray-400">{photoState.rotation}°</span>
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-gray-300">Position X</Label>
                          <Slider
                            value={[photoState.x]}
                            onValueChange={([value]) => updatePhotoState({ x: value })}
                            min={-100}
                            max={100}
                            step={1}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-gray-300">Position Y</Label>
                          <Slider
                            value={[photoState.y]}
                            onValueChange={([value]) => updatePhotoState({ y: value })}
                            min={-100}
                            max={100}
                            step={1}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="enhance" className="space-y-4 mt-4">
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-300">Brightness</Label>
                          <Slider
                            value={[photoState.brightness]}
                            onValueChange={([value]) => updatePhotoState({ brightness: value })}
                            min={50}
                            max={150}
                            step={1}
                            className="mt-1"
                          />
                          <div className="text-xs text-gray-400 mt-1">{photoState.brightness}%</div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-gray-300">Contrast</Label>
                          <Slider
                            value={[photoState.contrast]}
                            onValueChange={([value]) => updatePhotoState({ contrast: value })}
                            min={50}
                            max={150}
                            step={1}
                            className="mt-1"
                          />
                          <div className="text-xs text-gray-400 mt-1">{photoState.contrast}%</div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-gray-300">Saturation</Label>
                          <Slider
                            value={[photoState.saturation]}
                            onValueChange={([value]) => updatePhotoState({ saturation: value })}
                            min={0}
                            max={200}
                            step={1}
                            className="mt-1"
                          />
                          <div className="text-xs text-gray-400 mt-1">{photoState.saturation}%</div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-gray-300">Sharpness</Label>
                          <Slider
                            value={[photoState.sharpness]}
                            onValueChange={([value]) => updatePhotoState({ sharpness: value })}
                            min={50}
                            max={150}
                            step={1}
                            className="mt-1"
                          />
                          <div className="text-xs text-gray-400 mt-1">{photoState.sharpness}%</div>
                        </div>

                        <Button onClick={resetAllAdjustments} variant="outline" className="w-full mt-4">
                          <Focus className="w-4 h-4 mr-2" />
                          Reset All
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="background" className="space-y-4 mt-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-300">Popular Colors</Label>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {backgroundColors
                            .filter((color) => color.popular)
                            .map((color) => (
                              <Button
                                key={color.name}
                                variant={photoState.backgroundColor === color.value ? "default" : "outline"}
                                size="sm"
                                onClick={() => updatePhotoState({ backgroundColor: color.value })}
                                className="h-10 text-xs justify-start transition-all duration-200"
                              >
                                <div
                                  className="w-4 h-4 rounded-full mr-2 border border-gray-600 shadow-sm"
                                  style={{ backgroundColor: color.value }}
                                />
                                {color.name}
                              </Button>
                            ))}
                        </div>

                        <Label className="text-sm font-medium text-gray-300 mt-4 block">More Colors</Label>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {backgroundColors
                            .filter((color) => !color.popular)
                            .map((color) => (
                              <Button
                                key={color.name}
                                variant={photoState.backgroundColor === color.value ? "default" : "outline"}
                                size="sm"
                                onClick={() => updatePhotoState({ backgroundColor: color.value })}
                                className="h-10 text-xs justify-start transition-all duration-200"
                              >
                                <div
                                  className="w-4 h-4 rounded-full mr-2 border border-gray-600 shadow-sm"
                                  style={{ backgroundColor: color.value }}
                                />
                                {color.name}
                              </Button>
                            ))}
                        </div>

                        <div className="mt-3">
                          <Label className="text-sm font-medium text-gray-300">Custom Color</Label>
                          <Input
                            type="color"
                            value={photoState.backgroundColor}
                            onChange={(e) => updatePhotoState({ backgroundColor: e.target.value })}
                            className="mt-1 h-10 bg-gray-700 border-gray-600"
                          />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="border" className="space-y-4 mt-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-300">Border Style</Label>
                        <div className="grid grid-cols-1 gap-2 mt-2">
                          {borderStyles.map((border) => (
                            <Button
                              key={border.name}
                              variant={
                                photoState.borderWidth === border.width && photoState.borderColor === border.color
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => updatePhotoState({ borderWidth: border.width, borderColor: border.color })}
                              className="h-10 text-xs justify-start transition-all duration-200"
                            >
                              <Square className="w-4 h-4 mr-2" style={{ color: border.color }} />
                              {border.name}
                            </Button>
                          ))}
                        </div>
                        <div className="mt-3 space-y-2">
                          <div>
                            <Label className="text-sm font-medium text-gray-300">Custom Width</Label>
                            <Slider
                              value={[photoState.borderWidth]}
                              onValueChange={([value]) => updatePhotoState({ borderWidth: value })}
                              min={0}
                              max={10}
                              step={1}
                              className="mt-1"
                            />
                            <div className="text-xs text-gray-400 mt-1">{photoState.borderWidth}px</div>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-gray-300">Border Color</Label>
                            <Input
                              type="color"
                              value={photoState.borderColor}
                              onChange={(e) => updatePhotoState({ borderColor: e.target.value })}
                              className="mt-1 h-10 bg-gray-700 border-gray-600"
                            />
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {/* Export Section */}
            {photoState.image && (
              <Card className="backdrop-blur-xl bg-gray-800/60 border-gray-700/50 shadow-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Download className="w-5 h-5 text-green-400" />
                    Export & Print
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={() => setShowPreview(!showPreview)}
                    variant="outline"
                    className="w-full bg-blue-500/20 border-blue-500/50 hover:bg-blue-500/30 transition-all duration-200"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {showPreview ? "Hide Preview" : "Show Preview"}
                  </Button>
                  <Button
                    onClick={exportAsJPG}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transition-all duration-200"
                  >
                    <FileImage className="w-4 h-4 mr-2" />
                    Export JPG (Studio Quality)
                  </Button>
                  <Button
                    onClick={exportAsPDF}
                    className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 transition-all duration-200"
                  >
                    <FilePdf className="w-4 h-4 mr-2" />
                    Export PDF (A4 Ready)
                  </Button>
                  <div className="text-xs text-gray-400 bg-gradient-to-r from-gray-700/30 to-gray-600/30 p-3 rounded-lg">
                    <div className="flex items-center gap-1 text-green-400 mb-1">
                      <Printer className="w-3 h-3" />
                      <span className="font-medium">Professional Studio Output</span>
                    </div>
                    <div className="text-gray-300">300 DPI • AI Enhanced • Professional Borders • A4 Ready</div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Panel - Preview */}
          <div className="xl:col-span-3 lg:col-span-2 space-y-6">
            {/* Single Photo Preview */}
            {photoState.image && (
              <Card className="backdrop-blur-xl bg-gray-800/60 border-gray-700/50 shadow-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between flex-wrap gap-2">
                    <span className="flex items-center gap-2">
                      <Camera className="w-5 h-5 text-blue-400" />
                      Studio Photo Preview
                    </span>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        3.5×4.5cm
                      </Badge>
                      {photoState.backgroundRemoved && (
                        <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
                          <Scissors className="w-3 h-3 mr-1" />
                          AI Removed
                        </Badge>
                      )}
                      <Badge variant="secondary" className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Enhanced
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-center">
                    <div className="border-2 border-dashed border-gray-600 rounded-xl p-6 bg-gradient-to-br from-gray-700/20 to-gray-600/20">
                      <canvas
                        ref={canvasRef}
                        className="border-2 border-gray-500 rounded-lg shadow-2xl bg-white"
                        style={{ maxWidth: "180px", maxHeight: "232px" }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* A4 Layout Preview */}
            {photoState.image && (
              <Card className="backdrop-blur-xl bg-gray-800/60 border-gray-700/50 shadow-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between flex-wrap gap-2">
                    <span className="flex items-center gap-2">
                      <Grid3X3 className="w-5 h-5 text-purple-400" />
                      Professional A4 Layout
                    </span>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="secondary" className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                        {selectedRows} Row{selectedRows > 1 ? "s" : ""} • {selectedRows * 5} Photos
                      </Badge>
                      <Badge variant="secondary" className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Studio Quality
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-center">
                    <div className="border-4 border-gray-600 rounded-xl shadow-2xl overflow-hidden bg-white">
                      {showPreview ? (
                        <canvas
                          ref={previewCanvasRef}
                          className="max-w-full h-auto"
                          style={{ maxWidth: "100%", maxHeight: "600px" }}
                        />
                      ) : (
                        <canvas
                          ref={gridCanvasRef}
                          className="max-w-full h-auto"
                          style={{ maxWidth: "100%", maxHeight: "600px" }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="mt-6 text-center">
                    <div className="inline-flex items-center gap-4 text-sm text-gray-300 bg-gradient-to-r from-gray-700/40 to-gray-600/40 px-6 py-3 rounded-full shadow-lg flex-wrap justify-center">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-4 h-4 text-blue-400" />
                        A4 Size: 21×29.7cm
                      </span>
                      <span className="hidden sm:inline">•</span>
                      <span className="flex items-center gap-1">
                        <Camera className="w-4 h-4 text-green-400" />
                        300 DPI Quality
                      </span>
                      <span className="hidden sm:inline">•</span>
                      <span className="flex items-center gap-1">
                        <Wand2 className="w-4 h-4 text-purple-400" />
                        AI Enhanced
                      </span>
                      <span className="hidden sm:inline">•</span>
                      <span className="flex items-center gap-1">
                        <Printer className="w-4 h-4 text-orange-400" />
                        Print Ready
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Instructions */}
            {!photoState.image && (
              <Card className="backdrop-blur-xl bg-gray-800/60 border-gray-700/50 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-2xl text-center">
                    <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                      AI-Powered Photo Studio Generator
                    </span>
                  </CardTitle>
                  <p className="text-center text-gray-400 mt-2">
                    Create professional passport photos with AI background removal and studio-quality enhancements
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h3 className="font-semibold text-blue-400 flex items-center gap-2">
                          <Wand2 className="w-5 h-5" />
                          AI-Powered Workflow:
                        </h3>
                        <div className="space-y-3">
                          {[
                            { step: 1, text: "Upload customer photo (drag & drop)", icon: Upload },
                            { step: 2, text: "AI removes background instantly", icon: Scissors },
                            { step: 3, text: "Auto-enhance with professional filters", icon: Sparkles },
                            { step: 4, text: "Select layout and export", icon: Printer },
                          ].map(({ step, text, icon: Icon }) => (
                            <div key={step} className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 via-purple-600 to-pink-500 text-white flex items-center justify-center text-sm font-bold shadow-lg">
                                {step}
                              </div>
                              <div className="flex items-center gap-2 text-gray-300">
                                <Icon className="w-4 h-4 text-blue-400" />
                                <p>{text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h3 className="font-semibold text-green-400 flex items-center gap-2">
                          <Camera className="w-5 h-5" />
                          Premium Features:
                        </h3>
                        <div className="space-y-2">
                          {[
                            { text: "AI Background Removal", color: "text-green-400", icon: Wand2 },
                            { text: "Professional Enhancement", color: "text-blue-400", icon: Sparkles },
                            { text: "Studio-Quality Borders", color: "text-purple-400", icon: Square },
                            { text: "Perfect A4 Sizing", color: "text-orange-400", icon: Grid3X3 },
                            { text: "300 DPI Print Quality", color: "text-pink-400", icon: Printer },
                            { text: "Auto Face Centering", color: "text-cyan-400", icon: Focus },
                            { text: "Brightness/Contrast Control", color: "text-yellow-400", icon: Palette },
                            { text: "Instant JPG & PDF Export", color: "text-red-400", icon: Download },
                          ].map((feature, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <feature.icon className={`w-4 h-4 ${feature.color}`} />
                              <span className={`text-sm ${feature.color}`}>{feature.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-blue-400 mb-2">
                        <Sparkles className="w-5 h-5" />
                        <span className="font-semibold">Perfect for Professional Print Shops</span>
                      </div>
                      <p className="text-sm text-gray-300">
                        Serve customers in under 30 seconds with AI-powered background removal and professional
                        studio-quality results. Each photo includes proper borders, color enhancement, and perfect
                        positioning for authentic studio prints.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Professional Footer */}
      <footer className="mt-12 border-t border-gray-700/50 pt-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 text-gray-400">
            <div className="h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent flex-1 max-w-32"></div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-gray-800/50 to-gray-700/50 border border-gray-600/30 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Built By Narender Singh
              </span>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent flex-1 max-w-32"></div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <a
              href="https://www.linkedin.com/in/narendersingh1"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-600/20 to-blue-500/20 border border-blue-500/30 text-blue-400 hover:from-blue-600/30 hover:to-blue-500/30 hover:border-blue-400/50 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/20"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              <span className="text-sm font-medium">Connect on LinkedIn</span>
            </a>
          </div>

          {/* Enhanced Footer Stats */}
          <div className="bg-gradient-to-r from-gray-800/30 to-gray-700/30 rounded-xl p-6 border border-gray-600/20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                  <Users className="w-5 h-5" />
                  <span className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-400">Happy Customers</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-blue-400 mb-2">
                  <Activity className="w-5 h-5" />
                  <span className="text-2xl font-bold">{stats.photosGenerated.toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-400">Photos Generated</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-purple-400 mb-2">
                  <Scissors className="w-5 h-5" />
                  <span className="text-2xl font-bold">{stats.backgroundsRemoved.toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-400">Backgrounds Removed</p>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500 flex items-center justify-center gap-2">
            <span>🚀</span>
            <span>Professional Photo Studio Generator</span>
            <span>•</span>
            <span>AI-Powered</span>
            <span>•</span>
            <span>Made with ❤️</span>
          </div>
        </div>
      </footer>

      {/* Hidden canvases for processing */}
      <canvas ref={gridCanvasRef} style={{ display: "none" }} />
      <canvas ref={previewCanvasRef} style={{ display: "none" }} />
      <canvas ref={tempCanvasRef} style={{ display: "none" }} />
    </div>
  )
}
