import Image from "next/image"

export default function SunkoolLogo({
  variant = "dark",
  size = "md",
  type = "full"
}: {
  variant?: "dark" | "light"
  size?: "sm" | "md" | "lg"
  type?: "full" | "icon"
}) {
  const sizeMap = {
    sm: { width: 80, height: 28, iconSize: 24 },
    md: { width: 120, height: 42, iconSize: 32 },
    lg: { width: 160, height: 56, iconSize: 48 },
  }

  const isIcon = type === "icon"

  return (
    <div className="flex items-center">
      <Image
        src={isIcon ? "/images/logo-icon.png" : "/images/logo.png"}
        alt="Sunkool OMS"
        width={isIcon ? sizeMap[size].iconSize : sizeMap[size].width}
        height={isIcon ? sizeMap[size].iconSize : sizeMap[size].height}
        className="object-contain"
        priority
      />
    </div>
  )
}
