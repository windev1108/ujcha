/**
 * Icon shim — wraps @expo/vector-icons/Ionicons with the same API as lucide-react-native.
 * Use `<Package size={20} color="#fff" />` exactly like you would with lucide.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

type IconProps = { size?: number; color?: string; style?: StyleProp<ViewStyle> };

function icon(name: React.ComponentProps<typeof Ionicons>['name']) {
  return function Icon({ size = 24, color = '#1a1a1a', style }: IconProps) {
    return <Ionicons name={name} size={size} color={color} style={style as any} />;
  };
}

// Navigation / layout
export const ChevronLeft    = icon('chevron-back-outline');
export const ChevronRight   = icon('chevron-forward-outline');
export const ArrowLeft      = icon('arrow-back-outline');

// Actions
export const Check          = icon('checkmark-outline');
export const CheckCircle    = icon('checkmark-circle-outline');
export const CheckCircle2   = icon('checkmark-circle-outline');
export const X              = icon('close-outline');
export const XCircle        = icon('close-circle-outline');
export const Pencil         = icon('pencil-outline');
export const RefreshCw      = icon('refresh-outline');
export const LogOut         = icon('log-out-outline');

// Status / connectivity
export const Wifi           = icon('wifi-outline');
export const WifiOff        = icon('wifi-outline');       // tint with gray via color prop
export const Radio          = icon('radio-outline');
export const Navigation     = icon('navigate-outline');
export const MapPin         = icon('location-outline');

// Communication
export const Bell           = icon('notifications-outline');
export const BellOff        = icon('notifications-off-outline');
export const Phone          = icon('call-outline');
export const Mail           = icon('mail-outline');

// Person / identity
export const User           = icon('person-outline');

// Items / content
export const Package        = icon('cube-outline');
export const Inbox          = icon('mail-unread-outline');
export const FileText       = icon('document-text-outline');
export const Coffee         = icon('cafe-outline');
export const Bike           = icon('bicycle-outline');

// Finance
export const Wallet         = icon('wallet-outline');
export const CreditCard     = icon('card-outline');

// Misc
export const Settings       = icon('settings-outline');
export const Info           = icon('information-circle-outline');
export const Clock          = icon('time-outline');
