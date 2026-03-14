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
import { createThumbnail } from 'react-native-create-thumbnail';

import { styles } from './styles';
import { PatternLock } from './components/PatternLock';
import { LanguageType, PasswordType, VaultItem } from './types';
import { translations, decodeAppInfoLabel } from './translations';
import { VAULT_DIR, CACHE_DIR } from './constants'; 

import { 
  getAppAuthor, 
  showAuthorAlert, 
  encryptIndexData, 
  decryptIndexData,
  evaluateVaultAccess,
  secureMediaLayer,
  reSecureMediaLayer,
  CORE_INDEX_NAME,
  DECOY_INDEX_NAME
} from './core/SecurityEngine.bundle';

interface ExtendedVaultItem extends VaultItem {
  thumbSavedPath?: string;
  thumbCachePath?: string;
}

export default function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const [lang, setLang] = useState<LanguageType>('vi');
  
  const t = (key: string) => {
    const extraVi: any = {
      setupDecoy: 'Tạo Két Sắt Giả (Decoy)',
      decoyTitle: 'Cài Đặt Mật Khẩu Giả',
      decoySub: 'Dùng khi bị ép mở app. Két này sẽ hiển thị trống rỗng.',
      decoySuccess: 'Đã tạo Két giả! Hãy dùng mật khẩu này khi bị ép buộc.',
      errSamePass: 'Mật khẩu giả KHÔNG ĐƯỢC trùng mật khẩu thật!',
    };
    const extraEn: any = {
      setupDecoy: 'Create Decoy Vault',
      decoyTitle: 'Set Decoy Password',
      decoySub: 'Use when coerced. This vault will appear empty.',
      decoySuccess: 'Decoy vault created! Use this password when forced.',
      errSamePass: 'Decoy password MUST NOT match the real one!',
    };

    if (key === 'aboutContent') return getAppAuthor();
    if (key === 'appInfoLabel') return decodeAppInfoLabel(lang);
    if (lang === 'vi' && extraVi[key]) return extraVi[key];
    if (lang === 'en' && extraEn[key]) return extraEn[key];
    return (translations[lang] as any)[key] || key;
  };

  const [globalPassword, setGlobalPassword] = useState<string | null>(null);
  const [decoyPassword, setDecoyPassword] = useState<string | null>(null);
  const [passType, setPassType] = useState<PasswordType>('text');
  
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isDecoyUnlocked, setIsDecoyUnlocked] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [vaultItems, setVaultItems] = useState<ExtendedVaultItem[]>([]);
  
  const [activeTab, setActiveTab] = useState<PasswordType>('text');
  const [inputPassword, setInputPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSettingDecoy, setIsSettingDecoy] = useState(false);
  const [changePassStep, setChangePassStep] = useState<1 | 2>(1);
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const [selectedRestoreIds, setSelectedRestoreIds] = useState<string[]>([]);
  const [viewingItem, setViewingItem] = useState<ExtendedVaultItem | null>(null);
  const [fullMediaPath, setFullMediaPath] = useState<string | null>(null);
  const [isPreparingMedia, setIsPreparingMedia] = useState(false);

  useEffect(() => { 
    initApp(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initApp = async () => {
    try {
      const storedLang = await AsyncStorage.getItem('appLanguage');
      if (storedLang === 'vi' || storedLang === 'en') setLang(storedLang as LanguageType);

      const dirExists = await RNFS.exists(VAULT_DIR);
      if (!dirExists) await RNFS.mkdir(VAULT_DIR);
      
      setGlobalPassword(await AsyncStorage.getItem('globalPassword'));
      setDecoyPassword(await AsyncStorage.getItem('decoyPassword'));
      const storedType = await AsyncStorage.getItem('passwordType');
      if (storedType) {
        setPassType(storedType as PasswordType);
        setActiveTab(storedType as PasswordType);
      }
      await cleanUpCache();
      if (!(await AsyncStorage.getItem('hasAskedPermission'))) await handleFirstTimePermissions();
    } catch (error) { console.error('Init error:', error); } // Lỗi này được log nên giữ nguyên
  };

  const toggleLanguage = async () => {
    const newLang = lang === 'vi' ? 'en' : 'vi';
    setLang(newLang);
    await AsyncStorage.setItem('appLanguage', newLang);
  };

  const cleanUpCache = async () => {
    try { if (await RNFS.exists(CACHE_DIR)) await RNFS.unlink(CACHE_DIR); } catch (_e) {}
  };

  const handleFirstTimePermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 30) {
          Alert.alert(
            t('alertFirstTime'), t('alertFirstTimeMsg'),
            [
              { text: t('skip'), onPress: () => AsyncStorage.setItem('hasAskedPermission', 'true') },
              { text: t('openSettings'), onPress: () => { Linking.openSettings(); AsyncStorage.setItem('hasAskedPermission', 'true'); } }
            ], { cancelable: false }
          );
          if (Platform.Version >= 33) {
            await PermissionsAndroid.requestMultiple([ PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES, PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO ]);
          }
        } else {
          await PermissionsAndroid.requestMultiple([ PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE, PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE ]);
          await AsyncStorage.setItem('hasAskedPermission', 'true');
        }
      } catch (_e) {}
    }
  };

  const getCurrentIndexFile = () => isDecoyUnlocked ? (VAULT_DIR + DECOY_INDEX_NAME) : (VAULT_DIR + CORE_INDEX_NAME);
  const getCurrentPassword = () => (isDecoyUnlocked ? decoyPassword : globalPassword) as string;

  const loadEncryptedIndex = async (password: string, targetFile: string): Promise<ExtendedVaultItem[]> => {
    try {
      if (!(await RNFS.exists(targetFile))) return [];
      return decryptIndexData(await RNFS.readFile(targetFile, 'utf8'), password);
    } catch (_e) { throw new Error(t('errWrongPass')); }
  };

  const saveEncryptedIndex = async (items: ExtendedVaultItem[], password: string, targetFile: string) => {
    // Đã fix lỗi unused vars bằng cách đổi tên thành _cachePath và _thumbCachePath
    const itemsToSave = items.map(({ cachePath: _cachePath, thumbCachePath: _thumbCachePath, ...rest }) => rest);
    await RNFS.writeFile(targetFile, encryptIndexData(itemsToSave, password), 'utf8');
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

    setIsLoading(true); setLoadingMsg('Đang khởi tạo...');
    await AsyncStorage.setItem('globalPassword', inputPassword);
    await AsyncStorage.setItem('passwordType', activeTab);
    setGlobalPassword(inputPassword);
    setPassType(activeTab);
    await saveEncryptedIndex([], inputPassword, VAULT_DIR + CORE_INDEX_NAME);
    
    setInputPassword(''); setIsLoading(false); setLoadingMsg('');
    Alert.alert(t('alertSuccess'), t('succSetup'));
  };

  const handleSetupDecoy = async () => {
    const check = validatePass(newPasswordInput, activeTab);
    if (!check.valid) return Alert.alert(t('alertError'), check.msg);
    if (newPasswordInput === globalPassword) return Alert.alert(t('alertError'), t('errSamePass'));

    setIsLoading(true); setLoadingMsg('Đang tạo Két giả...');
    await AsyncStorage.setItem('decoyPassword', newPasswordInput);
    setDecoyPassword(newPasswordInput);
    await saveEncryptedIndex([], newPasswordInput, VAULT_DIR + DECOY_INDEX_NAME);
    
    setNewPasswordInput(''); setIsSettingDecoy(false); setIsLoading(false); setLoadingMsg('');
    Alert.alert(t('alertSuccess'), t('decoySuccess'));
  };

  const handleUnlockVault = async () => {
    setIsLoading(true); setLoadingMsg('Đang mở khóa két...');
    try {
      const access = evaluateVaultAccess(inputPassword, globalPassword, decoyPassword);
      const targetIndex = VAULT_DIR + access.targetIndexName;

      const items = await loadEncryptedIndex(inputPassword, targetIndex);
      await RNFS.mkdir(CACHE_DIR);
      const unlockedItems: ExtendedVaultItem[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setLoadingMsg(`Đang tải dữ liệu ${i + 1}/${items.length}...`);
        
        const safeOriginalName = item.originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
        let cachePath = '';
        let thumbCachePath = '';

        if (item.type === 'video' && item.thumbSavedPath) {
          const tPath = `${CACHE_DIR}/thumb_${item.id}.jpg`;
          await RNFS.copyFile(item.thumbSavedPath.replace('file://', ''), tPath);
          await secureMediaLayer(tPath, inputPassword); 
          thumbCachePath = `file://${tPath}`;
        } else {
          const cPath = `${CACHE_DIR}/${item.id}_${safeOriginalName}`;
          await RNFS.copyFile(item.savedPath.replace('file://', ''), cPath);
          await secureMediaLayer(cPath, inputPassword); 
          cachePath = `file://${cPath}`;
        }
        unlockedItems.push({ ...item, cachePath, thumbCachePath });
      }

      setIsDecoyUnlocked(access.isDecoy); 
      setVaultItems(unlockedItems);
      setIsUnlocked(true);
      setInputPassword('');
    } catch (_error) {
      Alert.alert(t('alertError'), t('errWrongPass'));
    } finally {
      setIsLoading(false); setLoadingMsg('');
    }
  };

  const handleVerifyOldPass = () => {
    if (oldPasswordInput !== globalPassword) return Alert.alert(t('alertError'), t('errWrongPass'));
    setChangePassStep(2); setActiveTab('text'); setNewPasswordInput('');
  };

  const handleConfirmNewPass = async () => {
    const check = validatePass(newPasswordInput, activeTab);
    if (!check.valid) return Alert.alert(t('alertError'), check.msg);

    setIsLoading(true); setLoadingMsg('Đang mã hóa lại Két sắt...');
    try {
      const items = await loadEncryptedIndex(oldPasswordInput, VAULT_DIR + CORE_INDEX_NAME);

      for (let i = 0; i < items.length; i++) {
        setLoadingMsg(`Đang đổi khóa file ${i + 1}/${items.length}...`);
        const item = items[i];
        const vaultPath = item.savedPath.replace('file://', '');
        
        await reSecureMediaLayer(vaultPath, oldPasswordInput, newPasswordInput);

        if (item.thumbSavedPath) {
          await reSecureMediaLayer(item.thumbSavedPath.replace('file://', ''), oldPasswordInput, newPasswordInput);
        }
      }

      await saveEncryptedIndex(items, newPasswordInput, VAULT_DIR + CORE_INDEX_NAME);
      await AsyncStorage.setItem('globalPassword', newPasswordInput);
      await AsyncStorage.setItem('passwordType', activeTab);
      
      setGlobalPassword(newPasswordInput); setPassType(activeTab);
      setIsChangingPassword(false); setChangePassStep(1);
      setOldPasswordInput(''); setNewPasswordInput('');
      
      Alert.alert(t('alertSuccess'), t('succChangePass'));
    } catch (_error) {
      Alert.alert(t('alertError'), t('errChangePass'));
    } finally {
      setIsLoading(false); setLoadingMsg('');
    }
  };

  const handleAddMedia = async () => {
    const options = { mediaType: 'mixed' as const, includeBase64: false, selectionLimit: 0 };

    launchImageLibrary(options, async (response) => {
      if (response.didCancel || !response.assets) return;
      setIsLoading(true);
      
      const urisToDelete: string[] = [];
      const realPathsToDelete: string[] = [];
      const newItems: ExtendedVaultItem[] = [];
      const currentPass = getCurrentPassword();
      const currentIndex = getCurrentIndexFile();

      try {
        await RNFS.mkdir(CACHE_DIR);
        for (let i = 0; i < response.assets.length; i++) {
          const asset = response.assets[i];
          if (!asset.uri || !asset.fileName) continue;
          
          setLoadingMsg(`Đang giấu file ${i + 1}/${response.assets.length}...`);

          const uniqueId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          const secureSavedPath = `${VAULT_DIR}/${uniqueId}.bin`; 
          const isVideo = !!asset.fileName.match(/\.(mp4|mov|avi|mkv)$/i);
          let thumbSavedPath = undefined;

          if (isVideo) {
            try {
              const thumb = await createThumbnail({ url: asset.uri, timeStamp: 0 });
              thumbSavedPath = `${VAULT_DIR}/thumb_${uniqueId}.bin`;
              await RNFS.copyFile(thumb.path, thumbSavedPath);
              await secureMediaLayer(thumbSavedPath, currentPass); 
              await RNFS.unlink(thumb.path); 
            } catch (e) { console.warn('Lỗi tạo thumbnail', e); } // Biến e này có log ra nên giữ nguyên
          }

          await RNFS.copyFile(asset.uri, secureSavedPath);
          await secureMediaLayer(secureSavedPath, currentPass); 
          
          const newItem: ExtendedVaultItem = {
            id: uniqueId,
            originalName: asset.fileName,
            type: isVideo ? 'video' : 'image',
            savedPath: `file://${secureSavedPath}`,
            thumbSavedPath: thumbSavedPath ? `file://${thumbSavedPath}` : undefined
          };

          if (isUnlocked) {
            const safeOriginalName = asset.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
            if (isVideo && thumbSavedPath) {
              const tCachePath = `${CACHE_DIR}/thumb_${uniqueId}.jpg`;
              await RNFS.copyFile(thumbSavedPath.replace('file://',''), tCachePath);
              await secureMediaLayer(tCachePath, currentPass);
              newItem.thumbCachePath = `file://${tCachePath}`;
            } else {
              const cachePath = `${CACHE_DIR}/${uniqueId}_${safeOriginalName}`;
              await RNFS.copyFile(secureSavedPath, cachePath);
              await secureMediaLayer(cachePath, currentPass); 
              newItem.cachePath = `file://${cachePath}`;
            }
          }

          newItems.push(newItem);
          urisToDelete.push(asset.uri);

          if (Platform.OS === 'android' && asset.uri.startsWith('content://')) {
            try {
              const realPath = await RNRealPath.getRealPathFromURI(asset.uri);
              if (realPath) realPathsToDelete.push(realPath);
            } catch (_e) { if (asset.originalPath) realPathsToDelete.push(asset.originalPath); }
          } else if (asset.originalPath) {
            realPathsToDelete.push(asset.originalPath);
          }
        }

        const currentItems = await loadEncryptedIndex(currentPass, currentIndex);
        const updatedVault = [...currentItems, ...newItems];
        await saveEncryptedIndex(updatedVault, currentPass, currentIndex);
        if (isUnlocked) setVaultItems(updatedVault);
        
      } catch (_err) {
        setIsLoading(false); setLoadingMsg('');
        return Alert.alert(t('alertError'), t('errXOR'));
      }

      setLoadingMsg('Đang dọn dẹp file gốc...');
      try {
        let deletedCount = 0;
        for (const realPath of realPathsToDelete) {
          try { await RNFS.unlink(realPath); deletedCount++; } catch (_e) {}
        }
        if (deletedCount === 0 && urisToDelete.length > 0) {
          try { await CameraRoll.deletePhotos(urisToDelete); deletedCount = urisToDelete.length; } catch (_e) {}
        }
        if (deletedCount > 0) {
          Alert.alert(t('alertSuccess'), `${t('succHidePrefix')} ${deletedCount} ${t('succHideSuffix')}`);
        } else {
          Alert.alert(t('alertNotice'), t('errNoPerm'));
        }
      } catch (_deleteError) { Alert.alert(t('alertNotice'), t('errNoPerm')); } finally {
        setIsLoading(false); setLoadingMsg('');
      }
    });
  };

  const openMedia = async (item: ExtendedVaultItem) => {
    setViewingItem(item); setIsPreparingMedia(true);
    try {
      const fullCacheTemp = `${CACHE_DIR}/full_${item.id}_${item.originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      await RNFS.copyFile(item.savedPath.replace('file://', ''), fullCacheTemp);
      
      await secureMediaLayer(fullCacheTemp, getCurrentPassword()); 
      
      setFullMediaPath(`file://${fullCacheTemp}`);
    } catch (_e) {
      Alert.alert(t('alertError'), 'Không thể tải file media');
      setViewingItem(null);
    } finally { setIsPreparingMedia(false); }
  };

  const closeMedia = async () => {
    if (fullMediaPath) await RNFS.unlink(fullMediaPath.replace('file://', '')).catch(() => {});
    setViewingItem(null); setFullMediaPath(null);
  };

  const unhideItem = async (item: ExtendedVaultItem) => {
    const tempRestorePath = `${CACHE_DIR}/restore_${item.originalName}`;
    await RNFS.copyFile(item.savedPath.replace('file://', ''), tempRestorePath);
    await secureMediaLayer(tempRestorePath, getCurrentPassword()); 

    await CameraRoll.save(`file://${tempRestorePath}`, { type: 'auto' });

    await RNFS.unlink(tempRestorePath).catch(() => {});
    await RNFS.unlink(item.savedPath.replace('file://', '')).catch(() => {});
    if (item.thumbSavedPath) await RNFS.unlink(item.thumbSavedPath.replace('file://', '')).catch(() => {});
    if (item.cachePath) await RNFS.unlink(item.cachePath.replace('file://', '')).catch(() => {});
    if (item.thumbCachePath) await RNFS.unlink(item.thumbCachePath.replace('file://', '')).catch(() => {});
  };

  const handleUnhide = async (item: ExtendedVaultItem) => {
    setIsLoading(true); setLoadingMsg('Đang khôi phục...');
    try {
      await unhideItem(item);
      const updatedVault = vaultItems.filter(i => i.id !== item.id);
      await saveEncryptedIndex(updatedVault, getCurrentPassword(), getCurrentIndexFile());
      setVaultItems(updatedVault); closeMedia(); setSelectedRestoreIds(prev => prev.filter(id => id !== item.id));
      Alert.alert(t('alertSuccess'), t('succRestore'));
    } catch (_error) { Alert.alert(t('alertError'), t('errRestore')); } finally {
      setIsLoading(false); setLoadingMsg('');
    }
  };

  const handleBulkUnhide = async () => {
    if (selectedRestoreIds.length === 0) return Alert.alert(t('alertNotice'), t('noItemsSelected'));
    setIsLoading(true);
    try {
      const remaining: ExtendedVaultItem[] = [];
      for (let i = 0; i < vaultItems.length; i++) {
        const item = vaultItems[i];
        if (selectedRestoreIds.includes(item.id)) {
          setLoadingMsg(`Đang khôi phục ${i + 1}/${selectedRestoreIds.length}...`);
          try { await unhideItem(item); } catch (_e) { }
        } else { remaining.push(item); }
      }
      await saveEncryptedIndex(remaining, getCurrentPassword(), getCurrentIndexFile());
      setVaultItems(remaining); setSelectedRestoreIds([]);
      Alert.alert(t('alertSuccess'), t('succRestoreMultiple'));
    } catch (_error) { Alert.alert(t('alertError'), t('errRestore')); } finally {
      setIsLoading(false); setLoadingMsg('');
    }
  };

  const handleLockVault = async () => {
    setIsLoading(true); setLoadingMsg('Đang khóa két...');
    setVaultItems([]); setIsUnlocked(false); setIsDecoyUnlocked(false);
    setViewingItem(null); setFullMediaPath(null); setSelectedRestoreIds([]); setInputPassword('');
    await cleanUpCache();
    setIsLoading(false); setLoadingMsg('');
  };

  const toggleRestoreSelection = (itemId: string) => {
    setSelectedRestoreIds(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]);
  };
  const clearRestoreSelection = () => setSelectedRestoreIds([]);

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
          <TextInput style={styles.hiddenPinInput} keyboardType="numeric" maxLength={6} value={value} onChangeText={setValue} caretHidden={true} autoFocus={true} />
        </View>
      );
    }
    return (
      <View style={styles.inputWrapper}>
        <TextInput style={styles.passwordInput} placeholder={placeholder} placeholderTextColor="#888" secureTextEntry={!showPassword} value={value} onChangeText={setValue} />
        <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}><Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text></TouchableOpacity>
      </View>
    );
  };

  const renderTabSelector = () => (
    <View style={styles.tabContainer}>
      {(['text', 'pin', 'pattern'] as PasswordType[]).map(type => (
        <TouchableOpacity key={type} style={[styles.tabButton, activeTab === type && styles.tabButtonActive]} onPress={() => { setActiveTab(type); setInputPassword(''); setNewPasswordInput(''); }}>
          <Text style={[styles.tabText, activeTab === type && styles.tabTextActive]}>{type === 'text' ? t('optText') : type === 'pin' ? t('optPin') : t('optPattern')}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10, color: 'black', fontWeight: 'bold' }}>{loadingMsg || t('loading')}</Text>
      </View>
    );
  }

  if (isSettingDecoy) {
    return (
      <View style={[styles.centerContainer, { paddingTop: safeAreaInsets.top }]}>
        <Text style={styles.appTitle}>{t('decoyTitle')}</Text>
        <Text style={styles.subtitle}>{t('decoySub')}</Text>
        {renderTabSelector()}
        {renderInputUI(activeTab, newPasswordInput, setNewPasswordInput, t('newPasswordPlaceholder') as string)}
        <View style={{ flexDirection: 'row', width: '100%', gap: 10, marginTop: 20 }}>
          <TouchableOpacity style={[styles.primaryButton, { flex: 1, backgroundColor: '#6c757d' }]} onPress={() => { setIsSettingDecoy(false); setNewPasswordInput(''); }}><Text style={styles.buttonText}>{t('cancel')}</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.primaryButton, { flex: 1, backgroundColor: '#dc3545' }]} onPress={handleSetupDecoy}><Text style={styles.buttonText}>{t('confirm')}</Text></TouchableOpacity>
        </View>
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
              <TouchableOpacity style={[styles.primaryButton, { flex: 1, backgroundColor: '#6c757d' }]} onPress={() => { setIsChangingPassword(false); setChangePassStep(1); }}><Text style={styles.buttonText}>{t('cancel')}</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton, { flex: 1 }]} onPress={handleVerifyOldPass}><Text style={styles.buttonText}>{t('next')}</Text></TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {renderTabSelector()}
            {renderInputUI(activeTab, newPasswordInput, setNewPasswordInput, t('newPasswordPlaceholder') as string)}
            <View style={{ flexDirection: 'row', width: '100%', gap: 10, marginTop: 20 }}>
              <TouchableOpacity style={[styles.primaryButton, { flex: 1, backgroundColor: '#6c757d' }]} onPress={() => { setIsChangingPassword(false); setChangePassStep(1); }}><Text style={styles.buttonText}>{t('cancel')}</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton, { flex: 1 }]} onPress={handleConfirmNewPass}><Text style={styles.buttonText}>{t('confirm')}</Text></TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  }

  if (!isUnlocked) {
    return (
      <View style={[styles.centerContainer, { paddingTop: safeAreaInsets.top }]}>
        <TouchableOpacity style={styles.langButtonTopRight} onPress={toggleLanguage}><Text style={styles.langButtonText}>{lang === 'vi' ? '🇻🇳 VN' : '🇬🇧 EN'}</Text></TouchableOpacity>
        <Text style={styles.appTitle}>{t('vaultTitle')}</Text>
        <Text style={styles.subtitle}>{globalPassword ? t('vaultSubLocked') : t('vaultSubSetup')}</Text>
        {!globalPassword && renderTabSelector()}
        {renderInputUI(!globalPassword ? activeTab : passType, inputPassword, setInputPassword, t('passwordPlaceholder') as string)}
        {!globalPassword ? (
          <TouchableOpacity style={[styles.primaryButton, { marginTop: 20 }]} onPress={handleSetPassword}><Text style={styles.buttonText}>{t('setupFirstTime')}</Text></TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={[styles.primaryButton, { marginTop: 20 }]} onPress={handleUnlockVault}><Text style={styles.buttonText}>{t('unlockVault')}</Text></TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 30 }} onPress={() => { setIsChangingPassword(true); setChangePassStep(1); setOldPasswordInput(''); setNewPasswordInput(''); }}><Text style={{ color: '#007AFF', fontSize: 16, textDecorationLine: 'underline' }}>{t('changePasswordLink')}</Text></TouchableOpacity>
            {!decoyPassword && (
              <TouchableOpacity style={{ marginTop: 15 }} onPress={() => setIsSettingDecoy(true)}><Text style={{ color: '#dc3545', fontSize: 16, textDecorationLine: 'underline' }}>{t('setupDecoy')}</Text></TouchableOpacity>
            )}
          </>
        )}
        <TouchableOpacity style={styles.infoButton} onPress={() => showAuthorAlert()}><Text style={styles.infoText}>{t('appInfoLabel')}</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: safeAreaInsets.top }]}>
      <View style={styles.headerRow}>
        <Text style={styles.appTitle}>{t('galleryTitle')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity style={styles.langButtonSmall} onPress={toggleLanguage}><Text style={styles.langButtonTextSmall}>{lang === 'vi' ? '🇻🇳' : '🇬🇧'}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.lockButton} onPress={handleLockVault}><Text style={styles.buttonText}>{t('lockButton')}</Text></TouchableOpacity>
        </View>
      </View>

      {selectedRestoreIds.length > 0 && (
        <View style={styles.bulkActionRow}>
          <TouchableOpacity style={[styles.primaryButton, { flex: 1, marginRight: 8, backgroundColor: '#6c757d' }]} onPress={clearRestoreSelection}><Text style={styles.buttonText}>{t('deselectAll')}</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.primaryButton, { flex: 1, marginLeft: 8, backgroundColor: '#28a745' }]} onPress={handleBulkUnhide}><Text style={styles.buttonText}>{t('restoreSelected')}</Text></TouchableOpacity>
        </View>
      )}
      <FlatList
        data={vaultItems}
        numColumns={3}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const checked = selectedRestoreIds.includes(item.id);
          const onPress = () => selectedRestoreIds.length > 0 ? toggleRestoreSelection(item.id) : openMedia(item);
          return (
            <TouchableOpacity style={[styles.gridItem, checked && styles.gridItemSelected]} onPress={onPress} onLongPress={() => toggleRestoreSelection(item.id)}>
              <Image source={{ uri: item.thumbCachePath || item.cachePath }} style={styles.thumbnail} />
              {checked && <View style={styles.checkboxOverlay}><Text style={styles.checkboxText}>✔</Text></View>}
              {item.type === 'video' && <Text style={styles.videoBadge}>▶ VIDEO</Text>}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>{t('emptyVault')}</Text>}
      />

      <TouchableOpacity style={styles.fab} onPress={handleAddMedia}><Text style={styles.fabText}>+</Text></TouchableOpacity>

      <Modal visible={!!viewingItem} transparent={true} animationType="fade" onRequestClose={closeMedia}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeModalArea} onPress={closeMedia} />
          {viewingItem && (
            <View style={styles.reviewBox}>
              {isPreparingMedia ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="white" />
                  <Text style={{ color: 'white', marginTop: 10 }}>Đang nạp file media gốc...</Text>
                </View>
              ) : (
                <>
                  {viewingItem.type === 'video' ? (
                    <Video source={{ uri: fullMediaPath! }} style={styles.fullImage} controls={true} resizeMode="contain" paused={false} />
                  ) : (
                    <Image source={{ uri: fullMediaPath! }} style={styles.fullImage} resizeMode="contain" />
                  )}
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#dc3545' }]} onPress={() => handleUnhide(viewingItem)}>
                      <Text style={styles.buttonText}>{t('unhideButton')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#6c757d' }]} onPress={closeMedia}>
                      <Text style={styles.buttonText}>{t('closeButton')}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}