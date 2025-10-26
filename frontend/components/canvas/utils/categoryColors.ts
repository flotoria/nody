export const getCategoryColors = (category: string) => {
  const categoryMap: Record<string, {
    primary: string
    secondary: string
    accent: string
    border: string
    bg: string
    text: string
  }> = {
    "Files": {
      primary: "#fb923c", // orange-400
      secondary: "#fdba74", // orange-300
      accent: "#f97316", // orange-500
      border: "#fb923c4d", // orange-400/30
      bg: "#fb923c1a", // orange-400/10
      text: "#fb923c" // orange-400
    },
    "AI / ML Boilerplates": {
      primary: "#a855f7", // purple-400
      secondary: "#c084fc", // purple-300
      accent: "#9333ea", // purple-500
      border: "#a855f74d", // purple-400/30
      bg: "#a855f71a", // purple-400/10
      text: "#a855f7" // purple-400
    },
    "Web & API": {
      primary: "#60a5fa", // blue-400
      secondary: "#93c5fd", // blue-300
      accent: "#3b82f6", // blue-500
      border: "#60a5fa4d", // blue-400/30
      bg: "#60a5fa1a", // blue-400/10
      text: "#60a5fa" // blue-400
    },
    "Backend Logic": {
      primary: "#818cf8", // indigo-400
      secondary: "#a5b4fc", // indigo-300
      accent: "#6366f1", // indigo-500
      border: "#818cf84d", // indigo-400/30
      bg: "#818cf81a", // indigo-400/10
      text: "#818cf8" // indigo-400
    },
    "Database & Data Flow": {
      primary: "#4ade80", // green-400
      secondary: "#86efac", // green-300
      accent: "#22c55e", // green-500
      border: "#4ade804d", // green-400/30
      bg: "#4ade801a", // green-400/10
      text: "#4ade80" // green-400
    },
    "DevOps & Infra": {
      primary: "#2dd4bf", // teal-400
      secondary: "#5eead4", // teal-300
      accent: "#14b8a6", // teal-500
      border: "#2dd4bf4d", // teal-400/30
      bg: "#2dd4bf1a", // teal-400/10
      text: "#2dd4bf" // teal-400
    },
    "Frontend / UI": {
      primary: "#f472b6", // pink-400
      secondary: "#f9a8d4", // pink-300
      accent: "#ec4899", // pink-500
      border: "#f472b64d", // pink-400/30
      bg: "#f472b61a", // pink-400/10
      text: "#f472b6" // pink-400
    },
    "Security & Auth": {
      primary: "#f87171", // red-400
      secondary: "#fca5a5", // red-300
      accent: "#ef4444", // red-500
      border: "#f871714d", // red-400/30
      bg: "#f871711a", // red-400/10
      text: "#f87171" // red-400
    },
    "Utility / Common": {
      primary: "#22d3ee", // cyan-400
      secondary: "#67e8f9", // cyan-300
      accent: "#06b6d4", // cyan-500
      border: "#22d3ee4d", // cyan-400/30
      bg: "#22d3ee1a", // cyan-400/10
      text: "#22d3ee" // cyan-400
    }
  }
  
  return categoryMap[category] || {
    primary: "#9ca3af", // gray-400
    secondary: "#d1d5db", // gray-300
    accent: "#6b7280", // gray-500
    border: "#9ca3af4d", // gray-400/30
    bg: "#9ca3af1a", // gray-400/10
    text: "#9ca3af" // gray-400
  }
}

