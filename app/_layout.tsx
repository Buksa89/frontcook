import { Stack } from "expo-router";
import { TouchableOpacity, Animated, TextInput, View, Dimensions, Text } from 'react-native';
import { AntDesign, Entypo } from '@expo/vector-icons';
import React, { useRef, useState, createContext } from 'react';

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
  const searchWidth = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const searchOpacity = useRef(new Animated.Value(0)).current;
  const [resetFunction, setResetFunction] = useState<ResetFunction | null>(null);
  const [searchFunction, setSearchFunction] = useState<SearchFunction | null>(null);
  const [searchText, setSearchText] = useState('');

  const handleSetResetFunction = (fn: ResetFunction) => {
    console.log('Setting reset function');
    setResetFunction(() => fn);
  };

  const handleSetSearchFunction = (fn: SearchFunction) => {
    console.log('Setting search function');
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
    <ResetFiltersContext.Provider value={{
      setResetFunction: handleSetResetFunction,
      setSearchFunction: handleSetSearchFunction
    }}>
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
          options={({ route }) => ({ 
            headerTitle: route.params?.recipeId ? "Edytuj przepis" : "Nowy przepis",
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
    </ResetFiltersContext.Provider>
  );
}
