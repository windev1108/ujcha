import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
const DURATION = 600;

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 0, duration: DURATION, useNativeDriver: true }).start(() => {
      setVisible(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;
  return <Animated.View style={[styles.backgroundSolidColor, { opacity }]} />;
}

export function AnimatedIcon() {
  const scale = useRef(new Animated.Value(INITIAL_SCALE_FACTOR)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: DURATION, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(DURATION * 0.4),
        Animated.timing(logoOpacity, { toValue: 1, duration: DURATION * 0.6, useNativeDriver: true }),
      ]),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.iconContainer}>
      <Animated.View style={[styles.background, { transform: [{ scale }] }]} />
      <Animated.View style={[styles.imageContainer, { opacity: logoOpacity }]}>
        <Image style={styles.image} source={require('@/assets/images/expo-logo.png')} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  imageContainer: { justifyContent: 'center', alignItems: 'center' },
  iconContainer: { justifyContent: 'center', alignItems: 'center', width: 128, height: 128, zIndex: 100 },
  image: { position: 'absolute', width: 76, height: 71 },
  background: {
    borderRadius: 40,
    backgroundColor: '#0274DF',
    width: 128,
    height: 128,
    position: 'absolute',
  },
  backgroundSolidColor: { ...StyleSheet.absoluteFillObject, backgroundColor: '#208AEF', zIndex: 1000 },
});
