import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import { useServings } from './ServingsContext';
import { calculateScaleFactor } from '../../../app/utils/scaling';
import { AddShopingItemMenu } from '../../../app/components/AddShopingItemMenu';
import Ingredient from '../../../database/models/Ingredient';

interface ServingsAdjusterProps {
  originalServings: number | null;
  ingredients: Ingredient[];
  recipeName: string;
}

export const ServingsAdjuster: React.FC<ServingsAdjusterProps> = ({ 
  originalServings,
  ingredients,
  recipeName
}) => {
  const { 
    setScaleFactor, 
    setOriginalServings, 
    currentServings, 
    setCurrentServings 
  } = useServings();
  
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    if (originalServings !== null) {
      setOriginalServings(originalServings);
      setCurrentServings(originalServings);
    }
  }, [originalServings, setOriginalServings, setCurrentServings]);

  const handleDecrease = () => {
    if (currentServings > 1) {
      const newServings = currentServings - 1;
      setCurrentServings(newServings);
      
      const newScaleFactor = calculateScaleFactor(originalServings, newServings);
      setScaleFactor(newScaleFactor);
    }
  };

  const handleIncrease = () => {
    const newServings = currentServings + 1;
    setCurrentServings(newServings);
    
    const newScaleFactor = calculateScaleFactor(originalServings, newServings);
    setScaleFactor(newScaleFactor);
  };
  
  const openAddShopingItemMenu = () => {
    setMenuVisible(true);
  };
  
  const closeAddShopingItemMenu = () => {
    setMenuVisible(false);
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.leftSection}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="people" size={24} color="#666" />
          </View>
          <Text style={styles.label}>Porcje:</Text>
        </View>
        
        <View style={styles.rightSection}>
          <View style={styles.adjustContainer}>
            <TouchableOpacity
              style={[styles.button, currentServings <= 1 && styles.buttonDisabled]}
              onPress={handleDecrease}
              disabled={currentServings <= 1}
            >
              <AntDesign 
                name="minus" 
                size={16} 
                color={currentServings <= 1 ? '#ccc' : '#2196F3'} 
              />
            </TouchableOpacity>
            
            <Text style={styles.servingsText}>{currentServings}</Text>
            
            <TouchableOpacity
              style={styles.button}
              onPress={handleIncrease}
            >
              <AntDesign name="plus" size={16} color="#2196F3" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={styles.cartIconContainer}
            onPress={openAddShopingItemMenu}
          >
            <AntDesign name="shoppingcart" size={30} color="#2196F3" />
          </TouchableOpacity>
        </View>
      </View>
      
      <AddShopingItemMenu 
        visible={menuVisible}
        onClose={closeAddShopingItemMenu}
        ingredients={ingredients}
        recipeName={recipeName}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 16,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 8,
  },
  label: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  adjustContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#f0f0f0',
  },
  servingsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 12,
    minWidth: 24,
    textAlign: 'center',
  },
  cartIconContainer: {
    marginLeft: 16,
  },
}); 