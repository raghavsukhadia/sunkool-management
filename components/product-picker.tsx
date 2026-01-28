"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getProducts } from "@/app/actions/management"
import { Search, Package, Check, X } from "lucide-react"

interface Product {
  id: string
  name: string
  sku: string
  price: number
  description: string | null
  category: string | null
  parent_product_id: string | null
}

interface SelectedProduct extends Product {
  quantity: number
}

interface ProductPickerProps {
  selectedProducts: SelectedProduct[]
  onProductsChange: (products: SelectedProduct[]) => void
  onClose?: () => void
}

export function ProductPicker({ selectedProducts, onProductsChange, onClose }: ProductPickerProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    setLoading(true)
    try {
      const result = await getProducts()
      if (result.success && result.data) {
        setProducts(result.data as Product[])
        // Initialize quantity inputs for already selected products
        const initialQuantities: Record<string, string> = {}
        selectedProducts.forEach(sp => {
          initialQuantities[sp.id] = sp.quantity.toString()
        })
        setQuantityInputs(initialQuantities)
      }
    } catch (err) {
      console.error("Failed to load products:", err)
    } finally {
      setLoading(false)
    }
  }

  // Get unique categories
  const categories = useMemo(() => {
    const cats = products
      .map(p => p.category)
      .filter((cat): cat is string => cat !== null && cat !== "")
    return Array.from(new Set(cats)).sort()
  }, [products])

  // Group products by category
  const productsByCategory = useMemo(() => {
    const grouped: Record<string, Product[]> = {}
    const uncategorized: Product[] = []

    products.forEach(product => {
      if (product.category) {
        if (!grouped[product.category]) {
          grouped[product.category] = []
        }
        grouped[product.category].push(product)
      } else {
        uncategorized.push(product)
      }
    })

    return { grouped, uncategorized }
  }, [products])

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = products

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(p => p.category === selectedCategory)
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.description && p.description.toLowerCase().includes(term))
      )
    }

    return filtered
  }, [products, selectedCategory, searchTerm])

  const handleQuantityChange = (productId: string, value: string) => {
    setQuantityInputs(prev => ({ ...prev, [productId]: value }))
  }

  const handleAddProduct = (product: Product) => {
    const quantity = parseInt(quantityInputs[product.id] || "1") || 1
    
    const existingIndex = selectedProducts.findIndex(sp => sp.id === product.id)
    let updated: SelectedProduct[]

    if (existingIndex >= 0) {
      // Update existing
      updated = [...selectedProducts]
      updated[existingIndex] = { ...product, quantity }
    } else {
      // Add new
      updated = [...selectedProducts, { ...product, quantity }]
    }

    onProductsChange(updated)
    setQuantityInputs(prev => ({ ...prev, [product.id]: quantity.toString() }))
  }

  const handleRemoveProduct = (productId: string) => {
    const updated = selectedProducts.filter(sp => sp.id !== productId)
    onProductsChange(updated)
    setQuantityInputs(prev => {
      const newInputs = { ...prev }
      delete newInputs[productId]
      return newInputs
    })
  }

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    const updated = selectedProducts.map(sp =>
      sp.id === productId ? { ...sp, quantity } : sp
    )
    onProductsChange(updated)
    setQuantityInputs(prev => ({ ...prev, [productId]: quantity.toString() }))
  }

  const isProductSelected = (productId: string) => {
    return selectedProducts.some(sp => sp.id === productId)
  }

  const getSelectedQuantity = (productId: string) => {
    const selected = selectedProducts.find(sp => sp.id === productId)
    return selected?.quantity || 0
  }

  return (
    <div className="space-y-4">
      {/* Search and Category Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search products by name, SKU, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All Products
            </Button>
            {categories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading products...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {searchTerm ? "No products found matching your search." : "No products available."}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 max-h-[500px] overflow-y-auto p-2">
          {filteredProducts.map(product => {
            const isSelected = isProductSelected(product.id)
            const selectedQty = getSelectedQuantity(product.id)
            const quantityValue = quantityInputs[product.id] || (isSelected ? selectedQty.toString() : "1")

            return (
              <Card
                key={product.id}
                className={`transition-all ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 shadow-md"
                    : "hover:shadow-md"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base font-semibold">{product.name}</CardTitle>
                      <p className="text-xs text-gray-500 mt-1">SKU: {product.sku}</p>
                      {product.category && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                          {product.category}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <div className="ml-2 p-1 bg-blue-500 rounded-full">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-gray-900">₹{product.price.toFixed(2)}</span>
                    {product.description && (
                      <p className="text-xs text-gray-600 line-clamp-2">{product.description}</p>
                    )}
                  </div>

                  {isSelected ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateQuantity(product.id, Math.max(1, selectedQty - 1))}
                        >
                          -
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          value={quantityValue}
                          onChange={(e) => {
                            handleQuantityChange(product.id, e.target.value)
                            const qty = parseInt(e.target.value) || 1
                            handleUpdateQuantity(product.id, qty)
                          }}
                          className="w-20 text-center"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateQuantity(product.id, selectedQty + 1)}
                        >
                          +
                        </Button>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={() => handleRemoveProduct(product.id)}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          value={quantityValue}
                          onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                          placeholder="Qty"
                          className="w-20"
                        />
                        <Button
                          className="flex-1"
                          size="sm"
                          onClick={() => handleAddProduct(product)}
                        >
                          <Package className="w-4 h-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Selected Products Summary */}
      {selectedProducts.length > 0 && (
        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-sm">Selected Products ({selectedProducts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedProducts.map(sp => (
                <div key={sp.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{sp.name}</span>
                  <span className="text-gray-600">Qty: {sp.quantity} × ₹{sp.price.toFixed(2)} = ₹{(sp.quantity * sp.price).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-green-300">
              <div className="flex items-center justify-between font-bold">
                <span>Total:</span>
                <span>
                  ₹{selectedProducts.reduce((sum, sp) => sum + sp.quantity * sp.price, 0).toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

