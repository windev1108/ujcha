import { TouchableOpacity, Text, ActivityIndicator, type TouchableOpacityProps } from 'react-native'
import { COLORS } from '@/constants/colors'

interface ButtonProps extends TouchableOpacityProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: React.ReactNode
}

const VARIANT_STYLES = {
  primary: 'bg-primary',
  secondary: 'bg-white border border-black/10',
  ghost: 'bg-transparent',
  danger: 'bg-danger',
}

const TEXT_STYLES = {
  primary: 'text-white',
  secondary: 'text-ink',
  ghost: 'text-primary',
  danger: 'text-white',
}

const SIZE_STYLES = {
  sm: 'h-9 px-4',
  md: 'h-11 px-5',
  lg: 'h-13 px-6',
}

const TEXT_SIZE = {
  sm: 'text-sm',
  md: 'text-[15px]',
  lg: 'text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading
  return (
    <TouchableOpacity
      className={`rounded-full flex-row items-center justify-center ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${isDisabled ? 'opacity-50' : 'active:opacity-80'} ${className ?? ''}`}
      disabled={isDisabled}
      activeOpacity={0.8}
      {...props}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={variant === 'secondary' || variant === 'ghost' ? COLORS.primary : '#fff'}
          className="mr-2"
        />
      )}
      {typeof children === 'string' ? (
        <Text className={`font-semibold ${TEXT_STYLES[variant]} ${TEXT_SIZE[size]}`}>
          {children}
        </Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  )
}
