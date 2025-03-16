import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import database from '../../../database';
import Notification from '../../../database/models/Notification';
import { useNavigation } from '@react-navigation/native';

type NotificationItem = {
  id: string;
  content: string;
  type: string;
  link: string | null;
  isReaded: boolean;
  lastUpdate: string | null;
};

export default function NotificationScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

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
        }));
        setNotifications(mappedNotifications);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleMarkAllAsRead = async () => {
    if (notifications.length === 0) return;
    
    try {
      await Notification.markAllAsRead(database);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleNotificationPress = async (notification: NotificationItem) => {
    try {
      // Znajdź i oznacz powiadomienie jako przeczytane
      const notificationRecord = await database
        .get<Notification>('notifications')
        .find(notification.id);
      
      if (!notification.isReaded) {
        await notificationRecord.markAsRead();
      }
      
      // Jeśli jest link, nawiguj do odpowiedniego ekranu
      if (notification.link) {
        // Tutaj można dodać logikę nawigacji na podstawie linku
        console.log(`Navigating to: ${notification.link}`);
      }
    } catch (error) {
      console.error('Error handling notification press:', error);
    }
  };

  const renderNotificationItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !item.isReaded && styles.notificationItemUnread
      ]}
      onPress={() => handleNotificationPress(item)}
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
      {!item.isReaded && <View style={styles.unreadIndicator} />}
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
      <View style={styles.header}>
        <Text style={styles.title}>Powiadomienia</Text>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllButton}>
            <Text style={styles.markAllButtonText}>Oznacz wszystkie jako przeczytane</Text>
          </TouchableOpacity>
        )}
      </View>
      
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  markAllButton: {
    padding: 8,
  },
  markAllButtonText: {
    color: '#007aff',
    fontSize: 14,
    fontWeight: '500',
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
  notificationItemUnread: {
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
  unreadIndicator: {
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