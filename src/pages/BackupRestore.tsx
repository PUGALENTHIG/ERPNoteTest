import React, { useState, useRef } from 'react';
import { 
  Download, 
  Upload, 
  Database, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  RefreshCw,
  HardDrive,
  Cloud,
  Archive,
  FileText,
  Users,
  Clock,
  DollarSign,
  Calendar,
  Building2,
  Settings,
  UserCheck,
  Loader2,
  Info,
  RotateCcw
} from 'lucide-react';
import { getDocuments } from '../services/firestore';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyDicQksIDusUdMK7k2fIt2cvxyCY8yZg3c',
  authDomain: 'erpv02.firebaseapp.com',
  projectId: 'erpv02',
  storageBucket: 'erpv02.appspot.com',
  messagingSenderId: '453487579197',
  appId: '1:453487579197:web:255e8fb9745dc61e7c9a54',
  measurementId: 'G-VP7GPT0J7J',
};

interface BackupData {
  metadata: {
    exportDate: string;
    version: string;
    collections: string[];
    totalDocuments: number;
    appName: string;
  };
  data: Record<string, any[]>;
}

const BackupRestore: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [backupData, setBackupData] = useState<BackupData | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isConfirmationValid, setIsConfirmationValid] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [currentOperation, setCurrentOperation] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // All collections to backup
  const collections = [
    { name: 'employees', icon: Users, description: 'Employee records and personal information' },
    { name: 'attendance', icon: Clock, description: 'Daily attendance records' },
    { name: 'allowances', icon: DollarSign, description: 'Allowance and advance payments' },
    { name: 'companies', icon: Building2, description: 'Company master data' },
    { name: 'units', icon: Building2, description: 'Unit master data' },
    { name: 'groups', icon: Users, description: 'Group master data' },
    { name: 'shifts', icon: Clock, description: 'Shift configurations' },
    { name: 'holidays', icon: Calendar, description: 'Holiday calendar' },
    { name: 'shiftAssignments', icon: UserCheck, description: 'Weekly shift assignments' },
    { name: 'users', icon: Shield, description: 'User accounts and permissions' }
  ];

  // Confirmation Input Component
  const ConfirmationInput = () => {
    const [confirmText, setConfirmText] = useState('');
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setConfirmText(value);
      setIsConfirmationValid(value === 'CONFIRM');
    };
    
    return (
      <input
        type="text"
        value={confirmText}
        onChange={handleChange}
        placeholder="Type CONFIRM to proceed"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
        autoComplete="off"
      />
    );
  };

  // Initialize Firebase
  const initializeFirebase = () => {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    return { db, collection, getDocs, doc, setDoc, writeBatch };
  };

  // Helper function to implement exponential backoff for Firebase operations
  const executeWithBackoff = async (operation: () => Promise<any>, maxRetries = 3) => {
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        return await operation();
      } catch (error: any) {
        if (error?.code === 'resource-exhausted' && retries < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, retries), 10000); // Exponential backoff, max 10s
          console.log(`Firebase quota exceeded, retrying in ${delay}ms...`);
          setStatus(`⏳ Rate limited, waiting ${delay/1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retries++;
        } else {
          throw error;
        }
      }
    }
  };

  // Create complete backup
  const createBackup = async () => {
    setIsProcessing(true);
    setStatus('Initializing backup process...');
    
    try {
      const allData: Record<string, any[]> = {};
      const foundCollections: string[] = [];
      let totalDocuments = 0;

      setStatus('Fetching data from collections...');

      // Fetch data from each collection
      for (const collectionInfo of collections) {
        try {
          setStatus(`Fetching ${collectionInfo.name}...`);
          const documents = await getDocuments(collectionInfo.name);
          
          if (documents.length > 0) {
            // Convert dates to ISO strings for JSON serialization
            const serializedDocuments = documents.map(doc => ({
              ...doc,
              createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
              date: doc.date instanceof Date ? doc.date.toISOString() : doc.date,
              dob: doc.dob instanceof Date ? doc.dob.toISOString() : doc.dob,
              dateOfJoining: doc.dateOfJoining instanceof Date ? doc.dateOfJoining.toISOString() : doc.dateOfJoining,
              weekStartDate: doc.weekStartDate instanceof Date ? doc.weekStartDate.toISOString() : doc.weekStartDate,
              weekEndDate: doc.weekEndDate instanceof Date ? doc.weekEndDate.toISOString() : doc.weekEndDate
            }));
            
            allData[collectionInfo.name] = serializedDocuments;
            foundCollections.push(collectionInfo.name);
            totalDocuments += documents.length;
          }
        } catch (error) {
            // Store documents in exact JSON format without any modifications
            allData[collectionName] = documents.map(doc => {
              // Keep the document exactly as it is, including all fields and data types
              const docData = { ...doc };
              
              // Convert Firestore Timestamps to ISO strings for JSON serialization
              Object.keys(docData).forEach(key => {
                if (docData[key] && typeof docData[key].toDate === 'function') {
                  docData[key] = docData[key].toDate().toISOString();
                } else if (docData[key] instanceof Date) {
                  docData[key] = docData[key].toISOString();
                }
              });
              
              return docData;
            });
        }
      }

      const backup: BackupData = {
        metadata: {
          exportDate: new Date().toISOString(),
          version: '1.0',
          collections: foundCollections,
          totalDocuments,
          appName: 'Employee Management System'
        },
        data: allData // Store the exact JSON structure
      };

      setBackupData(backup);
      setStatus(`✅ Successfully created backup with ${foundCollections.length} collections and ${totalDocuments} documents`);

    } catch (error) {
      console.error('Backup failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`❌ Backup failed: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Download backup file
  const downloadBackup = () => {
    if (!backupData) return;
    
    // Download the data in the exact same JSON format as stored
    const backupContent = backupData.data;
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  // Handle file selection for restore
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/json') {
      setRestoreFile(file);
      setStatus('');
    } else {
      alert('Please select a valid JSON backup file');
    }
  };

  // Restore from backup
  const restoreFromBackup = async () => {
    if (!restoreFile) {
      alert('Please select a backup file first');
      return;
    }

    if (!isConfirmationValid) {
      alert('Please type "CONFIRM" to proceed with the restore');
      return;
    }
    setIsProcessing(true);
    setStatus('Reading backup file...');
    setRestoreProgress(0);
    setCurrentOperation('Initializing restore process...');

    try {
      // Step 1: Read and parse file (10%)
      setRestoreProgress(10);
      setCurrentOperation('Reading backup file...');
      const fileContent = await restoreFile.text();
      const backupContent: BackupData = JSON.parse(fileContent);
      
      // Use the backup content directly as it's in the same JSON format
      const collectionsData = backupContent;
      
      // Validate that it contains collection-like data
      if (typeof collectionsData !== 'object' || collectionsData === null) {
        throw new Error('Invalid backup file format - file must contain valid JSON object');
      }
      setStatus('Restoring data...');

      // Restore each collection
      for (let i = 0; i < collectionsToRestore.length; i++) {
        const collectionName = collectionsToRestore[i];
        const collectionProgress = 30 + ((i / totalCollections) * 60); // 30% to 90%
        
        setRestoreProgress(Math.round(collectionProgress));
        setCurrentOperation(`Restoring ${collectionName}...`);
        setStatus(`Restoring ${collectionName}...`);
        
        const documents = backupContent.data[collectionName];
        
        if (!Array.isArray(documents) || documents.length === 0) {
          continue;
        }
        
        // Clear existing data in the collection first
        try {
          setCurrentOperation(`Clearing existing ${collectionName} data...`);
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for UI update
          
          // Clear existing data in batches to avoid quota limits
          let hasMoreDocs = true;
          let clearAttempts = 0;
          const maxClearAttempts = 10;
          
          while (hasMoreDocs) {
            if (clearAttempts >= maxClearAttempts) {
              console.log(`Max clear attempts reached for ${collectionName}, continuing...`);
              break;
            }
            
            const existingDocs = await executeWithBackoff(() => getDocs(collection(db, collectionName)));
            
            if (existingDocs.empty) {
              hasMoreDocs = false;
              break;
            }
            
            // Delete in batches of 500 (Firestore limit)
            const deleteBatch = writeBatch(db);
            let batchDeleteCount = 0;
            
            for (const doc of existingDocs.docs) {
              deleteBatch.delete(doc.ref);
              batchDeleteCount++;
              
              if (batchDeleteCount >= 200) { // Reduced batch size for safer operations
                break;
              }
            }
            
            if (batchDeleteCount > 0) {
              await executeWithBackoff(() => deleteBatch.commit());
              // Add delay between batches to prevent quota exhaustion
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // If we processed fewer than 200 docs, we're done
            if (batchDeleteCount < 200) {
              hasMoreDocs = false;
            }
            
            clearAttempts++;
          }
          
          setStatus(`Cleared existing ${collectionName} data...`);
        } catch (error) {
          console.log(`Could not clear ${collectionName}:`, error);
        }
        
        setCurrentOperation(`Writing ${documents.length} ${collectionName} records...`);
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for UI update
        
        // Use batch writes for better performance
        let batch = writeBatch(db);
        let batchCount = 0;
        
        for (const document of documents) {
          const { id, ...data } = document;
          
          // Process the data to convert ISO strings back to Date objects where needed
          const processedData = { ...data };
          
          // Convert ISO date strings back to Date objects for Firestore
          Object.keys(processedData).forEach(key => {
            const value = processedData[key];
            if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
              processedData[key] = new Date(value);
            }
          });
          
          const docId = id || crypto.randomUUID();
          const docRef = doc(collection(db, collectionName), docId);
          batch.set(docRef, processedData);
          batchCount++;
          
          // Commit batch every 100 documents (much safer limit)
          if (batchCount >= 100) {
            await executeWithBackoff(() => batch.commit());
            // Add delay between batches to prevent quota exhaustion
            await new Promise(resolve => setTimeout(resolve, 1500));
            batch = writeBatch(db);
            batchCount = 0;
          }
        }
        
        // Commit remaining documents
        if (batchCount > 0) {
          await executeWithBackoff(() => batch.commit());
          // Add delay after final batch
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        restoredCount += documents.length;
      }

      // Step 4: Finalization (95%)
      setRestoreProgress(95);
      setCurrentOperation('Finalizing restore...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 5: Complete (100%)
      setRestoreProgress(100);
      setCurrentOperation('Restore completed successfully!');
      setStatus(`✅ Successfully restored ${restoredCount} documents across ${collectionsToRestore.length} collections`);
      setRestoreFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setShowConfirmDialog(false);
      setIsConfirmationValid(false);

      // Refresh the page after successful restore
      setTimeout(() => {
        alert('Database restore completed successfully! The page will now refresh.');
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Restore failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setRestoreProgress(0);
      setCurrentOperation('Restore failed');
      setStatus(`❌ Restore failed: ${errorMessage}`);
      alert(`Restore failed: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Format file size
  const formatFileSize = (data: any) => {
    const size = new Blob([JSON.stringify(data)]).size;
    return size < 1024 ? `${size} B` : 
           size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : 
           `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Database className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Database Backup & Restore</h1>
            <p className="text-gray-600">Create complete backups and restore your entire database</p>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-900">Important Safety Information</h3>
              <ul className="text-sm text-amber-800 mt-2 space-y-1">
                <li>• Always create a backup before performing any restore operation</li>
                <li>• Restore operations will replace ALL existing data</li>
                <li>• This process cannot be undone once completed</li>
                <li>• Ensure you have a stable internet connection during the process</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Backup Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-green-100 rounded-lg">
            <HardDrive className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Create Database Backup</h2>
            <p className="text-gray-600">Export all your data to a secure backup file</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Backup Actions */}
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h3 className="font-medium text-green-900 mb-3">What will be backed up:</h3>
              <div className="grid grid-cols-1 gap-2">
                {collections.map((col) => {
                  const Icon = col.icon;
                  return (
                    <div key={col.name} className="flex items-center gap-2 text-sm text-green-800">
                      <Icon className="w-4 h-4" />
                      <span className="font-medium capitalize">{col.name}</span>
                      <span className="text-green-600">- {col.description}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={createBackup}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isProcessing ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Cloud className="w-6 h-6" />
              )}
              {isProcessing ? 'Creating Backup...' : 'Create Complete Backup'}
            </button>

            {backupData && (
              <button
                onClick={downloadBackup}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-6 h-6" />
                Download Backup File
              </button>
            )}
          </div>

          {/* Backup Status & Summary */}
          <div className="space-y-4">
            {status && (
              <div className={`p-4 rounded-lg border ${
                status.includes('failed') || status.includes('❌') ? 'bg-red-50 border-red-200' : 
                status.includes('Successfully') || status.includes('✅') ? 'bg-green-50 border-green-200' : 
                'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-center gap-3">
                  {status.includes('failed') || status.includes('❌') ? (
                    <X className="w-6 h-6 text-red-600" />
                  ) : status.includes('Successfully') || status.includes('✅') ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  )}
                  <p className={`text-sm font-medium ${
                    status.includes('failed') || status.includes('❌') ? 'text-red-900' : 
                    status.includes('Successfully') || status.includes('✅') ? 'text-green-900' : 
                    'text-blue-900'
                  }`}>
                    {status}
                  </p>
                </div>
              </div>
            )}

            {backupData && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-medium text-gray-900 mb-3">Backup Summary</h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{backupData.metadata.collections.length}</div>
                    <div className="text-xs text-gray-600">Collections</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{backupData.metadata.totalDocuments}</div>
                    <div className="text-xs text-gray-600">Documents</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{formatFileSize(backupData)}</div>
                    <div className="text-xs text-gray-600">File Size</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Collections included:</h4>
                  <div className="flex flex-wrap gap-1">
                    {backupData.metadata.collections.map((collection) => (
                      <span key={collection} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {collection}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  Created: {new Date(backupData.metadata.exportDate).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Restore Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-orange-100 rounded-lg">
            <RotateCcw className="w-8 h-8 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Restore from Backup</h2>
            <p className="text-gray-600">Restore your database from a previously created backup file</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Restore Actions */}
          <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="font-medium text-red-900">⚠️ Critical Warning</h3>
              </div>
              <ul className="text-sm text-red-800 space-y-1">
                <li>• This will PERMANENTLY DELETE all existing data</li>
                <li>• All current records will be replaced with backup data</li>
                <li>• This action cannot be undone</li>
                <li>• Create a backup before proceeding</li>
                <li>• Only use trusted backup files</li>
              </ul>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Archive className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select Backup File</h3>
              <p className="text-gray-600 mb-4">Choose a JSON backup file to restore</p>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Upload className="w-5 h-5" />
                Choose Backup File
              </button>
              
              {restoreFile && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 text-sm text-green-800">
                    <FileText className="w-4 h-4" />
                    <span className="font-medium">{restoreFile.name}</span>
                    <span>({(restoreFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                </div>
              )}
            </div>

            {restoreFile && (
              <button
                onClick={() => setShowConfirmDialog(true)}
                disabled={isProcessing}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <RotateCcw className="w-6 h-6" />
                )}
                {isProcessing ? 'Restoring...' : 'Restore Database'}
              </button>
            )}

            {/* Progress Bar for Restore Process */}
            {isProcessing && restoreProgress > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-blue-900">{currentOperation}</span>
                  <span className="text-blue-700">{restoreProgress}%</span>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300 ease-out relative"
                    style={{ width: `${restoreProgress}%` }}
                  >
                    {/* Animated shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
                  </div>
                </div>
                
                {/* Progress Steps */}
                <div className="flex justify-between text-xs text-blue-600 mt-2">
                  <span className={restoreProgress >= 10 ? 'font-semibold' : ''}>Reading</span>
                  <span className={restoreProgress >= 30 ? 'font-semibold' : ''}>Connecting</span>
                  <span className={restoreProgress >= 50 ? 'font-semibold' : ''}>Restoring</span>
                  <span className={restoreProgress >= 95 ? 'font-semibold' : ''}>Finalizing</span>
                  <span className={restoreProgress >= 100 ? 'font-semibold text-green-600' : ''}>Complete</span>
                </div>
              </div>
            )}
          </div>

          {/* Restore Instructions */}
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-medium text-blue-900 mb-2">Restore Process:</h3>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Select a valid JSON backup file</li>
                <li>Review the critical warnings</li>
                <li>Click "Restore Database" to begin</li>
                <li>Confirm the action in the dialog</li>
                <li>Wait for the process to complete</li>
                <li>The page will refresh automatically</li>
              </ol>
            </div>

            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h3 className="font-medium text-yellow-900 mb-2">Best Practices:</h3>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• Always create a current backup before restoring</li>
                <li>• Test restore on a development environment first</li>
                <li>• Verify backup file integrity before use</li>
                <li>• Inform users about the maintenance window</li>
                <li>• Have a rollback plan ready</li>
              </ul>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-medium text-gray-900 mb-2">Supported Data:</h3>
              <div className="grid grid-cols-1 gap-1">
                {collections.slice(0, 5).map((col) => {
                  const Icon = col.icon;
                  return (
                    <div key={col.name} className="flex items-center gap-2 text-sm text-gray-700">
                      <Icon className="w-3 h-3" />
                      <span className="capitalize">{col.name}</span>
                    </div>
                  );
                })}
                <div className="text-xs text-gray-500 mt-1">
                  ...and {collections.length - 5} more collections
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-red-600" />
                <h2 className="text-xl font-bold text-gray-900">Confirm Database Restore</h2>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <h3 className="font-medium text-red-900 mb-2">⚠️ FINAL WARNING</h3>
                  <p className="text-sm text-red-800">
                    You are about to permanently delete ALL existing data and replace it with the backup data. 
                    This action cannot be undone.
                  </p>
                </div>
                
                <div className="text-sm text-gray-700">
                  <p className="font-medium mb-2">Selected file:</p>
                  <p className="bg-gray-100 p-2 rounded text-xs font-mono">{restoreFile?.name}</p>
                </div>
                
                <p className="text-sm text-gray-600">
                  Type "CONFIRM" below to proceed with the restore:
                </p>
                
                <ConfirmationInput />
                
                {/* Progress Section in Modal */}
                {isProcessing && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-900">Restore Progress</span>
                        <span className="text-sm font-bold text-blue-700">{restoreProgress}%</span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${restoreProgress}%` }}
                        ></div>
                      </div>
                      
                      <p className="text-xs text-blue-700">{currentOperation}</p>
                      
                      {restoreProgress === 100 && (
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Restore completed! Page will refresh shortly...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowConfirmDialog(false)}
                disabled={isProcessing}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={restoreFromBackup}
                disabled={!isConfirmationValid || isProcessing}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Restoring... {restoreProgress}%
                  </div>
                ) : (
                  'Restore Database'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Info className="w-6 h-6 text-gray-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Usage Instructions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-700">
              <div>
                <h4 className="font-medium mb-2">Creating Backups:</h4>
                <ul className="space-y-1">
                  <li>• Backups include all database collections</li>
                  <li>• Files are saved in JSON format with metadata</li>
                  <li>• Date and time information is preserved</li>
                  <li>• Store backup files in secure locations</li>
                  <li>• Create regular automated backups</li>
                  <li>• Verify backup integrity after creation</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Restoring Data:</h4>
                <ul className="space-y-1">
                  <li>• Only use trusted backup files</li>
                  <li>• Verify file format and structure</li>
                  <li>• Process replaces ALL existing data</li>
                  <li>• Large restores may take several minutes</li>
                  <li>• Page will refresh after completion</li>
                  <li>• Test restore process regularly</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackupRestore;