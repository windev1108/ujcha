import { TextInput, View, Text, type TextInputProps } from 'react-native'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <View className="mb-4">
      {label && (
        <Text className="text-xs font-semibold text-muted uppercase tracking-widest mb-1.5">
          {label}
        </Text>
      )}
      <TextInput
        className={`h-11 rounded-xl border px-4 text-[15px] text-ink bg-white ${
          error ? 'border-danger' : 'border-black/10'
        } ${className ?? ''}`}
        placeholderTextColor="#717171"
        {...props}
      />
      {error && <Text className="text-xs text-danger mt-1">{error}</Text>}
    </View>
  )
}
