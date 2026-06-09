import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const THUMB = 56;

interface Props {
  label: string;
  icon: React.ReactNode;
  color: string;
  onConfirm: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function SwipeSlider({ label, icon, color, onConfirm, loading = false, disabled = false }: Props) {
  const trackWidth = useRef(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const fillOpacity = useRef(new Animated.Value(0)).current;
  const confirmed = useRef(false);

  useEffect(() => {
    if (!loading && confirmed.current) {
      Animated.spring(translateX, { toValue: 0, damping: 15, useNativeDriver: true }).start();
      confirmed.current = false;
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && !loading,
      onMoveShouldSetPanResponder: () => !disabled && !loading,
      onPanResponderMove: (_, { dx }) => {
        const max = trackWidth.current - THUMB - 8;
        const next = Math.max(0, Math.min(dx, max));
        translateX.setValue(next);
        fillOpacity.setValue(max > 0 ? next / max * 0.9 : 0);
      },
      onPanResponderRelease: (_, { dx }) => {
        const max = trackWidth.current - THUMB - 8;
        if (!confirmed.current && dx >= max * 0.8) {
          confirmed.current = true;
          Animated.timing(translateX, { toValue: max, duration: 120, useNativeDriver: true }).start(({ finished }) => {
            if (finished) onConfirm();
          });
        } else {
          Animated.spring(translateX, { toValue: 0, damping: 15, useNativeDriver: true }).start();
          Animated.timing(fillOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  return (
    <View
      style={[ss.track, { backgroundColor: `${color}18`, borderColor: `${color}55` }]}
      onLayout={({ nativeEvent }) => { trackWidth.current = nativeEvent.layout.width; }}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, ss.fill, { backgroundColor: color, opacity: fillOpacity }]}
      />
      <Text style={[ss.label, { color: loading ? '#b0b0b0' : color }]}>
        {loading ? 'Đang xử lý…' : `${label} →`}
      </Text>
      <Animated.View
        style={[ss.thumb, { backgroundColor: loading ? '#e5e7eb' : color }, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {loading ? <ActivityIndicator size="small" color={color} /> : icon}
      </Animated.View>
    </View>
  );
}

const ss = StyleSheet.create({
  track: {
    height: 60, borderRadius: 100, justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', paddingHorizontal: 4, borderWidth: 1.5,
  },
  fill: { borderRadius: 100 },
  label: { fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  thumb: {
    position: 'absolute', left: 4, width: THUMB, height: THUMB, borderRadius: 100,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 5,
  },
});
