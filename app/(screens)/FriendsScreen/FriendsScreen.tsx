import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ScrollView, Image } from 'react-native';
import { FontAwesome5, AntDesign, Ionicons } from '@expo/vector-icons';

// Hardcoded data for the friends screen
const PENDING_REQUESTS = [
  { id: '1', name: 'Tomasz Nowak', email: 'tomasz.nowak@example.com', avatar: null },
  { id: '2', name: 'Anna Kowalska', email: 'anna.kowalska@example.com', avatar: null },
];

const FRIENDS_LIST = [
  { id: '1', name: 'Jan Kowalski', email: 'jan.kowalski@example.com', avatar: null },
  { id: '2', name: 'Marta Wiśniewska', email: 'marta.wisniewska@example.com', avatar: null },
  { id: '3', name: 'Piotr Zieliński', email: 'piotr.zielinski@example.com', avatar: null },
  { id: '4', name: 'Karolina Dąbrowska', email: 'karolina.dabrowska@example.com', avatar: null },
];

export default function FriendsScreen() {
  const [email, setEmail] = useState('');

  const handleSendRequest = () => {
    // This would send a friend request in a real implementation
    console.log(`Sending friend request to: ${email}`);
    setEmail('');
    // Show success message or feedback
  };

  const handleAcceptRequest = (id: string) => {
    console.log(`Accepting friend request from user with id: ${id}`);
    // This would accept the request in a real implementation
  };

  const handleRejectRequest = (id: string) => {
    console.log(`Rejecting friend request from user with id: ${id}`);
    // This would reject the request in a real implementation
  };

  const renderPendingRequestItem = ({ item }: { item: typeof PENDING_REQUESTS[0] }) => (
    <View style={styles.requestItem}>
      <View style={styles.userInfo}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
          </View>
        )}
        <View style={styles.userTextInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.acceptButton]} 
          onPress={() => handleAcceptRequest(item.id)}
        >
          <AntDesign name="check" size={16} color="white" />
          <Text style={styles.acceptButtonText}>Akceptuj</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.rejectButton]} 
          onPress={() => handleRejectRequest(item.id)}
        >
          <AntDesign name="close" size={16} color="white" />
          <Text style={styles.rejectButtonText}>Odrzuć</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFriendItem = ({ item }: { item: typeof FRIENDS_LIST[0] }) => (
    <View style={styles.friendItem}>
      {item.avatar ? (
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
        </View>
      )}
      <View style={styles.friendTextInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
      </View>
      <TouchableOpacity
        style={styles.stalkButton}
        onPress={() => console.log(`Stalking user with id: ${item.id}`)}
      >
        <FontAwesome5 name="user-secret" size={18} color="#666" />
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Friend request email input */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dodaj znajomego</Text>
        <Text style={styles.sectionDescription}>
          Wpisz adres email osoby, którą chcesz dodać do znajomych
        </Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity 
            style={styles.sendButton}
            onPress={handleSendRequest}
            disabled={!email.includes('@')}
          >
            <Text style={styles.sendButtonText}>Wyślij</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pending requests section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Oczekujące zaproszenia</Text>
        {PENDING_REQUESTS.length > 0 ? (
          <>
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color="#5c7ba9" />
              <Text style={styles.infoText}>
                Dodani znajomi będą mogli przeglądać Twoje przepisy!
              </Text>
            </View>
            <FlatList
              data={PENDING_REQUESTS}
              renderItem={renderPendingRequestItem}
              keyExtractor={item => item.id}
              scrollEnabled={false}
            />
          </>
        ) : (
          <Text style={styles.emptyStateText}>Brak oczekujących zaproszeń</Text>
        )}
      </View>

      {/* Friends list section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Twoi znajomi</Text>
        {FRIENDS_LIST.length > 0 ? (
          <FlatList
            data={FRIENDS_LIST}
            renderItem={renderFriendItem}
            keyExtractor={item => item.id}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.emptyStateContainer}>
            <FontAwesome5 name="user-friends" size={40} color="#ccc" />
            <Text style={styles.emptyStateText}>Nie masz jeszcze znajomych</Text>
            <Text style={styles.emptyStateSubtext}>
              Dodaj znajomych, aby móc dzielić się przepisami
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: '#5c7ba9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  sendButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  requestItem: {
    flexDirection: 'column',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  userTextInfo: {
    marginLeft: 12,
    flex: 1,
  },
  friendTextInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  stalkButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
  acceptButton: {
    backgroundColor: '#5c7ba9',
  },
  rejectButton: {
    backgroundColor: '#c25559',
  },
  acceptButtonText: {
    color: 'white',
    fontWeight: '500',
    marginLeft: 4,
  },
  rejectButtonText: {
    color: 'white',
    fontWeight: '500',
    marginLeft: 4,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#5c7ba9',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#444',
    marginLeft: 8,
    lineHeight: 20,
  },
}); 