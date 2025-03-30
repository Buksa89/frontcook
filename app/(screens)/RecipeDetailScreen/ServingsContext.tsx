import React, { createContext, useState, useContext, ReactNode } from 'react';

interface ServingsContextType {
  scaleFactor: number;
  setScaleFactor: (factor: number) => void;
  originalServings: number | null;
  setOriginalServings: (servings: number | null) => void;
  currentServings: number;
  setCurrentServings: (servings: number) => void;
}

const ServingsContext = createContext<ServingsContextType | undefined>(undefined);

interface ServingsProviderProps {
  children: ReactNode;
}

export const ServingsProvider: React.FC<ServingsProviderProps> = ({ children }) => {
  const [scaleFactor, setScaleFactor] = useState<number>(1);
  const [originalServings, setOriginalServings] = useState<number | null>(null);
  const [currentServings, setCurrentServings] = useState<number>(1);

  return (
    <ServingsContext.Provider 
      value={{ 
        scaleFactor, 
        setScaleFactor, 
        originalServings, 
        setOriginalServings,
        currentServings,
        setCurrentServings
      }}
    >
      {children}
    </ServingsContext.Provider>
  );
};

export const useServings = (): ServingsContextType => {
  const context = useContext(ServingsContext);
  if (context === undefined) {
    throw new Error('useServings must be used within a ServingsProvider');
  }
  return context;
};

// Add default export for Expo Router compatibility
export default ServingsProvider; 