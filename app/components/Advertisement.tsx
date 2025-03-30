import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { withObservables } from '@nozbe/watermelondb/react';
import database from '../../database';
import AppData from '../../database/models/AppData';
import { DEBUG } from '../constants/env';
import { Observable } from 'rxjs';

// Lazy loading Google Mobile Ads to prevent errors in debug mode
let BannerAd, BannerAdSize, TestIds;
if (!DEBUG) {
  const GoogleMobileAds = require('react-native-google-mobile-ads');
  BannerAd = GoogleMobileAds.BannerAd;
  BannerAdSize = GoogleMobileAds.BannerAdSize;
  TestIds = GoogleMobileAds.TestIds;
}

const adUnitId = !DEBUG ? (Platform.OS === 'ios' ? TestIds?.BANNER || '' : TestIds?.BANNER || '') : '';

interface AdvertisementComponentProps {
  subscriptionStatus: { isActive: boolean, endDate: Date | null } | null;
}

const AdvertisementComponent = ({ subscriptionStatus }: AdvertisementComponentProps) => {
  const [isConnected, setIsConnected] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => 
      setIsConnected(state.isConnected !== null ? state.isConnected : true)
    );
    return () => unsubscribe();
  }, []);

  if (subscriptionStatus?.isActive) return null;

  return (
    <View style={styles.container}>
      {isConnected ? (
        DEBUG ? <Text style={styles.adText}>DebugAD</Text> : <Text style={styles.adText}>AD</Text>
      ) : (
        <Text style={styles.noInternetText}>No internet</Text>
      )}
    </View>
  );
};

const enhance = withObservables<{}, { subscriptionStatus: Observable<{ isActive: boolean, endDate: Date | null }> }>([], () => ({
  subscriptionStatus: AppData.observeSubscriptionStatus(database),
}));

export const Advertisement = enhance(AdvertisementComponent);

const styles = StyleSheet.create({
  container: {
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    height: 80,
    zIndex: 1,
    elevation: 1,
  },
  noInternetText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
  },
  adText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default Advertisement;
