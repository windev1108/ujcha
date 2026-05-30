import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Package, Wallet, Navigation, User } from '@/components/icons';

const FOREST = '#1a3c34';
const MUTED = '#b0b0b0';

function TabIcon({ Icon, active }: { Icon: React.ElementType; active: boolean }) {
  return (
    <View style={{
      width: 36, height: 28, borderRadius: 10,
      backgroundColor: active ? 'rgba(26,60,52,0.1)' : 'transparent',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={20} color={active ? FOREST : MUTED} />
    </View>
  );
}

export default function ShipperLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: FOREST,
        tabBarInactiveTintColor: MUTED,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: 'rgba(26,26,26,0.07)',
          height: 68,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Đơn hàng',
          tabBarIcon: ({ focused }) => <TabIcon Icon={Package} active={focused} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Thu nhập',
          tabBarIcon: ({ focused }) => <TabIcon Icon={Wallet} active={focused} />,
        }}
      />
      <Tabs.Screen
        name="delivery/[id]"
        options={{
          title: 'Đang giao',
          tabBarIcon: ({ focused }) => <TabIcon Icon={Navigation} active={focused} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Tài khoản',
          tabBarIcon: ({ focused }) => <TabIcon Icon={User} active={focused} />,
        }}
      />
    </Tabs>
  );
}
