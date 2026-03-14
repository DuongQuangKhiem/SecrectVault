import CryptoJS from 'crypto-js';
import { LanguageType } from './types';
import { ABOUT_CONTENT_KEY, ABOUT_CONTENT_ENCODED, APP_LABEL_ENCODED } from './constants';

export const translations = {
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

const decodeAES = (encoded: string) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encoded, ABOUT_CONTENT_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    console.warn('AES decryption failed', e);
    return '';
  }
};

export const decodeAboutContent = (lang: LanguageType) => {
  const decoded = decodeAES(ABOUT_CONTENT_ENCODED[lang]);
  if (decoded && decoded.length > 0) return decoded;
  return translations[lang].aboutContent;
};

export const decodeAppInfoLabel = (lang: LanguageType) => {
  const decoded = decodeAES(APP_LABEL_ENCODED[lang]);
  if (decoded && decoded.length > 0) return decoded;
  return translations[lang].appInfoLabel;
};