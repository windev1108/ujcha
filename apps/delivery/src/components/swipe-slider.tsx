import { useEffect, useRef, useState } from 'react';
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
  const [trackW, setTrackW] = useState(0);
  const trackWRef = useRef(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const confirmedRef = useRef(false);
  const isDisabledRef = useRef(disabled || loading);
  isDisabledRef.current = disabled || loading;

  // Reset thumb position when loading finishes
  useEffect(() => {
    if (!loading && confirmedRef.current) {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 8 }).start(() => {
        confirmedRef.current = false;
      });
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isDisabledRef.current,
      onMoveShouldSetPanResponder: () => !isDisabledRef.current,
      onPanResponderMove: (_, { dx }) => {
        if (isDisabledRef.current) return;
        const max = trackWRef.current - THUMB - 8;
        translateX.setValue(Math.max(0, Math.min(dx, max)));
      },
      onPanResponderRelease: (_, { dx }) => {
        if (isDisabledRef.current) return;
        const max = trackWRef.current - THUMB - 8;
        if (!confirmedRef.current && dx >= max * 0.8) {
          confirmedRef.current = true;
          Animated.timing(translateX, { toValue: max, duration: 120, useNativeDriver: true }).start(() => {
            onConfirm();
          });
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  const fillOpacity = translateX.interpolate({
    inputRange: [0, Math.max(trackW - THUMB - 8, 1)],
    outputRange: [0, 0.9],
    extrapolate: 'clamp',
  });

  const trackBg = color + '18';
  const borderColor = color + '55';

  return (
    <View
      style={[ss.track, { backgroundColor: trackBg, borderColor }]}
      onLayout={(e) => {
        trackWRef.current = e.nativeEvent.layout.width;
        setTrackW(e.nativeEvent.layout.width);
      }}
    >
      {/* Progressive fill */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: fillOpacity, borderRadius: 100 }]} />

      {/* Label */}
      <Text style={[ss.label, { color: loading ? '#b0b0b0' : color }]}>
        {loading ? 'Đang xử lý…' : `${label} →`}
      </Text>

      {/* Thumb */}
      <Animated.View
        style={[ss.thumb, { backgroundColor: loading ? '#e5e7eb' : color, transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {loading
          ? <ActivityIndicator size="small" color={color} />
          : icon
        }
      </Animated.View>
    </View>
  );
}

const ss = StyleSheet.create({
  track: {
    height: 60, borderRadius: 100, justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', paddingHorizontal: 4, borderWidth: 1.5,
  },
  label: { fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  thumb: {
    position: 'absolute', left: 4, width: THUMB, height: THUMB, borderRadius: 100,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 5,
  },
});
