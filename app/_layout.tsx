import { Stack } from "expo-router";
import { TouchableOpacity, Animated, TextInput, View, Dimensions } from 'react-native';
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
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="add-recipe" 
        options={{ 
          headerTitle: "Nowy przepis",
          headerBackTitle: "Wróć"
        }} 
      />
    </Stack>
  );
}
