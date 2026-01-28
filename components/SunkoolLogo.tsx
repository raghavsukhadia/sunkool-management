export default function SunkoolLogo({ 
  variant = "dark",
  size = "md" 
}: { 
  variant?: "dark" | "light"
  size?: "sm" | "md" | "lg"
}) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  }

  const bgColor = variant === "dark" ? "bg-white" : "bg-slate-900"
  const textColor = variant === "dark" ? "text-orange-500" : "text-white"
  const accentColor = variant === "dark" ? "text-blue-600" : "text-blue-400"

  return (
    <div className={`${sizeClasses[size]} rounded-lg flex items-center justify-center ${bgColor} shadow-lg`}>
      <div className="text-center">
        <div className={`${textColor} font-bold ${size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base"} leading-none`}>
          SK
        </div>
        <div className={`${accentColor} font-bold ${size === "sm" ? "text-[6px]" : size === "md" ? "text-xs" : "text-sm"} leading-none`}>
          OMS
        </div>
      </div>
    </div>
  )
}
