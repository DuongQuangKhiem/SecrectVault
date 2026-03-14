import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, Alert, TouchableOpacity, Image,
  ActivityIndicator, Modal, PermissionsAndroid, Platform, Linking,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import Video from 'react-native-video';
import RNRealPath from 'react-native-real-path';


// Local Imports
import { styles } from './styles';
import { PatternLock } from './components/PatternLock';
import { LanguageType, PasswordType, VaultItem } from './types';
import { translations, decodeAppInfoLabel } from './translations';
import { VAULT_DIR, CACHE_DIR, INDEX_FILE, XOR_HEADER_SIZE } from './constants';


import { processXOR, getAppAuthor, showAuthorAlert, encryptIndexData, decryptIndexData } from './core/SecurityEngine.bundle';

export default function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  
  const [lang, setLang] = useState<LanguageType>('vi');
  

  const t = (key: keyof typeof translations['vi']) => {
    if (key === 'aboutContent') return getAppAuthor();
    if (key === 'appInfoLabel') return decodeAppInfoLabel(lang);
    return translations[lang][key];
  };

  const [globalPassword, setGlobalPassword] = useState<string | null>(null);
  const [passType, setPassType] = useState<PasswordType>('text');
  
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  
  const [activeTab, setActiveTab] = useState<PasswordType>('text');
  const [inputPassword, setInputPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [changePassStep, setChangePassStep] = useState<1 | 2>(1);
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [selectedRestoreIds, setSelectedRestoreIds] = useState<string[]>([]);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      const storedLang = await AsyncStorage.getItem('appLanguage');
      if (storedLang === 'vi' || storedLang === 'en') setLang(storedLang as LanguageType);

      const dirExists = await RNFS.exists(VAULT_DIR);
      if (!dirExists) await RNFS.mkdir(VAULT_DIR);
      
      const storedPassword = await AsyncStorage.getItem('globalPassword');
      const storedType = await AsyncStorage.getItem('passwordType');
      
      setGlobalPassword(storedPassword);
      if (storedType) {
        setPassType(storedType as PasswordType);
        setActiveTab(storedType as PasswordType);
      }

      await cleanUpCache();

      const hasAsked = await AsyncStorage.getItem('hasAskedPermission');
      if (!hasAsked) await handleFirstTimePermissions();
    } catch (error) {
      console.error('Init error:', error);
    }
  };

  const toggleLanguage = async () => {
    const newLang = lang === 'vi' ? 'en' : 'vi';
    setLang(newLang);
    await AsyncStorage.setItem('appLanguage', newLang);
  };

  const showAppInfo = () => showAuthorAlert();
  
  const cleanUpCache = async () => {
    try {
      const exists = await RNFS.exists(CACHE_DIR);
      if (exists) await RNFS.unlink(CACHE_DIR);
    } catch (e) {}
  };

  const handleFirstTimePermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 30) {
          Alert.alert(
            t('alertFirstTime'), t('alertFirstTimeMsg'),
            [
              { text: t('skip'), onPress: () => AsyncStorage.setItem('hasAskedPermission', 'true') },
              { 
                text: t('openSettings'), 
                onPress: () => { Linking.openSettings(); AsyncStorage.setItem('hasAskedPermission', 'true'); } 
              }
            ],
            { cancelable: false }
          );

          if (Platform.Version >= 33) {
            await PermissionsAndroid.requestMultiple([
              PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
              PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
            ]);
          }
        } else {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          ]);
          await AsyncStorage.setItem('hasAskedPermission', 'true');
        }
      } catch (e) {
        console.warn('Lỗi xin quyền Android', e);
      }
    }
  };

 const loadEncryptedIndex = async (password: string): Promise<VaultItem[]> => {
    try {
      const exists = await RNFS.exists(INDEX_FILE);
      if (!exists) return [];
      const encryptedData = await RNFS.readFile(INDEX_FILE, 'utf8');
      
      return decryptIndexData(encryptedData, password);
    } catch (e) {
      throw new Error(t('errWrongPass'));
    }
  };

  const saveEncryptedIndex = async (items: VaultItem[], password: string) => {
    const itemsToSave = items.map(({ ...rest }) => rest);
    
    const encryptedData = encryptIndexData(itemsToSave, password);
    await RNFS.writeFile(INDEX_FILE, encryptedData, 'utf8');
  };

  const validatePass = (pass: string, type: PasswordType) => {
    if (!pass) return { valid: false, msg: t('errNoPass') };
    if (type === 'pin' && pass.length !== 6) return { valid: false, msg: t('errPinLen') };
    if (type === 'pattern' && pass.length < 4) return { valid: false, msg: t('errPatternLen') };
    return { valid: true, msg: '' };
  };

  const handleSetPassword = async () => {
    const check = validatePass(inputPassword, activeTab);
    if (!check.valid) return Alert.alert(t('alertError'), check.msg);

    setIsLoading(true);
    await AsyncStorage.setItem('globalPassword', inputPassword);
    await AsyncStorage.setItem('passwordType', activeTab);
    setGlobalPassword(inputPassword);
    setPassType(activeTab);
    await saveEncryptedIndex([], inputPassword);
    
    setInputPassword('');
    setIsLoading(false);
    Alert.alert(t('alertSuccess'), t('succSetup'));
  };

  const handleUnlockVault = async () => {
    if (inputPassword !== globalPassword) {
      return Alert.alert(t('alertError'), t('errWrongPass'));
    }
    setIsLoading(true);
    try {
      const items = await loadEncryptedIndex(inputPassword);
      await RNFS.mkdir(CACHE_DIR);

      const unlockedItems: VaultItem[] = [];
      const authorSignature = t('aboutContent') as string; // Lấy signature để truyền vào kill-switch

      for (const item of items) {
        const safeOriginalName = item.originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const cachedPath = `${CACHE_DIR}/${item.id}_${safeOriginalName}`;
        const vaultPath = item.savedPath.replace('file://', '');
        
        await RNFS.copyFile(vaultPath, cachedPath);
        const headerBase64 = await RNFS.read(cachedPath, XOR_HEADER_SIZE, 0, 'base64');
        
        // Truyền thêm signature vào để xác thực
        const restoredHeader = processXOR(headerBase64, inputPassword, authorSignature);
        await RNFS.write(cachedPath, restoredHeader, 0, 'base64');

        unlockedItems.push({ ...item, cachePath: `file://${cachedPath}` });
      }

      setVaultItems(unlockedItems);
      setIsUnlocked(true);
      setInputPassword('');
    } catch (error) {
      console.log(error)
      Alert.alert(t('alertError'), t('errDecrypt'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOldPass = () => {
    if (oldPasswordInput !== globalPassword) {
      return Alert.alert(t('alertError'), t('errWrongPass'));
    }
    setChangePassStep(2);
    setActiveTab('text'); 
    setNewPasswordInput('');
  };

  const handleConfirmNewPass = async () => {
    const check = validatePass(newPasswordInput, activeTab);
    if (!check.valid) return Alert.alert(t('alertError'), check.msg);

    setIsLoading(true);
    try {
      const items = await loadEncryptedIndex(oldPasswordInput);
      const authorSignature = t('aboutContent') as string;

      for (const item of items) {
        const vaultPath = item.savedPath.replace('file://', '');
        const currentScrambledHeader = await RNFS.read(vaultPath, XOR_HEADER_SIZE, 0, 'base64');
        
        // Giải mã bằng pass cũ kèm signature
        const originalHeader = processXOR(currentScrambledHeader, oldPasswordInput, authorSignature);
        
        // Mã hóa lại bằng pass mới kèm signature
        const newScrambledHeader = processXOR(originalHeader, newPasswordInput, authorSignature);
        await RNFS.write(vaultPath, newScrambledHeader, 0, 'base64');
      }

      await saveEncryptedIndex(items, newPasswordInput);
      await AsyncStorage.setItem('globalPassword', newPasswordInput);
      await AsyncStorage.setItem('passwordType', activeTab);
      
      setGlobalPassword(newPasswordInput);
      setPassType(activeTab);
      
      setIsChangingPassword(false);
      setChangePassStep(1);
      setOldPasswordInput('');
      setNewPasswordInput('');
      
      Alert.alert(t('alertSuccess'), t('succChangePass'));
    } catch (error) {
      console.log(error)
      Alert.alert(t('alertError'), t('errChangePass'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMedia = async () => {
    const options = { mediaType: 'mixed' as const, includeBase64: false, selectionLimit: 0 };

    launchImageLibrary(options, async (response) => {
      if (response.didCancel || !response.assets) return;
      setIsLoading(true);
      
      const urisToDelete: string[] = [];
      const realPathsToDelete: string[] = [];
      const newItems: VaultItem[] = [];
      const authorSignature = t('aboutContent') as string;

      try {
        await RNFS.mkdir(CACHE_DIR);
        for (const asset of response.assets) {
          if (!asset.uri || !asset.fileName) continue;
          const uniqueId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          const secureSavedPath = `${VAULT_DIR}/${uniqueId}.bin`; 
          const safeOriginalName = asset.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
          const cachedPath = `${CACHE_DIR}/${uniqueId}_${safeOriginalName}`;

          await RNFS.copyFile(asset.uri, secureSavedPath);
          const stat = await RNFS.stat(asset.uri);
          const readSize = Math.min(Number(stat.size), XOR_HEADER_SIZE);

          const originalHeader = await RNFS.read(secureSavedPath, readSize, 0, 'base64');
          
          // Mã hóa XOR kèm signature xác thực
          const scrambledHeader = processXOR(originalHeader, globalPassword!, authorSignature);
          await RNFS.write(secureSavedPath, scrambledHeader, 0, 'base64');
          
          const newItem: VaultItem = {
            id: uniqueId,
            originalName: asset.fileName,
            type: asset.fileName.match(/\.(mp4|mov|avi|mkv)$/i) ? 'video' : 'image',
            savedPath: `file://${secureSavedPath}`
          };

          if (isUnlocked) {
            await RNFS.copyFile(asset.uri, cachedPath);
            newItem.cachePath = `file://${cachedPath}`;
          }

          newItems.push(newItem);
          urisToDelete.push(asset.uri);

          if (Platform.OS === 'android' && asset.uri.startsWith('content://')) {
            try {
              const realPath = await RNRealPath.getRealPathFromURI(asset.uri);
              if (realPath) realPathsToDelete.push(realPath);
            } catch (pathError) {
              console.warn('Không lấy được đường dẫn thật:', pathError);
              if (asset.originalPath) realPathsToDelete.push(asset.originalPath);
            }
          } else if (asset.originalPath) {
            realPathsToDelete.push(asset.originalPath);
          }
        }

        const currentItems = await loadEncryptedIndex(globalPassword!);
        const updatedVault = [...currentItems, ...newItems];
        await saveEncryptedIndex(updatedVault, globalPassword!);
        if (isUnlocked) setVaultItems(updatedVault);
        
      } catch (err) {
        console.log(err);
        setIsLoading(false);
        return Alert.alert(t('alertError'), t('errXOR'));
      }

      try {
        let deletedCount = 0;
        for (const realPath of realPathsToDelete) {
          try { 
            await RNFS.unlink(realPath); 
            deletedCount++; 
          } catch (e) {
            console.log("Lỗi xóa RNFS trên path:", realPath, e);
          }
        }

        if (deletedCount === 0 && urisToDelete.length > 0) {
          try {
            await CameraRoll.deletePhotos(urisToDelete);
            deletedCount = urisToDelete.length;
          } catch (e) {
            console.log("Lỗi xóa CameraRoll:", e);
          }
        }

        if (deletedCount > 0) {
          Alert.alert(t('alertSuccess'), `${t('succHidePrefix')} ${deletedCount} ${t('succHideSuffix')}`);
        } else {
          Alert.alert(t('alertNotice'), t('errNoPerm'));
        }
      } catch (deleteError) {
        console.log(deleteError);
        Alert.alert(t('alertNotice'), t('errNoPerm'));
      } finally {
        setIsLoading(false);
      }
    });
  };

  const handleUnhide = async (item: VaultItem) => {
    setIsLoading(true);
    try {
      await unhideItem(item);
      const updatedVault = vaultItems.filter(i => i.id !== item.id);
      await saveEncryptedIndex(updatedVault, globalPassword!);
      setVaultItems(updatedVault);
      setSelectedItem(null);
      setSelectedRestoreIds(prev => prev.filter(id => id !== item.id));
      Alert.alert(t('alertSuccess'), t('succRestore'));
    } catch (error) {
      console.log(error)
      Alert.alert(t('alertError'), t('errRestore'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLockVault = async () => {
    setIsLoading(true);
    setVaultItems([]);
    setIsUnlocked(false);
    setSelectedItem(null);
    setSelectedRestoreIds([]);
    setInputPassword('');
    await cleanUpCache();
    setIsLoading(false);
  };

  const toggleRestoreSelection = (itemId: string) => {
    setSelectedRestoreIds(prev => {
      if (prev.includes(itemId)) return prev.filter(id => id !== itemId);
      return [...prev, itemId];
    });
  };

  const clearRestoreSelection = () => setSelectedRestoreIds([]);

  const unhideItem = async (item: VaultItem) => {
    if (!item.cachePath) return;
    if (item.cachePath) await CameraRoll.save(item.cachePath, { type: 'auto' });
    await RNFS.unlink(item.savedPath.replace('file://', ''));
    if (item.cachePath) await RNFS.unlink(item.cachePath.replace('file://', ''));
  };

  const handleBulkUnhide = async () => {
    if (selectedRestoreIds.length === 0) {
      return Alert.alert(t('alertNotice'), t('noItemsSelected'));
    }

    setIsLoading(true);
    try {
      const remaining: VaultItem[] = [];
      for (const item of vaultItems) {
        if (selectedRestoreIds.includes(item.id)) {
          try {
            await unhideItem(item);
          } catch (e) {
            console.warn('Bulk unhide failed for ', item.id, e);
          }
        } else {
          remaining.push(item);
        }
      }
      await saveEncryptedIndex(remaining, globalPassword!);
      setVaultItems(remaining);
      setSelectedRestoreIds([]);
      setSelectedItem(null);
      Alert.alert(t('alertSuccess'), t('succRestoreMultiple'));
    } catch (error) {
      console.log(error)
      Alert.alert(t('alertError'), t('errRestore'));
    } finally {
      setIsLoading(false);
    }
  };

  const renderInputUI = (type: PasswordType, value: string, setValue: (s: string) => void, placeholder: string) => {
    if (type === 'pattern') {
      return (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ marginBottom: 15, color: '#007AFF', fontWeight: 'bold' }}>{t('drawPattern')}</Text>
          <PatternLock onComplete={setValue} />
          {value.length > 0 && <Text style={{ marginTop: 10, color: '#28a745', fontWeight: 'bold' }}>{t('patternRecorded')}</Text>}
        </View>
      );
    }

    if (type === 'pin') {
      return (
        <View style={styles.customPinContainer}>
          <View style={styles.pinDotsRow}>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <View key={index} style={[styles.pinDot, value.length > index && styles.pinDotActive]} />
            ))}
          </View>
          <TextInput
            style={styles.hiddenPinInput}
            keyboardType="numeric"
            maxLength={6}
            value={value}
            onChangeText={setValue}
            caretHidden={true}
            autoFocus={true}
          />
        </View>
      );
    }

    return (
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.passwordInput}
          placeholder={placeholder}
          placeholderTextColor="#888"
          secureTextEntry={!showPassword}
          value={value}
          onChangeText={setValue}
        />
        <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
          <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderTabSelector = () => (
    <View style={styles.tabContainer}>
      {(['text', 'pin', 'pattern'] as PasswordType[]).map(type => (
        <TouchableOpacity 
          key={type} 
          style={[styles.tabButton, activeTab === type && styles.tabButtonActive]}
          onPress={() => { setActiveTab(type); setInputPassword(''); setNewPasswordInput(''); }}
        >
          <Text style={[styles.tabText, activeTab === type && styles.tabTextActive]}>
            {type === 'text' ? t('optText') : type === 'pin' ? t('optPin') : t('optPattern')}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10, color: 'black' }}>{t('loading')}</Text>
      </View>
    );
  }

  if (isChangingPassword) {
    return (
      <View style={[styles.centerContainer, { paddingTop: safeAreaInsets.top }]}>
        <Text style={styles.appTitle}>{t('changePasswordTitle')}</Text>
        <Text style={styles.subtitle}>{changePassStep === 1 ? t('verifyOldPass') : t('setupNewPass')}</Text>
        
        {changePassStep === 1 ? (
          <>
            {renderInputUI(passType, oldPasswordInput, setOldPasswordInput, t('oldPasswordPlaceholder') as string)}
            <View style={{ flexDirection: 'row', width: '100%', gap: 10, marginTop: 20 }}>
              <TouchableOpacity style={[styles.primaryButton, { flex: 1, backgroundColor: '#6c757d' }]} onPress={() => { setIsChangingPassword(false); setChangePassStep(1); }}>
                <Text style={styles.buttonText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton, { flex: 1 }]} onPress={handleVerifyOldPass}>
                <Text style={styles.buttonText}>{t('next')}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {renderTabSelector()}
            {renderInputUI(activeTab, newPasswordInput, setNewPasswordInput, t('newPasswordPlaceholder') as string)}
            <View style={{ flexDirection: 'row', width: '100%', gap: 10, marginTop: 20 }}>
              <TouchableOpacity style={[styles.primaryButton, { flex: 1, backgroundColor: '#6c757d' }]} onPress={() => { setIsChangingPassword(false); setChangePassStep(1); }}>
                <Text style={styles.buttonText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton, { flex: 1 }]} onPress={handleConfirmNewPass}>
                <Text style={styles.buttonText}>{t('confirm')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  }

  if (!isUnlocked) {
    return (
      <View style={[styles.centerContainer, { paddingTop: safeAreaInsets.top }]}>
        <TouchableOpacity style={styles.langButtonTopRight} onPress={toggleLanguage}>
          <Text style={styles.langButtonText}>{lang === 'vi' ? '🇻🇳 VN' : '🇬🇧 EN'}</Text>
        </TouchableOpacity>

        <Text style={styles.appTitle}>{t('vaultTitle')}</Text>
        <Text style={styles.subtitle}>{globalPassword ? t('vaultSubLocked') : t('vaultSubSetup')}</Text>
        
        {!globalPassword && renderTabSelector()}
        {renderInputUI(!globalPassword ? activeTab : passType, inputPassword, setInputPassword, t('passwordPlaceholder') as string)}

        {!globalPassword ? (
          <TouchableOpacity style={[styles.primaryButton, { marginTop: 20 }]} onPress={handleSetPassword}>
            <Text style={styles.buttonText}>{t('setupFirstTime')}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={[styles.primaryButton, { marginTop: 20 }]} onPress={handleUnlockVault}>
              <Text style={styles.buttonText}>{t('unlockVault')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#28a745', marginTop: 15 }]} onPress={handleAddMedia}>
              <Text style={styles.buttonText}>{t('addMedia')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 30 }} onPress={() => {
              setIsChangingPassword(true);
              setChangePassStep(1);
              setOldPasswordInput('');
              setNewPasswordInput('');
            }}>
              <Text style={{ color: '#007AFF', fontSize: 16, textDecorationLine: 'underline' }}>{t('changePasswordLink')}</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.infoButton} onPress={showAppInfo}>
          <Text style={styles.infoText}>{t('appInfoLabel')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: safeAreaInsets.top }]}>
      <View style={styles.headerRow}>
        <Text style={styles.appTitle}>{t('galleryTitle')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity style={styles.langButtonSmall} onPress={toggleLanguage}>
            <Text style={styles.langButtonTextSmall}>{lang === 'vi' ? '🇻🇳' : '🇬🇧'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.lockButton} onPress={handleLockVault}>
            <Text style={styles.buttonText}>{t('lockButton')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {selectedRestoreIds.length > 0 && (
        <View style={styles.bulkActionRow}>
          <TouchableOpacity style={[styles.primaryButton, { flex: 1, marginRight: 8, backgroundColor: '#6c757d' }]} onPress={clearRestoreSelection}>
            <Text style={styles.buttonText}>{t('deselectAll')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryButton, { flex: 1, marginLeft: 8, backgroundColor: '#28a745' }]} onPress={handleBulkUnhide}>
            <Text style={styles.buttonText}>{t('restoreSelected')}</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        data={vaultItems}
        numColumns={3}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const checked = selectedRestoreIds.includes(item.id);
          const onPress = () => {
            if (selectedRestoreIds.length > 0) {
              toggleRestoreSelection(item.id);
            } else {
              setSelectedItem(item);
            }
          };
          return (
            <TouchableOpacity
              style={[styles.gridItem, checked && styles.gridItemSelected]}
              onPress={onPress}
              onLongPress={() => toggleRestoreSelection(item.id)}
            >
              <Image source={{ uri: item.cachePath }} style={styles.thumbnail} />
              {checked && <View style={styles.checkboxOverlay}><Text style={styles.checkboxText}>✔</Text></View>}
              {item.type === 'video' && <Text style={styles.videoBadge}>▶ VIDEO</Text>}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>{t('emptyVault')}</Text>}
      />

      <TouchableOpacity style={styles.fab} onPress={handleAddMedia}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={!!selectedItem} transparent={true} animationType="fade" onRequestClose={() => setSelectedItem(null)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeModalArea} onPress={() => setSelectedItem(null)} />
          {selectedItem && (
            <View style={styles.reviewBox}>
              {selectedItem.type === 'video' ? (
                <Video source={{ uri: selectedItem.cachePath }} style={styles.fullImage} controls={true} resizeMode="contain" paused={false} />
              ) : (
                <Image source={{ uri: selectedItem.cachePath }} style={styles.fullImage} resizeMode="contain" />
              )}
              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#dc3545' }]} onPress={() => handleUnhide(selectedItem)}>
                  <Text style={styles.buttonText}>{t('unhideButton')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#6c757d' }]} onPress={() => setSelectedItem(null)}>
                  <Text style={styles.buttonText}>{t('closeButton')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}