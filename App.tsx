/**
 * Secure Vault App - Ultimate UX Optimization
 * - Fix 4-digit PIN input edge-case (Custom PIN UI)
 * - Optimize Pattern Lock smoothing for no latency
 * - AES Encrypted App Info
 */
import 'react-native-get-random-values';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  StatusBar,
  PermissionsAndroid,
  Platform,
  Linking,
  PanResponder,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import CryptoJS from 'crypto-js';
import RNFS from 'react-native-fs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import Video from 'react-native-video';
import RNRealPath from 'react-native-real-path';

const VAULT_DIR = RNFS.DocumentDirectoryPath + '/vault_secure_storage';
const CACHE_DIR = RNFS.CachesDirectoryPath + '/vault_temp_decrypted';
const INDEX_FILE = VAULT_DIR + '/vault_index.enc';
const XOR_HEADER_SIZE = 512;

type PasswordType = 'text' | 'pin' | 'pattern';

interface VaultItem {
  id: string;
  originalName: string;
  type: string;
  savedPath: string;
  cachePath?: string;
}

// --- BILINGUAL TRANSLATIONS ---
const translations = {
  vi: {
    loading: 'Đang xáo trộn & xử lý XOR...',
    changePasswordTitle: 'Đổi Mật Khẩu',
    verifyOldPass: 'Bước 1: Nhập mật khẩu cũ đang dùng',
    setupNewPass: 'Bước 2: Chọn loại & Cài Pass mới',
    oldPasswordPlaceholder: 'Nhập mật khẩu cũ...',
    newPasswordPlaceholder: 'Nhập mật khẩu mới...',
    pinPlaceholder: 'Nhập 6 số PIN...',
    cancel: 'Hủy',
    confirm: 'Xác Nhận',
    next: 'Tiếp tục',
    vaultTitle: 'Két Sắt Bí Mật',
    vaultSubLocked: 'Vui lòng mở khóa để vào két',
    vaultSubSetup: 'Chọn phương thức bảo vệ két sắt',
    setupFirstTime: 'Cài Đặt Lần Đầu',
    unlockVault: 'Mở Khóa Két',
    addMedia: '+ Giấu Thêm Ảnh/Video',
    changePasswordLink: 'Đổi mật khẩu két sắt',
    galleryTitle: 'Thư Viện Két Sắt',
    lockButton: 'Khóa Lại',
    emptyVault: 'Két sắt đang trống.',
    unhideButton: 'Bỏ Ẩn (Khôi Phục)',
    closeButton: 'Đóng',
    alertError: 'Lỗi',
    alertSuccess: 'Thành công',
    alertNotice: 'Lưu ý',
    alertFirstTime: 'Thiết lập lần đầu',
    alertFirstTimeMsg: 'Để XÓA TẬN GỐC và KHÔI PHỤC file nặng, Android bắt buộc cấp quyền "Quản lý tất cả tệp" trong Cài đặt.',
    skip: 'Bỏ qua',
    openSettings: 'Mở Cài đặt',
    errNoPass: 'Vui lòng nhập/vẽ mật khẩu',
    errWrongPass: 'Mật khẩu không chính xác!',
    errDecrypt: 'Dữ liệu không thể giải mã!',
    errPinLen: 'PIN phải gồm đúng 6 chữ số!',
    errPatternLen: 'Hình vẽ phải nối ít nhất 4 điểm!',
    errChangePass: 'Không thể đổi mật khẩu. Vui lòng thử lại.',
    errXOR: 'Có lỗi xảy ra khi xáo trộn XOR.',
    errRestore: 'Không thể khôi phục media này.',
    errNoPerm: 'Xin hãy cấp quyền hệ thống hoặc xóa ảnh gốc thủ công.',
    passwordPlaceholder: 'Nhập mật khẩu...',
    succSetup: 'Đã thiết lập bảo mật thành công!',
    succChangePass: 'Đã đổi khóa và xáo trộn két an toàn!',
    succHidePrefix: 'Đã giấu an toàn và xóa vĩnh viễn',
    succHideSuffix: 'file gốc!',
    succRestore: 'Đã bỏ ẩn và khôi phục về máy!',
    succRestoreMultiple: 'Đã khôi phục nhiều mục!',
    selectAll: 'Chọn tất cả',
    deselectAll: 'Bỏ chọn tất cả',
    restoreSelected: 'Khôi phục đã chọn',
    noItemsSelected: 'Chưa chọn mục nào để khôi phục.',
    appInfoLabel: 'Thông tin Ứng dụng',
    aboutTitle: 'Giới thiệu App',
    aboutContent: 'Người tạo: kproz03\nTelegram: @kproz03\nNgày tạo app: 07/03/2026',
    optText: '🔤 Chữ',
    optPin: '🔢 PIN 6 Số',
    optPattern: '❇️ Hình vẽ',
    drawPattern: 'Hãy vẽ mẫu hình bảo mật',
    patternRecorded: '✓ Đã ghi nhận hình vẽ',
  },
  en: {
    loading: 'Processing XOR Engine...',
    changePasswordTitle: 'Change Password',
    verifyOldPass: 'Step 1: Enter current password',
    setupNewPass: 'Step 2: Choose type & set new pass',
    oldPasswordPlaceholder: 'Enter old password...',
    newPasswordPlaceholder: 'Enter new password...',
    pinPlaceholder: 'Enter 6-digit PIN...',
    cancel: 'Cancel',
    confirm: 'Confirm',
    next: 'Next',
    vaultTitle: 'Secret Vault',
    vaultSubLocked: 'Unlock to access your vault',
    vaultSubSetup: 'Choose a security method',
    setupFirstTime: 'Initial Setup',
    unlockVault: 'Unlock Vault',
    addMedia: '+ Hide Media',
    changePasswordLink: 'Change vault password',
    galleryTitle: 'Vault Gallery',
    lockButton: 'Lock',
    emptyVault: 'Vault is empty.',
    unhideButton: 'Unhide (Restore)',
    closeButton: 'Close',
    alertError: 'Error',
    alertSuccess: 'Success',
    alertNotice: 'Notice',
    alertFirstTime: 'Initial Setup',
    alertFirstTimeMsg: 'To PERMANENTLY DELETE large files, Android requires "Manage all files" permission.',
    skip: 'Skip',
    openSettings: 'Open Settings',
    errNoPass: 'Please enter/draw password',
    errWrongPass: 'Incorrect password!',
    errDecrypt: 'Data decryption failed!',
    errPinLen: 'PIN must be exactly 6 digits!',
    errPatternLen: 'Pattern must connect at least 4 dots!',
    errChangePass: 'Cannot change password. Please try again.',
    errXOR: 'Error during XOR scrambling.',
    errRestore: 'Cannot restore this media.',
    errNoPerm: 'Please grant system permissions.',
    passwordPlaceholder: 'Enter password...',
    succSetup: 'Security setup successful!',
    succChangePass: 'Password changed and vault scrambled!',
    succHidePrefix: 'Safely hidden and permanently deleted',
    succHideSuffix: 'original files!',
    succRestore: 'Unhidden and restored to device!',
    succRestoreMultiple: 'Selected items restored!',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    restoreSelected: 'Restore Selected',
    noItemsSelected: 'No items selected for restore.',
    appInfoLabel: 'App Information',
    aboutTitle: 'About App',
    aboutContent: 'Creator: kproz03\nTelegram: @kproz03\nCreated: 07/03/2026',
    optText: '🔤 Text',
    optPin: '🔢 6-PIN',
    optPattern: '❇️ Pattern',
    drawPattern: 'Draw your security pattern',
    patternRecorded: '✓ Pattern recorded',
  }
};

type LanguageType = 'vi' | 'en';

// --- SECURITY & ENCRYPTION CONFIG ---
const PATTERN_SIZE = 260;
const GRID_SIZE = PATTERN_SIZE / 3;


const ABOUT_CONTENT_KEY = [118, 97, 117, 108, 116, 115, 101, 99, 114, 101, 116, 50, 48, 50, 54]
  .map((c) => String.fromCharCode(c)).join('');


const ABOUT_CONTENT_ENCODED: Record<LanguageType, string> = {
  vi: 'U2FsdGVkX18RYepDHTYOo2v6ipvHbZz1w9BFJHht4kASr3HaebHznuOLJxXL6tjROjzRQfmwXC7GxIs9AXqXH4YHei+K5f1/8wr5bQ6l4I9O3V4gXkv7GY2xoBJKTkBY',
  en: 'U2FsdGVkX1/QBgPrAxJ72HleFT2/z7KIl43teUUTyxbN19oyLjBl+GGFw3wLrL+WQt0QC2VawqfOCvB6/HyYZhShOcQZpQSKp+dQ5VoDaDA=',
};

const APP_LABEL_ENCODED: Record<LanguageType, string> = {
  vi: 'U2FsdGVkX18J58QS7dV4YM6YbNZ4+ynXa4iLZ+LDgOQ=',
  en: 'U2FsdGVkX1+GLy8k6i8Vbbn3fKCbv+p6SLs4hsdP5qM=',
};

const decodeAES = (encoded: string) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encoded, ABOUT_CONTENT_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    console.warn('AES decryption failed', e);
    return '';
  }
};

const decodeAboutContent = (lang: LanguageType) => {
  const decoded = decodeAES(ABOUT_CONTENT_ENCODED[lang]);
  if (decoded && decoded.length > 0) return decoded;
  return translations[lang].aboutContent;
};

const decodeAppInfoLabel = (lang: LanguageType) => {
  const decoded = decodeAES(APP_LABEL_ENCODED[lang]);
  if (decoded && decoded.length > 0) return decoded;
  return translations[lang].appInfoLabel;
};

// --- OPTIMIZED COMPONENT: PATTERN LOCK ---
const PatternLock = ({ onComplete }: { onComplete: (pass: string) => void }) => {
  const [pattern, setPattern] = useState<number[]>([]);
  const patternRef = useRef<number[]>([]);

  const nodes = Array.from({ length: 9 }).map((_, i) => ({
    id: i,
    x: (i % 3) * GRID_SIZE + GRID_SIZE / 2,
    y: Math.floor(i / 3) * GRID_SIZE + GRID_SIZE / 2,
  }));

  const getPoint = (x: number, y: number) => {
    for (let node of nodes) {
      if (Math.hypot(node.x - x, node.y - y) < 40) return node.id;
    }
    return null;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const pt = getPoint(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
        const initialPattern = pt !== null ? [pt] : [];
        patternRef.current = initialPattern;
        setPattern(initialPattern);
      },
      onPanResponderMove: (evt) => {
        const pt = getPoint(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
        if (pt !== null) {
          if (!patternRef.current.includes(pt)) {
            patternRef.current = [...patternRef.current, pt];
            setPattern(patternRef.current);
          }
        }
      },
      onPanResponderRelease: () => {
        onComplete(patternRef.current.join(''));
      }
    })
  ).current;

  return (
    <View style={styles.patternContainer} {...panResponder.panHandlers}>
      {pattern.map((nodeId, index) => {
        if (index === pattern.length - 1) return null;
        const p1 = nodes[nodeId];
        const p2 = nodes[pattern[index + 1]];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

        return (
          <View
            key={`line-${index}`}
            style={[
              styles.patternLine,
              {
                left: (p1.x + p2.x) / 2 - len / 2,
                top: (p1.y + p2.y) / 2 - 2,
                width: len,
                transform: [{ rotate: `${angle}deg` }]
              }
            ]}
          />
        );
      })}
      
      {nodes.map(node => (
        <View key={node.id} style={[styles.patternNodeBase, { left: node.x - 25, top: node.y - 25 }]}>
          <View style={[styles.patternNodeInner, pattern.includes(node.id) && styles.patternNodeActive]} />
        </View>
      ))}
    </View>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  
  const [lang, setLang] = useState<LanguageType>('vi');
  const t = (key: keyof typeof translations['vi']) => {
    if (key === 'aboutContent') return decodeAboutContent(lang);
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
      if (storedLang === 'vi' || storedLang === 'en') setLang(storedLang);

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

  const showAppInfo = () => Alert.alert(t('aboutTitle'), t('aboutContent'));
  
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

  const processXOR = (base64Data: string, password: string): string => {
    const dataWords = CryptoJS.enc.Base64.parse(base64Data);
    const passWords = CryptoJS.enc.Utf8.parse(password);
    if (passWords.sigBytes === 0) return base64Data;
    for (let i = 0; i < dataWords.words.length; i++) {
      dataWords.words[i] ^= passWords.words[i % passWords.words.length];
    }
    return CryptoJS.enc.Base64.stringify(dataWords);
  };

  const loadEncryptedIndex = async (password: string): Promise<VaultItem[]> => {
    try {
      const exists = await RNFS.exists(INDEX_FILE);
      if (!exists) return [];
      const encryptedData = await RNFS.readFile(INDEX_FILE, 'utf8');
      const bytes = CryptoJS.AES.decrypt(encryptedData, password);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      if (!decryptedString) throw new Error(t('errWrongPass'));
      return JSON.parse(decryptedString);
    } catch (e) {
      throw e;
    }
  };

  const saveEncryptedIndex = async (items: VaultItem[], password: string) => {
    const itemsToSave = items.map(({  ...rest }) => rest);
    
    const jsonString = JSON.stringify(itemsToSave);
    const encryptedData = CryptoJS.AES.encrypt(jsonString, password).toString();
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
      for (const item of items) {
        const safeOriginalName = item.originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const cachedPath = `${CACHE_DIR}/${item.id}_${safeOriginalName}`;
        const vaultPath = item.savedPath.replace('file://', '');
        
        await RNFS.copyFile(vaultPath, cachedPath);
        const headerBase64 = await RNFS.read(cachedPath, XOR_HEADER_SIZE, 0, 'base64');
        const restoredHeader = processXOR(headerBase64, inputPassword);
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
      for (const item of items) {
        const vaultPath = item.savedPath.replace('file://', '');
        const currentScrambledHeader = await RNFS.read(vaultPath, XOR_HEADER_SIZE, 0, 'base64');
        const originalHeader = processXOR(currentScrambledHeader, oldPasswordInput);
        const newScrambledHeader = processXOR(originalHeader, newPasswordInput);
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

      try {
        await RNFS.mkdir(CACHE_DIR);
        for (const asset of response.assets) {
          if (!asset.uri || !asset.fileName) continue;
          const uniqueId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          const secureSavedPath = `${VAULT_DIR}/${uniqueId}.bin`; 
          const safeOriginalName = asset.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
          const cachedPath = `${CACHE_DIR}/${uniqueId}_${safeOriginalName}`;

          // 1. Copy file vào két và mã hóa XOR
          await RNFS.copyFile(asset.uri, secureSavedPath);
          const stat = await RNFS.stat(asset.uri);
          const readSize = Math.min(Number(stat.size), XOR_HEADER_SIZE);

          const originalHeader = await RNFS.read(secureSavedPath, readSize, 0, 'base64');
          const scrambledHeader = processXOR(originalHeader, globalPassword!);
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

          // 2. LẤY ĐƯỜNG DẪN THẬT (REAL PATH) ĐỂ XÓA TẬN GỐC TRÊN ANDROID
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

        // Lưu dữ liệu vào index
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
            {renderInputUI(passType, oldPasswordInput, setOldPasswordInput, t('oldPasswordPlaceholder'))}
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
            {renderInputUI(activeTab, newPasswordInput, setNewPasswordInput, t('newPasswordPlaceholder'))}
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
        {renderInputUI(!globalPassword ? activeTab : passType, inputPassword, setInputPassword, t('passwordPlaceholder'))}

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f0f0f0', position: 'relative' },
  
  tabContainer: { flexDirection: 'row', width: '100%', backgroundColor: '#e0e0e0', borderRadius: 10, padding: 4, marginBottom: 20 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabButtonActive: { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  tabText: { color: '#666', fontWeight: 'bold' },
  tabTextActive: { color: '#007AFF' },

  patternContainer: { width: PATTERN_SIZE, height: PATTERN_SIZE, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 20, position: 'relative' },
  patternNodeBase: { position: 'absolute', width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  patternNodeInner: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#ccc' },
  patternNodeActive: { backgroundColor: '#007AFF', transform: [{ scale: 1.5 }] },
  patternLine: { position: 'absolute', height: 4, backgroundColor: '#007AFF', borderRadius: 2 },

  customPinContainer: { width: '100%', height: 60, justifyContent: 'center', alignItems: 'center', position: 'relative', marginBottom: 20 },
  pinDotsRow: { flexDirection: 'row', gap: 20 },
  pinDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#007AFF', backgroundColor: 'transparent' },
  pinDotActive: { backgroundColor: '#007AFF' },
  hiddenPinInput: { position: 'absolute', width: '100%', height: '100%', opacity: 0, fontSize: 1 },

  langButtonTopRight: { position: 'absolute', top: 50, right: 20, padding: 8, backgroundColor: '#e0e0e0', borderRadius: 8 },
  langButtonText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  langButtonSmall: { padding: 8, backgroundColor: '#e0e0e0', borderRadius: 8 },
  langButtonTextSmall: { fontSize: 16 },

  infoButton: { position: 'absolute', bottom: 30 },
  infoText: { color: '#888', fontSize: 14, textDecorationLine: 'underline' },

  appTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 20, textAlign: 'center', paddingHorizontal: 10 },
  inputWrapper: { width: '100%', flexDirection: 'row', alignItems: 'center', position: 'relative', height: 55, marginBottom: 20 },
  passwordInput: { flex: 1, borderWidth: 1, borderColor: '#ccc', padding: 15, paddingRight: 50, borderRadius: 10, backgroundColor: 'white', fontSize: 18, color: 'black', height: 55 },
  eyeIcon: { position: 'absolute', right: 15, height: '100%', justifyContent: 'center' },
  eyeText: { fontSize: 22 },
  primaryButton: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, width: '100%', alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#ddd' },
  bulkActionRow: { flexDirection: 'row', paddingHorizontal: 15, paddingBottom: 10, paddingTop: 8, backgroundColor: 'white', alignItems: 'center' },
  lockButton: { backgroundColor: '#dc3545', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  gridItem: { flex: 1/3, aspectRatio: 1, padding: 2, position: 'relative' },
  gridItemSelected: { borderWidth: 2, borderColor: '#28a745', borderRadius: 6 },
  checkboxOverlay: { position: 'absolute', top: 5, left: 5, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(40, 167, 69, 0.9)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  checkboxText: { color: 'white', fontWeight: 'bold' },
  thumbnail: { flex: 1, borderRadius: 5, backgroundColor: '#ddd' },
  videoBadge: { position: 'absolute', bottom: 5, right: 5, color: 'white', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 10, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#888', fontSize: 16 },
  fab: { position: 'absolute', right: 20, bottom: 40, backgroundColor: '#28a745', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
  fabText: { color: 'white', fontSize: 30, fontWeight: 'bold', marginTop: -2 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  closeModalArea: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  reviewBox: { width: '90%', height: '80%', backgroundColor: 'transparent', justifyContent: 'center' },
  fullImage: { flex: 1, width: '100%', height: '100%', marginBottom: 20 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center', marginHorizontal: 5 },
});