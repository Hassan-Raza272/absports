import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography } from '../theme';
import PremiumIcon, { PremiumIconName } from '../components/PremiumIcon';
import HomeScreen from '../screens/home';
import FixturesScreen from '../screens/fixtures';
import DiscoverScreen from '../screens/discover';
import MoreScreen from '../screens/more';

const Tab = createBottomTabNavigator();

const TABS: { name: string; label: string; icon: PremiumIconName; component: React.ComponentType<any> }[] = [
  { name: 'Home', label: 'Home', icon: 'home', component: HomeScreen },
  { name: 'Matches', label: 'Matches', icon: 'fixtures', component: FixturesScreen },
  { name: 'Discover', label: 'Discover', icon: 'explore', component: DiscoverScreen },
  { name: 'More', label: 'More', icon: 'more', component: MoreScreen },
];

const TAB_CONTENT_HEIGHT = 56;

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.bgCard,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: TAB_CONTENT_HEIGHT + bottomInset,
          paddingTop: 6,
          paddingBottom: bottomInset,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: styles.label,
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: Colors.bg },
      }}>
      {TABS.map(tab => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            tabBarLabel: tab.label,
            tabBarIcon: ({ color, size }) => <PremiumIcon name={tab.icon} size={size} color={color} />,
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
    fontFamily: Typography.fontBold,
  },
});
