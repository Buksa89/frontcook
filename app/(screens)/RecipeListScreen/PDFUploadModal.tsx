import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { pdfUploadApi } from '../../api/pdfUpload';

interface PDFUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onPDFSuccess?: (taskId: string) => void;
}

export const PDFUploadModal = ({ visible, onClose, onPDFSuccess }: PDFUploadModalProps) => {
  const [pdfDocument, setPdfDocument] = useState<DocumentPicker.DocumentPickerResult | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Function to pick a PDF document
  const pickDocument = async () => {
    // Reset states
    setError('');
    
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      
      if (!result.canceled) {
        // Check if it's a valid PDF file
        const fileType = result.assets[0].mimeType;
        if (fileType !== 'application/pdf') {
          setError('Wybrany plik nie jest dokumentem PDF. Wybierz plik PDF.');
          return;
        }
        
        // Check if file size is too large (20MB limit)
        const fileSize = result.assets[0].size || 0;
        if (fileSize > 20 * 1024 * 1024) {
          setError('Wybrany plik jest zbyt duży. Maksymalny rozmiar to 20MB.');
          return;
        }
        
        setPdfDocument(result);
        console.log('Selected PDF document:', result.assets[0].name);
      }
    } catch (err) {
      console.error('Error picking document:', err);
      setError('Wystąpił błąd podczas wybierania dokumentu. Spróbuj ponownie.');
    }
  };

  // Function to upload the PDF document
  const handleUpload = async () => {
    if (!pdfDocument || pdfDocument.canceled) {
      setError('Najpierw wybierz plik PDF');
      return;
    }

    // Reset states
    setError('');
    setSuccessMessage('');
    
    // Start loading
    setIsLoading(true);
    
    try {
      // Get file URI from the document picker result
      const fileUri = pdfDocument.assets[0].uri;
      const fileName = pdfDocument.assets[0].name || 'document.pdf';
      
      console.log('Uploading PDF document:', {
        uri: fileUri,
        name: fileName,
        size: pdfDocument.assets[0].size,
        type: pdfDocument.assets[0].mimeType
      });
      
      // Call API to upload PDF
      const response = await pdfUploadApi.uploadPDF(fileUri, fileName);
      
      // Handle success
      setSuccessMessage('Super! Zaczęliśmy analizować przepis z PDF. Damy Ci znać, gdy będzie gotowy!');
      
      // Call success callback if provided
      if (onPDFSuccess && response.task_id) {
        onPDFSuccess(response.task_id);
      }
      
      // Reset form and close modal after a delay
      setTimeout(() => {
        setPdfDocument(null);
        setSuccessMessage('');
        onClose();
      }, 2000);
      
    } catch (err: any) {
      // Handle API error
      if (err.status === 401) {
        setError('Hej, musisz się najpierw zalogować, żeby dodać przepis');
      } else if (err.data && err.data.error) {
        setError(err.data.error);
      } else if (err.data && err.data.errors && err.data.errors.pdf_file) {
        setError(`Błąd pliku: ${err.data.errors.pdf_file.join(', ')}`);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Coś poszło nie tak. Może spróbuj ponownie za chwilę?');
      }
      console.error('PDF upload error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to clear selected PDF
  const clearSelectedPDF = () => {
    setPdfDocument(null);
    setError('');
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable 
        style={styles.modalOverlay}
        onPress={onClose}
      >
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.title}>Dodaj przepis z PDF</Text>
            <TouchableOpacity onPress={onClose} disabled={isLoading}>
              <MaterialIcons name="close" size={24} color={isLoading ? "#ccc" : "#666"} />
            </TouchableOpacity>
          </View>

          {pdfDocument && !pdfDocument.canceled ? (
            <View style={styles.fileContainer}>
              <View style={styles.fileInfo}>
                <MaterialIcons name="picture-as-pdf" size={24} color="#e53935" style={styles.fileIcon} />
                <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
                  {pdfDocument.assets[0].name || 'document.pdf'}
                </Text>
                {pdfDocument.assets[0].size && (
                  <Text style={styles.fileSize}>
                    {(pdfDocument.assets[0].size / 1024 / 1024).toFixed(2)} MB
                  </Text>
                )}
              </View>
              <TouchableOpacity 
                style={styles.removeFileButton}
                onPress={clearSelectedPDF}
                disabled={isLoading}
              >
                <MaterialIcons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.selectButton}
              onPress={pickDocument}
              disabled={isLoading}
            >
              <MaterialIcons name="file-upload" size={32} color="#2196F3" style={styles.buttonIcon} />
              <Text style={styles.buttonLabel}>Wybierz plik PDF</Text>
            </TouchableOpacity>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

          {pdfDocument && !pdfDocument.canceled && (
            <TouchableOpacity 
              style={[styles.uploadButton, isLoading ? styles.uploadButtonDisabled : null]}
              onPress={handleUpload}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="cloud-upload" size={20} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.uploadButtonText}>Wyślij</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.infoContainer}>
            <MaterialIcons name="info-outline" size={16} color="#666" />
            <Text style={styles.infoText}>
              Obsługujemy pliki PDF zawierające przepisy kulinarne. Analiza może potrwać kilka minut.
              Maksymalny rozmiar pliku to 20MB.
            </Text>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  selectButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  buttonIcon: {
    marginBottom: 8,
  },
  buttonLabel: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileIcon: {
    marginRight: 12,
  },
  fileName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  fileSize: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  removeFileButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    padding: 6,
    marginLeft: 8,
  },
  uploadButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    marginTop: 8,
    minHeight: 48,
  },
  uploadButtonDisabled: {
    backgroundColor: '#a0d0f7',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  successText: {
    color: '#28a745',
    fontSize: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  }
}); 