import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

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
  const trackW = useSharedValue(0);
  const translateX = useSharedValue(0);
  const confirmed = useSharedValue(false);

  useEffect(() => {
    if (!loading && confirmed.value) {
      translateX.value = withSpring(0, { damping: 15 });
      confirmed.value = false;
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const gesture = Gesture.Pan()
    .enabled(!disabled && !loading)
    .onUpdate(({ translationX }) => {
      const max = trackW.value - THUMB - 8;
      translateX.value = Math.max(0, Math.min(translationX, max));
    })
    .onEnd(({ translationX }) => {
      const max = trackW.value - THUMB - 8;
      if (!confirmed.value && translationX >= max * 0.8) {
        confirmed.value = true;
        translateX.value = withTiming(max, { duration: 120 }, (ok) => {
          if (ok) runOnJS(onConfirm)();
        });
      } else {
        translateX.value = withSpring(0, { damping: 15 });
      }
    });

  const thumbAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const fillAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, Math.max(trackW.value - THUMB - 8, 1)],
      [0, 0.9],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View
      style={[ss.track, { backgroundColor: `${color}18`, borderColor: `${color}55` }]}
      onLayout={({ nativeEvent }) => { trackW.value = nativeEvent.layout.width; }}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, ss.fill, { backgroundColor: color }, fillAnimStyle]}
      />
      <Text style={[ss.label, { color: loading ? '#b0b0b0' : color }]}>
        {loading ? 'Đang xử lý…' : `${label} →`}
      </Text>
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[ss.thumb, { backgroundColor: loading ? '#e5e7eb' : color }, thumbAnimStyle]}
        >
          {loading ? <ActivityIndicator size="small" color={color} /> : icon}
        </Animated.View>
      </GestureDetector>
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
