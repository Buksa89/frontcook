import { Stack } from "expo-router";
import { TouchableOpacity, Animated, TextInput, View, Dimensions, Text } from 'react-native';
import { AntDesign, Entypo } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function RootLayout() {
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const searchWidth = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const searchOpacity = useRef(new Animated.Value(0)).current;

  const toggleSearch = () => {
    setIsSearchVisible(!isSearchVisible);
    
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
        header: route.name === 'index' ? ({ navigation, route, options }) => (
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
              <TouchableOpacity>
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
              <TouchableOpacity>
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
        name="add-recipe" 
        options={{ 
          headerTitle: "Nowy przepis",
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
        name="recipe-details" 
        options={{ 
          headerTitle: "Przepis",
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
        name="shopping-list" 
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
    </Stack>
  );
}
