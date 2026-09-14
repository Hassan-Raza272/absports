import React, { useState } from 'react';
import { Image, StatusBar, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { DrawerActions, useNavigation, useRoute } from '@react-navigation/native';
import { Colors, Radius, Spacing, Typography } from '../theme';
import { useScopeLabels } from '../store';
import BackButton from './BackButton';
import PremiumIcon from './PremiumIcon';
import ScopePicker from './ScopePicker';
import { EaseEnter, EaseScreen, EaseView, fadeTransition } from '../motion';

const logo = require('../assets/logo.png');

type Props = {
  title: string;
  subtitle?: string;
  showScope?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
};

export default function ScreenScaffold({ title, subtitle, showScope = true, right, children }: Props) {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { width: screenWidth } = useWindowDimensions();
  const { tournamentName } = useScopeLabels();
  const [picker, setPicker] = useState(false);
  const inTabs = ['Home', 'Matches', 'Discover', 'More'].includes(route.name);
  const logoSize = Math.max(36, Math.min(48, Math.round(screenWidth * 0.11)));
  const titleSize = Math.max(16, Math.min(20, Math.round(screenWidth * 0.048)));

  function openMenu() {
    let nav: any = navigation;
    while (nav) {
      if (typeof nav.openDrawer === 'function') {
        nav.openDrawer();
        return;
      }
      const state = nav.getState?.();
      if (state?.type === 'drawer') {
        nav.dispatch(DrawerActions.openDrawer());
        return;
      }
      nav = nav.getParent?.();
    }
    if (navigation.canGoBack()) navigation.goBack();
  }

  return (
    <EaseScreen style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <EaseView
        initialAnimate={{ opacity: 0, translateY: -10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={fadeTransition}
        style={styles.header}>
        {inTabs ? (
          <TouchableOpacity
            onPress={openMenu}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <PremiumIcon name="menu" size={20} color={Colors.onPrimary} />
          </TouchableOpacity>
        ) : (
          <BackButton
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : openMenu())}
            iconOnly
            size={20}
            style={styles.iconBtn}
            hitSlop={8}
          />
        )}
        <Image
          source={logo}
          style={[styles.logo, { width: logoSize, height: logoSize, borderRadius: logoSize / 2 }]}
          resizeMode="contain"
        />
        <View style={[styles.brand, { minHeight: logoSize }]}>
          <Text style={[styles.title, { fontSize: titleSize, lineHeight: titleSize + 4 }]} numberOfLines={1}>
            {title}
          </Text>
          {showScope ? (
            <TouchableOpacity onPress={() => setPicker(true)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
              <Text style={styles.scope} numberOfLines={1}>
                {tournamentName} ▾
              </Text>
            </TouchableOpacity>
          ) : (
            !!subtitle && <Text style={styles.scope} numberOfLines={1}>{subtitle}</Text>
          )}
        </View>
        {right}
      </EaseView>
      <EaseEnter style={styles.body} from={{ opacity: 0, translateY: 16 }} to={{ opacity: 1, translateY: 0 }}>
        {children}
      </EaseEnter>
      <ScopePicker
        visible={picker}
        onClose={() => setPicker(false)}
        onManageTournaments={() => {
          setPicker(false);
          navigation.navigate('AdminTournaments');
        }}
      />
    </EaseScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  body: { flex: 1, overflow: 'visible' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingTop: 50,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.primary,
  },
  logo: { backgroundColor: 'rgba(255,255,255,0.12)' },
  brand: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  title: { color: Colors.onPrimary, fontWeight: '900' },
  scope: {
    color: Colors.onPrimary,
    fontSize: Typography.sm,
    fontWeight: '700',
    marginTop: 1,
    opacity: 0.95,
    lineHeight: 16,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
});
