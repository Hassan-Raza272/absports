import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Colors } from '../theme';
import MainTabs from './MainTabs';
import AccountDrawer from './AccountDrawer';

import TeamsScreen from '../screens/teams';
import TeamProfileScreen from '../screens/teamProfile';
import PlayersScreen from '../screens/players';
import PlayerProfileScreen from '../screens/playerProfile';
import MatchCenterScreen from '../screens/matchCenter';
import StatisticsScreen from '../screens/statistics';
import AdminDashboardScreen from '../screens/admin/dashboard';
import AdminUsersScreen from '../screens/admin/users';
import AdminLiveScoringScreen from '../screens/admin/liveScoring';
import AdminBroadcastScreen from '../screens/admin/broadcast';
import AdminTeamsScreen from '../screens/admin/teams';
import AdminPlayersScreen from '../screens/admin/players';
import AdminFixturesScreen from '../screens/admin/fixtures';
import AdminTournamentsScreen from '../screens/admin/tournaments';
import AdminTournamentDetailScreen from '../screens/admin/tournamentDetail';
import CreateTournamentScreen from '../screens/admin/createTournament';
import CreateMatchScreen from '../screens/admin/createMatch';
import AdminQuickMatchScreen from '../screens/admin/quickMatch';
import PlayerCompareScreen from '../screens/compare/players';
import TeamCompareScreen from '../screens/compare/teams';
import WhatIfScreen from '../screens/whatIf';
import LoginScreen from '../screens/auth/login';
import SignupScreen from '../screens/auth/signup';
import AccountProfileScreen from '../screens/account/profile';
import MyMatchesScreen from '../screens/account/myMatches';
import MyTournamentsScreen from '../screens/account/myTournaments';
import MyTeamsScreen from '../screens/account/myTeams';
import ChannelVideosScreen from '../screens/youtubeVideos';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

function MainDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={props => <AccountDrawer {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: { width: 300, backgroundColor: Colors.bg },
        overlayColor: Colors.overlay,
        swipeEdgeWidth: 48,
      }}>
      <Drawer.Screen name="Tabs" component={MainTabs} />
    </Drawer.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Main" component={MainDrawer} />
      <Stack.Screen name="MyMatches" component={MyMatchesScreen} />
      <Stack.Screen name="MyTournaments" component={MyTournamentsScreen} />
      <Stack.Screen name="AccountProfile" component={AccountProfileScreen} />
      <Stack.Screen name="MyTeams" component={MyTeamsScreen} />
      <Stack.Screen name="ChannelVideos" component={ChannelVideosScreen} />
      <Stack.Screen name="TeamsList" component={TeamsScreen} />
      <Stack.Screen name="PlayersList" component={PlayersScreen} />
      <Stack.Screen name="StatsList" component={StatisticsScreen} />
      <Stack.Screen name="TeamProfile" component={TeamProfileScreen} />
      <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} />
      <Stack.Screen name="PlayerCompare" component={PlayerCompareScreen} />
      <Stack.Screen name="TeamCompare" component={TeamCompareScreen} />
      <Stack.Screen name="WhatIf" component={WhatIfScreen} />
      <Stack.Screen name="MatchCenter" component={MatchCenterScreen} />
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
      <Stack.Screen name="AdminTournaments" component={AdminTournamentsScreen} />
      <Stack.Screen name="CreateTournament" component={CreateTournamentScreen} />
      <Stack.Screen name="CreateMatch" component={CreateMatchScreen} />
      <Stack.Screen name="AdminTournamentDetail" component={AdminTournamentDetailScreen} />
      <Stack.Screen name="AdminLiveScoring" component={AdminLiveScoringScreen} />
      <Stack.Screen
        name="AdminBroadcast"
        component={AdminBroadcastScreen}
        options={{ orientation: 'landscape', animation: 'fade' }}
      />
      <Stack.Screen name="AdminTeams" component={AdminTeamsScreen} />
      <Stack.Screen name="AdminPlayers" component={AdminPlayersScreen} />
      <Stack.Screen name="AdminFixtures" component={AdminFixturesScreen} />
      <Stack.Screen name="AdminQuickMatch" component={AdminQuickMatchScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}
