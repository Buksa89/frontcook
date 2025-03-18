import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import database from '../../../database';
import Notification from '../../../database/models/Notification';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

type NotificationItem = {
  id: string;
  content: string;
  type: string;
  link: string | null;
  isReaded: boolean;
  lastUpdate: string | null;
  isNew?: boolean; // Local flag to track new notifications visually
};

export default function NotificationScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const navigation = useNavigation();

  // Obliczamy te wartości na podstawie aktualnego stanu powiadomień
  const hasReadNotifications = notifications.some(notification => notification.isReaded);

  // Load notifications and mark which ones are new (unread)
  useEffect(() => {
    const subscription = Notification.observeAll(database).subscribe(
      (notificationsList) => {
        const mappedNotifications = notificationsList.map((notification) => ({
          id: notification.id,
          content: notification.content,
          type: notification.type,
          link: notification.link,
          isReaded: notification.isReaded,
          lastUpdate: notification.lastUpdate,
          isNew: !notification.isReaded, // Mark as new if not read
        }));
        setNotifications(mappedNotifications);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Mark all notifications as read when LEAVING the screen
  useEffect(() => {
    // This cleanup function runs when the component unmounts (user leaves the screen)
    return () => {
      const markAllAsRead = async () => {
        try {
          await Notification.markAllAsRead(database);
        } catch (error) {
          console.error('Error marking all notifications as read:', error);
        }
      };
      
      markAllAsRead();
    };
  }, []);

  useEffect(() => {
    // Add delete button to navigation header
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRightContainer}>
          {hasReadNotifications && (
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={handleDeleteAllRead}
            >
              <MaterialIcons name="delete-sweep" size={24} color="#ff3b30" />
            </TouchableOpacity>
          )}
        </View>
      ),
    });
  }, [navigation, hasReadNotifications]);

  const handleDeleteAllRead = async () => {
    const readNotifications = notifications.filter(notification => notification.isReaded);
    if (readNotifications.length === 0) return;
    
    Alert.alert(
      "Usuń przeczytane",
      `Czy na pewno chcesz usunąć wszystkie przeczytane powiadomienia (${readNotifications.length})?`,
      [
        {
          text: "Anuluj",
          style: "cancel"
        },
        { 
          text: "Usuń", 
          onPress: async () => {
            try {
              await Notification.deleteAllRead(database);
              
              // Aktualizujemy lokalny stan, aby natychmiast usunąć przeczytane powiadomienia z listy
              setNotifications(prevNotifications => 
                prevNotifications.filter(item => !item.isReaded)
              );
            } catch (error) {
              console.error('Error deleting read notifications:', error);
              Alert.alert("Błąd", "Nie udało się usunąć przeczytanych powiadomień");
            }
          },
          style: "destructive"
        }
      ]
    );
  };

  const handleNotificationPress = async (notification: NotificationItem) => {
    try {
      // If notification has a link, navigate to that screen
      if (notification.link) {
        console.log(`Navigating to: ${notification.link}`);
      }

      // Mark as not new locally (visually)
      setNotifications(prevNotifications => 
        prevNotifications.map(item => 
          item.id === notification.id 
            ? { ...item, isNew: false } 
            : item
        )
      );
    } catch (error) {
      console.error('Error handling notification press:', error);
    }
  };

  const handleNotificationLongPress = (notification: NotificationItem) => {
    setSelectedNotification(notification);
    
    Alert.alert(
      "Opcje powiadomienia",
      notification.content,
      [
        {
          text: "Anuluj",
          style: "cancel"
        },
        { 
          text: "Usuń", 
          onPress: async () => {
            try {
              const notificationRecord = await database
                .get<Notification>('notifications')
                .find(notification.id);
              
              await notificationRecord.markAsDeleted();
              
              // Aktualizujemy lokalny stan, aby natychmiast usunąć powiadomienie z listy
              setNotifications(prevNotifications => 
                prevNotifications.filter(item => item.id !== notification.id)
              );
            } catch (error) {
              console.error('Error deleting notification:', error);
              Alert.alert("Błąd", "Nie udało się usunąć powiadomienia");
            }
          },
          style: "destructive"
        }
      ]
    );
  };

  const renderNotificationItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        item.isNew && styles.notificationItemNew
      ]}
      onPress={() => handleNotificationPress(item)}
      onLongPress={() => handleNotificationLongPress(item)}
    >
      <View style={styles.notificationIcon}>
        <MaterialIcons
          name={item.type === 'warn' ? 'warning' : 'info'}
          size={24}
          color={item.type === 'warn' ? '#ff9500' : '#007aff'}
        />
      </View>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationText}>{item.content}</Text>
        {item.lastUpdate && (
          <Text style={styles.notificationDate}>
            {new Date(item.lastUpdate).toLocaleString()}
          </Text>
        )}
      </View>
      {item.isNew && <View style={styles.newIndicator} />}
    </TouchableOpacity>
  );

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="notifications-none" size={80} color="#ccc" style={styles.icon} />
      <Text style={styles.emptyTitle}>Brak powiadomień</Text>
      <Text style={styles.emptySubtitle}>Nie masz żadnych powiadomień</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007aff" />
        <Text style={styles.loadingText}>Ładowanie powiadomień...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyComponent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    padding: 8,
    marginLeft: 8,
  },
  listContainer: {
    flexGrow: 1,
    paddingVertical: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationItemNew: {
    backgroundColor: '#f0f7ff',
  },
  notificationIcon: {
    marginRight: 16,
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  notificationDate: {
    fontSize: 12,
    color: '#999',
  },
  newIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007aff',
    alignSelf: 'center',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  icon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
}); 