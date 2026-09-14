import React from 'react';
import { Linking, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Spacing, Typography } from '../../theme';
import BackButton from '../../components/BackButton';
import { YouTubeVideoGrid } from '../../components/YouTubeChannelVideos';
import { YOUTUBE_CHANNEL } from '../../constants/youtube';

export default function ChannelVideosScreen({ navigation }: any) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <LinearGradient colors={Colors.gradHeader} style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} iconOnly size={20} style={styles.backBtn} hitSlop={10} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>Cricket videos</Text>
          <Text style={styles.sub} numberOfLines={1}>{YOUTUBE_CHANNEL.handle}</Text>
        </View>
        <TouchableOpacity onPress={() => Linking.openURL(YOUTUBE_CHANNEL.videosUrl)} hitSlop={10}>
          <Text style={styles.open}>YouTube</Text>
        </TouchableOpacity>
      </LinearGradient>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <YouTubeVideoGrid limit={150} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingTop: 50,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: Colors.onPrimary, fontWeight: '900', fontSize: Typography.lg },
  sub: { color: 'rgba(255,255,255,0.8)', fontWeight: '600', fontSize: Typography.xs, marginTop: 2 },
  open: { color: Colors.onPrimary, fontWeight: '800', fontSize: Typography.sm },
  body: { padding: Spacing.base, paddingBottom: 40 },
});
