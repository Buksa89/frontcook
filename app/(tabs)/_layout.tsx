import React, { useState, useCallback, useRef } from 'react';
import { View, TouchableOpacity, Animated, TextInput, StyleSheet, Platform, Modal, Text, Pressable } from 'react-native';
import { Stack, useNavigation, useRouter, useSegments } from 'expo-router';
import { MaterialIcons, AntDesign, Entypo, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Zakładamy, że MainMenu i obsługa powiadomień będą potrzebne
// import { MainMenu } from '../../src/components/MainMenu'; // Dostosuj ścieżkę
// import useUnreadNotifications from '../../src/hooks/useUnreadNotifications'; // Przykładowy hook

// Prosty placeholder dla MainMenu
const MainMenu = ({ visible, onClose }: { visible: boolean, onClose: () => void }) => {
  if (!visible) return null;
  return (
    <Modal transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose}>
        <View style={{ position: 'absolute', top: 60, right: 10, backgroundColor: 'white', padding: 10, borderRadius: 5 }}>
          <Text>Menu Placeholder</Text>
          {/* TODO: Dodać opcje menu (Ustawienia, Wyloguj itp.) */}
        </View>
      </Pressable>
    </Modal>
  );
};

export default function StackLayout() {
  const navigation = useNavigation();
  const router = useRouter();
  const segments = useSegments(); // Pobierz segmenty aktualnej ścieżki
  const insets = useSafeAreaInsets(); // Pobierz bezpieczne obszary

  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const searchWidth = useRef(new Animated.Value(0)).current; // Animacja szerokości
  const [searchText, setSearchText] = useState('');
  // const { hasUnreadNotifications } = useUnreadNotifications(); // TODO: Podłączyć hook powiadomień

  // --- Logika Wyszukiwania ---
  const toggleSearch = useCallback(() => {
    const toValue = isSearchVisible ? 0 : 1;
    Animated.timing(searchWidth, {
      toValue,
      duration: 200, // Szybsza animacja
      useNativeDriver: false,
    }).start(() => {
       setIsSearchVisible(!isSearchVisible);
       if (isSearchVisible) { // Jeśli właśnie zamknęliśmy wyszukiwanie
           setSearchText('');
           // TODO: Wywołaj funkcję czyszczenia wyszukiwania w RecipeListScreen
           // (np. przez context lub event)
       }
    });
  }, [isSearchVisible, searchWidth]);

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    // TODO: Wywołaj funkcję wyszukiwania w RecipeListScreen
    // (np. przez context lub event)
  };

  // Sprawdź, czy bieżący ekran to główny ekran listy przepisów
  // Zakładamy, że ścieżka to '/(tabs)/recipes' lub samo 'recipes' wewnątrz tabs
  const isRecipeListScreen = segments.length > 0 && segments[segments.length - 1] === 'recipes';

  return (
    <>
      <Stack
        screenOptions={({ route }) => ({
          // --- Styl Nagłówka (Monochrome) ---
          headerStyle: {
            backgroundColor: '#ffffff', // Białe tło nagłówka
            elevation: 0, // Usuń cień na Androidzie
            shadowOpacity: 0, // Usuń cień na iOS
            borderBottomWidth: 1, // Delikatna linia separująca
            borderBottomColor: '#e2e8f0', // Kolor ramki
          },
          headerTitleStyle: {
            fontSize: 18, // Rozmiar tytułu
            fontWeight: '600',
            color: '#2d3748', // Kolor tekstu podstawowego
          },
          headerTitleAlign: 'center', // Wyśrodkuj tytuł
          headerTintColor: '#4a5568', // Kolor strzałki wstecz

          // --- Dynamiczny Nagłówek ---
          headerLeft: () => {
             // Pokaż strzałkę wstecz tylko jeśli można wrócić I nie jesteśmy na głównym ekranie (recipes)
             if (navigation.canGoBack() && route.name !== 'recipes') {
               return (
                 <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButtonLeft}>
                   <MaterialIcons name="arrow-back-ios" size={20} color="#4a5568" />
                 </TouchableOpacity>
               );
             }
             // Pokaż ikonę Home na głównym ekranie (recipes)
             if (route.name === 'recipes') {
                return (
                    <TouchableOpacity onPress={() => { /* TODO: Reset filtrów */ console.log("Home pressed"); }} style={styles.headerButtonLeft}>
                        <AntDesign name="home" size={22} color="#4a5568" />
                    </TouchableOpacity>
                )
             }
             return null; // Nie pokazuj niczego innego po lewej
          },
          headerRight: () => (
            <View style={styles.headerRightContainer}>
              {/* Pokaż ikonę szukaj tylko na liście przepisów */}
              {route.name === 'recipes' && !isSearchVisible && (
                 <TouchableOpacity onPress={toggleSearch} style={styles.headerButtonRight}>
                   <AntDesign name="search1" size={22} color="#4a5568" />
                 </TouchableOpacity>
              )}
              {/* Pokaż ikonę powiadomień (jeśli są nieprzeczytane) */}
              {/* TODO: Podłączyć hasUnreadNotifications */}
              {/* {hasUnreadNotifications && (
                 <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.headerButtonRight}>
                    <View>
                       <Ionicons name="notifications-outline" size={24} color="#4a5568" />
                       <View style={styles.notificationBadge} />
                    </View>
                 </TouchableOpacity>
              )} */}
              {/* Ikona menu kropek - zawsze widoczna */}
              <TouchableOpacity onPress={() => setIsMenuVisible(true)} style={styles.headerButtonRight}>
                <Entypo name="dots-three-vertical" size={20} color="#4a5568" />
              </TouchableOpacity>
            </View>
          ),
          // --- Dynamiczny Tytuł lub Wyszukiwarka ---
          headerTitle: () => {
            // Jeśli wyszukiwanie jest aktywne, pokaż TextInput
            if (isSearchVisible && route.name === 'recipes') {
              return (
                <Animated.View style={[styles.searchContainer, {
                  width: searchWidth.interpolate({
                    inputRange: [0, 1],
                    // Dostosuj szerokość do ekranu, zostawiając miejsce na przyciski
                    outputRange: [0, Platform.OS === 'web' ? 300 : '80%'] as any
                  })
                }]}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Szukaj przepisów..."
                    placeholderTextColor="#a0aec0"
                    value={searchText}
                    onChangeText={handleSearchChange}
                    autoFocus={true}
                    returnKeyType="search"
                  />
                   <TouchableOpacity onPress={toggleSearch} style={styles.searchClearButton}>
                     <MaterialIcons name="close" size={20} color="#a0aec0" />
                   </TouchableOpacity>
                </Animated.View>
              );
            }
            // W przeciwnym razie, użyj tytułu z opcji ekranu
            return null; // React Navigation użyje domyślnego tytułu z `options`
          },
        })}
      >
        {/* Definicje Ekranów */}
        <Stack.Screen
          name="recipes" // Nazwa pliku -> recipes.tsx
          options={{
            title: 'Przepisy',
          }}
        />
        <Stack.Screen
          name="shoppingList" // Nazwa pliku -> shoppingList.tsx
          options={{
            title: 'Lista Zakupów',
          }}
        />
        <Stack.Screen
          name="settings" // Nazwa pliku -> settings.tsx
          options={{
            title: 'Ustawienia',
          }}
        />
        {/* Dodaj inne ekrany tutaj */}
      </Stack>

      {/* Placeholder dla MainMenu */}
       <MainMenu visible={isMenuVisible} onClose={() => setIsMenuVisible(false)} />
    </>
  );
}

// --- Style dla Nagłówka ---
const styles = StyleSheet.create({
    headerButtonLeft: {
        marginLeft: 15, // Odstęp od lewej krawędzi
        padding: 5, // Obszar klikalny
    },
    headerRightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 10, // Odstęp od prawej krawędzi
    },
    headerButtonRight: {
        padding: 8, // Obszar klikalny
        marginLeft: 8, // Odstęp między ikonami
    },
    notificationBadge: {
        position: 'absolute', top: -2, right: -3, width: 8, height: 8,
        borderRadius: 4, backgroundColor: '#e53e3e', // Czerwony kolor badge
        borderWidth: 1, borderColor: '#fff', // Biała obwódka
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9', // Tło pola szukania
        borderRadius: 18, // Zaokrąglone rogi
        height: 36,
        overflow: 'hidden', // Ukryj nadmiarowy tekst
        // Szerokość jest kontrolowana przez Animated.View
    },
    searchInput: {
        flex: 1,
        paddingLeft: 12,
        paddingRight: 30, // Miejsce na przycisk czyszczenia
        fontSize: 15,
        color: '#2d3748',
        height: '100%',
    },
    searchClearButton: {
        position: 'absolute',
        right: 0,
        height: '100%',
        paddingHorizontal: 8,
        justifyContent: 'center',
    },
    // Kolory zdefiniowane dla czytelności, używane w kodzie
    secondaryTextColor: { color: '#718096' },
    placeholderColor: { color: '#a0aec0' },
    borderColor: { borderColor: '#e2e8f0' },
    dangerColor: { color: '#e53e3e' },
});