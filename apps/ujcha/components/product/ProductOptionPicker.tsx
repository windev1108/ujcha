import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { formatVnd } from '@/lib/format'
import type { ProductOptionGroup, ProductTopping } from '@/types'

interface OptionPickerProps {
  optionGroups: ProductOptionGroup[]
  selectedOptions: Record<string, string>
  onSelect: (groupName: string, value: string) => void
}

export function OptionPicker({ optionGroups, selectedOptions, onSelect }: OptionPickerProps) {
  return (
    <View>
      {optionGroups.map((group) => (
        <View key={group.id} className="mb-4">
          <View className="flex-row items-center mb-2">
            <Text className="text-[15px] font-semibold text-ink">{group.name}</Text>
            {group.selectionMin > 0 && (
              <View className="ml-2 bg-primary rounded-full px-2 py-0.5">
                <Text className="text-[10px] font-bold text-white">Bắt buộc</Text>
              </View>
            )}
          </View>
          <View className="flex-row flex-wrap gap-2">
            {group.values.map((val) => {
              const isSelected = selectedOptions[group.name] === val.label
              return (
                <TouchableOpacity
                  key={val.label}
                  onPress={() => onSelect(group.name, val.label)}
                  className={`rounded-full px-4 py-2 border ${
                    isSelected
                      ? 'bg-primary border-primary'
                      : 'bg-white border-black/10'
                  }`}
                >
                  <Text className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-ink'}`}>
                    {val.label}
                    {val.priceDelta > 0 ? ` +${formatVnd(val.priceDelta)}` : ''}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      ))}
    </View>
  )
}

interface ToppingPickerProps {
  toppings: ProductTopping[]
  selectedIds: string[]
  onToggle: (id: string) => void
}

export function ToppingPicker({ toppings, selectedIds, onToggle }: ToppingPickerProps) {
  if (toppings.length === 0) return null
  return (
    <View className="mb-4">
      <Text className="text-[15px] font-semibold text-ink mb-2">Topping</Text>
      {toppings.map((t) => {
        const isSelected = selectedIds.includes(t.id)
        return (
          <TouchableOpacity
            key={t.id}
            onPress={() => onToggle(t.id)}
            className="flex-row items-center justify-between py-3 border-b border-black/5"
          >
            <View className="flex-row items-center gap-3">
              <View
                className={`w-5 h-5 rounded border-2 items-center justify-center ${
                  isSelected ? 'bg-primary border-primary' : 'border-black/20'
                }`}
              >
                {isSelected && (
                  <Text className="text-white text-[10px] font-bold">✓</Text>
                )}
              </View>
              <Text className="text-[15px] text-ink">{t.name}</Text>
            </View>
            <Text className="text-sm text-muted">{t.price > 0 ? `+${formatVnd(t.price)}` : 'Miễn phí'}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}
