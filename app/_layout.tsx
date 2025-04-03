import { Stack } from "expo-router/stack";
import { TouchableOpacity, Animated, TextInput, View, Dimensions, Text } from 'react-native';
import { AntDesign, Entypo, MaterialIcons, Ionicons } from '@expo/vector-icons';
import React, { useRef, useState, createContext, useEffect } from 'react';
import type { NativeStackNavigationOptions, NativeStackHeaderProps } from '@react-navigation/native-stack';
import type { ParamListBase } from '@react-navigation/native';
import { MainMenu } from './components/MainMenu';
import { AuthProvider } from './context/authContext';
import { router } from 'expo-router';
import { DEBUG } from './constants/env';
import Notification from '../database/models/Notification';
import database from '../database';
import { ToastComponent } from './components/Toast';
import UserSettings from '../database/models/UserSettings';
import AuthService from './services/auth/authService';

type RootStackParamList = {
  index: undefined;
  '(screens)/RecipeListScreen/RecipeListScreen': undefined;
  '(screens)/RecipeManagementScreen/RecipeManagementScreen': { recipeId?: string };
  '(screens)/RecipeDetailScreen/RecipeDetailScreen': { recipeId?: string };
  '(screens)/ShoppingListScreen/ShoppingListScreen': undefined;
  '(screens)/NotificationScreen/NotificationScreen': undefined;
  '(screens)/FriendsScreen/FriendsScreen': undefined;
  '(screens)/SettingsScreen/SettingsScreen': undefined;
  '(screens)/AuthScreen/AuthScreen': undefined;
  '(screens)/DebugScreen/DebugScreen': undefined;
};

type NavigationProps = NativeStackHeaderProps;

const SCREEN_WIDTH = Dimensions.get('window').width;

// Create context for reset function and search
type ResetFunction = () => void;
type SetResetFunction = (fn: ResetFunction) => void;
type SearchFunction = (text: string) => void;
type SetSearchFunction = (fn: SearchFunction) => void;

interface FiltersContextType {
  setResetFunction: SetResetFunction;
  setSearchFunction: SetSearchFunction;
}

export const ResetFiltersContext = createContext<FiltersContextType>({
  setResetFunction: () => {},
  setSearchFunction: () => {}
});

export default function RootLayout() {
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const searchWidth = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const searchOpacity = useRef(new Animated.Value(0)).current;
  const [resetFunction, setResetFunction] = useState<ResetFunction | null>(null);
  const [searchFunction, setSearchFunction] = useState<SearchFunction | null>(null);
  const [searchText, setSearchText] = useState('');
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  // Initialize UserSettings when the app starts
  useEffect(() => {
    const initUserSettings = async () => {
      try {
        // Check if user is logged in
        const activeUser = await AuthService.getActiveUser();
        if (activeUser) {
          console.log(`[App] Checking UserSettings for user: ${activeUser}`);
          // Use the getOrCreate method to ensure UserSettings exist
          await UserSettings.getOrCreate(database);
          console.log(`[App] UserSettings checked/created successfully`);
        }
      } catch (error) {
        console.error(`[App] Error initializing UserSettings:`, error);
      }
    };
    
    initUserSettings();
  }, []);

  // Add useEffect for monitoring unread notifications
  useEffect(() => {
    const subscription = Notification.observeUnread(database).subscribe(
      (notifications) => {
        setHasUnreadNotifications(notifications.length > 0);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSetResetFunction = (fn: ResetFunction) => {
    // console.log('Setting reset function');
    setResetFunction(() => fn);
  };

  const handleSetSearchFunction = (fn: SearchFunction) => {
    // console.log('Setting search function');
    setSearchFunction(() => fn);
  };

  const handleHomePress = () => {
    console.log('Home button pressed');
    if (resetFunction) {
      console.log('Executing reset function');
      resetFunction();
      setSearchText('');
    } else {
      console.log('Reset function is not set');
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (searchFunction) {
      searchFunction(text);
    }
  };

  const toggleSearch = () => {
    setIsSearchVisible(!isSearchVisible);
    if (!isSearchVisible) {
      setSearchText('');
      if (searchFunction) {
        searchFunction('');
      }
    }
    
    Animated.parallel([
      Animated.spring(searchWidth, {
        toValue: isSearchVisible ? 0 : 1,
        useNativeDriver: false,
        friction: 8,
      }),
      Animated.timing(headerOpacity, {
        toValue: isSearchVisible ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(searchOpacity, {
        toValue: isSearchVisible ? 0 : 1,
        duration: 200,
        useNativeDriver: false,
      })
    ]).start();
  };

  return (
    <>
      <AuthProvider>
        <ResetFiltersContext.Provider value={{ setResetFunction: handleSetResetFunction, setSearchFunction: handleSetSearchFunction }}>
          <Stack
            screenOptions={({ route }) => ({
              headerStyle: {
                backgroundColor: '#fff',
              },
              headerTitleStyle: {
                fontSize: 20,
                fontWeight: '600',
                color: '#333',
              },
              headerShadowVisible: false,
              headerBackTitleVisible: true,
              headerBackTitle: "Wróć",
              header: (route.name === 'index' || route.name === '(screens)/RecipeListScreen/RecipeListScreen') ? 
                (props: NavigationProps) => (
                <View style={{ 
                  height: 60,
                  backgroundColor: '#fff',
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingTop: 20,
                  justifyContent: 'space-between',
                  paddingHorizontal: 16,
                }}>
                  {/* Lewa strona - ikona home */}
                  <Animated.View style={{ opacity: headerOpacity }}>
                    <TouchableOpacity
                      onPress={handleHomePress}
                    >
                      <AntDesign name="home" size={24} color="#333" />
                    </TouchableOpacity>
                  </Animated.View>

                  {/* Środek - pole wyszukiwania */}
                  <Animated.View style={{ 
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 20,
                    bottom: 0,
                    opacity: searchOpacity,
                    paddingHorizontal: 16,
                    transform: [
                      {
                        translateX: searchWidth.interpolate({
                          inputRange: [0, 1],
                          outputRange: [SCREEN_WIDTH, 0]
                        })
                      }
                    ]
                  }}>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#f5f5f5',
                      borderRadius: 18,
                      height: 36,
                    }}>
                      <TouchableOpacity 
                        style={{ padding: 8 }}
                        onPress={toggleSearch}
                      >
                        <AntDesign name="arrowleft" size={20} color="#666" />
                      </TouchableOpacity>
                      <TextInput
                        style={{
                          flex: 1,
                          paddingRight: 16,
                        }}
                        placeholder="Szukaj..."
                        placeholderTextColor="#999"
                        autoFocus={true}
                        value={searchText}
                        onChangeText={handleSearchChange}
                      />
                    </View>
                  </Animated.View>

                  {/* Prawa strona - ikony search i menu */}
                  <Animated.View style={{ 
                    flexDirection: 'row',
                    opacity: headerOpacity 
                  }}>
                    <TouchableOpacity 
                      style={{ marginRight: 20 }}
                      onPress={toggleSearch}
                    >
                      <AntDesign name="search1" size={24} color="#333" />
                    </TouchableOpacity>
                    {DEBUG && (
                      <TouchableOpacity 
                        style={{ marginRight: 20 }}
                        onPress={() => router.push({
                          pathname: '/(screens)/DebugScreen/DebugScreen'
                        } as any)}
                      >
                        <MaterialIcons name="developer-mode" size={24} color="#333" />
                      </TouchableOpacity>
                    )}
                    {hasUnreadNotifications && (
                      <TouchableOpacity 
                        style={{ marginRight: 20 }}
                        onPress={() => router.push({
                          pathname: '/(screens)/NotificationScreen/NotificationScreen'
                        } as any)}
                      >
                        <View>
                          <Ionicons name="notifications-outline" size={24} color="#333" />
                          <View style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: 'red',
                          }} />
                        </View>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => setIsMenuVisible(true)}>
                      <Entypo name="dots-three-vertical" size={24} color="#333" />
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              ) : undefined
            })}
          >
            <Stack.Screen 
              name="index" 
              options={{ 
                headerTitle: "Przepisy",
                headerShadowVisible: false,
                headerStyle: {
                  backgroundColor: '#fff'
                },
                headerTitleStyle: {
                  fontSize: 20,
                  fontWeight: '600',
                  color: '#333'
                }
              }} 
            />
            <Stack.Screen 
              name="(screens)/RecipeListScreen/RecipeListScreen" 
              options={{ 
                headerTitle: "Przepisy",
                headerShadowVisible: false,
                headerStyle: {
                  backgroundColor: '#fff'
                },
                headerTitleStyle: {
                  fontSize: 20,
                  fontWeight: '600',
                  color: '#333'
                }
              }} 
            />
            <Stack.Screen 
              name="(screens)/RecipeManagementScreen/RecipeManagementScreen" 
              options={({ route }) => ({ 
                headerTitle: (route.params as { recipeId?: string })?.recipeId ? "Edytuj przepis" : "Nowy przepis",
                headerBackTitle: "Wróć",
                headerStyle: {
                  backgroundColor: '#fff'
                },
                headerTitleStyle: {
                  fontSize: 20,
                  fontWeight: '600',
                  color: '#333'
                },
                headerShadowVisible: false
              })} 
            />
            <Stack.Screen 
              name="(screens)/RecipeDetailScreen/RecipeDetailScreen" 
              options={{ 
                headerTitle: "",
                headerBackTitle: "Wróć",
                headerStyle: {
                  backgroundColor: '#fff'
                },
                headerTitleStyle: {
                  fontSize: 20,
                  fontWeight: '600',
                  color: '#333'
                },
                headerShadowVisible: false
              }} 
            />
            <Stack.Screen 
              name="(screens)/ShoppingListScreen/ShoppingListScreen" 
              options={{ 
                headerTitle: "Lista zakupów",
                headerBackTitle: "Wróć",
                headerStyle: {
                  backgroundColor: '#fff'
                },
                headerTitleStyle: {
                  fontSize: 20,
                  fontWeight: '600',
                  color: '#333'
                },
                headerShadowVisible: false
              }} 
            />
            <Stack.Screen 
              name="(screens)/NotificationScreen/NotificationScreen" 
              options={{ 
                headerTitle: "Powiadomienia",
                headerBackTitle: "Wróć",
                headerStyle: {
                  backgroundColor: '#fff'
                },
                headerTitleStyle: {
                  fontSize: 20,
                  fontWeight: '600',
                  color: '#333'
                },
                headerShadowVisible: false
              }} 
            />
            <Stack.Screen 
              name="(screens)/FriendsScreen/FriendsScreen" 
              options={{ 
                headerTitle: "Znajomi",
                headerBackTitle: "Wróć",
                headerStyle: {
                  backgroundColor: '#fff'
                },
                headerTitleStyle: {
                  fontSize: 20,
                  fontWeight: '600',
                  color: '#333'
                },
                headerShadowVisible: false
              }} 
            />
            <Stack.Screen 
              name="(screens)/SettingsScreen/SettingsScreen" 
              options={{ 
                headerTitle: "Ustawienia konta",
                headerBackTitle: "Wróć",
                headerStyle: {
                  backgroundColor: '#fff'
                },
                headerTitleStyle: {
                  fontSize: 20,
                  fontWeight: '600',
                  color: '#333'
                },
                headerShadowVisible: false
              }} 
            />
            <Stack.Screen 
              name="(screens)/AuthScreen/AuthScreen" 
              options={{ 
                headerTitle: "Logowanie",
                headerBackTitle: "Wróć",
                headerStyle: {
                  backgroundColor: '#fff'
                },
                headerTitleStyle: {
                  fontSize: 20,
                  fontWeight: '600',
                  color: '#333'
                },
                headerShadowVisible: false
              }} 
            />
            <Stack.Screen 
              name="(screens)/DebugScreen/DebugScreen" 
              options={{ 
                headerTitle: "Debug",
                headerBackTitle: "Wróć",
                headerStyle: {
                  backgroundColor: '#fff'
                },
                headerTitleStyle: {
                  fontSize: 20,
                  fontWeight: '600',
                  color: '#333'
                },
                headerShadowVisible: false
              }} 
            />
          </Stack>
          {isMenuVisible && <MainMenu 
            visible={isMenuVisible} 
            onClose={() => setIsMenuVisible(false)} 
          />}
        </ResetFiltersContext.Provider>
      </AuthProvider>
      <ToastComponent />
    </>
  );
}
