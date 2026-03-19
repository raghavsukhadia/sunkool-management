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

  const w = isIcon ? sizeMap[size].iconSize : sizeMap[size].width
  const h = isIcon ? sizeMap[size].iconSize : sizeMap[size].height

  return (
    <div className="flex items-center" style={{ width: w, height: h }}>
      <Image
        src={isIcon ? "/images/logo-icon.png" : "/images/logo.png"}
        alt="Sunkool OMS"
        width={w}
        height={h}
        className="object-contain w-full h-full"
        style={{ width: "auto", height: "auto", maxWidth: "100%", maxHeight: "100%" }}
        priority
      />
    </div>
  )
}
